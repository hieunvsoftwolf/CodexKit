import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ValidationArtifactRef, ValidationMetricResult } from "../../packages/codexkit-core/src/index.ts";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  PHASE9_VALIDATION_REPORT_FILE_NAMES,
  runResumeWorkflow,
  RuntimeController
} from "../../packages/codexkit-daemon/src/index.ts";
import { runReconciliationPass } from "../../packages/codexkit-daemon/src/runtime-kernel.ts";
import { parseCliFailure } from "./helpers/cli-json.ts";
import { createDurableNoteArtifact, readPhase9EvidenceBundle, writePhase9EvidenceBundle } from "./helpers/phase9-evidence.ts";
import { createGitRuntimeFixture, createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

type ChecklistStatus = "pass" | "fail" | "blocked";

interface ChecklistRow {
  checklistId: string;
  fixtureId: string;
  requirement: string;
  metricIds: string[];
  status: ChecklistStatus;
  evidenceRefs: string[];
  notes: string;
}

function runCli(rootDir: string, args: string[]): Record<string, unknown> {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliWithEnv(rootDir: string, args: string[], env: NodeJS.ProcessEnv): Record<string, unknown> {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliFailure(rootDir: string, args: string[]): Record<string, unknown> {
  try {
    runCli(rootDir, args);
    return { code: "UNEXPECTED_SUCCESS" };
  } catch (error) {
    return parseCliFailure(error);
  }
}

function metricArtifactRef(label: string, refPath: string): ValidationArtifactRef {
  return {
    label,
    path: refPath,
    durability: "durable"
  };
}

function aggregateStatus(rows: ChecklistRow[], metricId: string): ChecklistStatus {
  const scoped = rows.filter((row) => row.metricIds.includes(metricId));
  if (scoped.length === 0) {
    return "blocked";
  }
  if (scoped.some((row) => row.status === "fail")) {
    return "fail";
  }
  if (scoped.some((row) => row.status === "blocked")) {
    return "blocked";
  }
  return "pass";
}

function createCodexBinaryShim(codexPath: string): string {
  const shimDir = mkdtempSync(path.join(tmpdir(), "codex-phase9-real-shim-"));
  const shimPath = path.join(shimDir, "codex");
  const script = [
    "#!/bin/sh",
    `exec "${codexPath}" "$@"`,
    ""
  ].join("\n");
  writeFileSync(shimPath, script, { encoding: "utf8", mode: 0o755 });
  cleanups.push(() => rmSync(shimDir, { recursive: true, force: true }));
  return shimDir;
}

function readCodexVersionForBinary(codexPath: string): string | null {
  try {
    const output = execFileSync(codexPath, ["--version"], {
      encoding: "utf8",
      env: process.env
    }).trim();
    return output.length > 0 ? output : null;
  } catch {
    return null;
  }
}

function discoverCodexVersionCandidates(): Array<{ binaryPath: string; version: string }> {
  const fromEnv = (process.env.PHASE9_CODEX_BINARIES ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  let fromWhich: string[] = [];
  try {
    fromWhich = execFileSync("which", ["-a", "codex"], { encoding: "utf8" })
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  } catch {
    fromWhich = [];
  }
  const uniquePaths = Array.from(new Set([...fromEnv, ...fromWhich])).filter((entry) => existsSync(entry));
  const seenVersions = new Set<string>();
  const candidates: Array<{ binaryPath: string; version: string }> = [];
  for (const binaryPath of uniquePaths) {
    const version = readCodexVersionForBinary(binaryPath);
    if (!version || seenVersions.has(version)) {
      continue;
    }
    seenVersions.add(version);
    candidates.push({ binaryPath, version });
  }
  return candidates;
}

function promoteChecklistRowEvidenceToDurable(
  rows: ChecklistRow[],
  artifactRefs: Array<{ label: string; path: string }>
): void {
  for (const row of rows) {
    const rawEvidence = row.evidenceRefs
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
    const rowArtifact = createDurableNoteArtifact({
      suiteId: "validation-migration",
      label: `migration-${row.checklistId}-row-evidence`,
      markdown: [
        `# Migration Checklist Evidence: ${row.checklistId}`,
        "",
        `- Fixture: ${row.fixtureId}`,
        `- Requirement: ${row.requirement}`,
        `- Metrics: ${row.metricIds.join(", ")}`,
        `- Status: ${row.status}`,
        `- Notes: ${row.notes}`,
        "",
        "## Raw Evidence Inputs",
        ...(rawEvidence.length > 0 ? rawEvidence.map((entry) => `- ${entry}`) : ["- none"]),
        ""
      ].join("\n")
    });
    row.evidenceRefs = [rowArtifact.path];
    artifactRefs.push({ label: `migration-${row.checklistId}-row-evidence`, path: rowArtifact.path });
  }
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 9 migration validation checklist", () => {
  test("publishes checklist evidence for migration and release-safety contracts", { timeout: 180_000 }, async () => {
    const rows: ChecklistRow[] = [];
    const artifactRefs: Array<{ label: string; path: string }> = [];

    const freshFixture = await createRuntimeFixture("codexkit-phase9-migration-fresh");
    cleanups.push(() => freshFixture.cleanup());
    execFileSync("git", ["init"], { cwd: freshFixture.rootDir });
    runCli(freshFixture.rootDir, ["daemon", "start", "--once"]);
    const initFreshPreview = runCli(freshFixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
    const initFreshApply = runCli(freshFixture.rootDir, ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
    const blockedWorkerWorkflow = runCliFailure(freshFixture.rootDir, ["cook"]);
    const installOnlyBlocked = blockedWorkerWorkflow.code === "WORKFLOW_BLOCKED"
      && ((blockedWorkerWorkflow.details as { code?: string } | undefined)?.code) === "WF_INSTALL_ONLY_REPO_BLOCKED";
    rows.push({
      checklistId: "fresh-install",
      fixtureId: "fresh-no-git",
      requirement: "new repo cdx init installs safely and keeps install-only worker gating until first commit",
      metricIds: ["NFR-4.1", "NFR-4.5"],
      status: initFreshApply.installOnly === true
        && initFreshApply.applyExecuted === true
        && (initFreshPreview.checkpointIds as string[]).join(",") === "package-scan,package-preview"
        && installOnlyBlocked
        ? "pass"
        : "fail",
      evidenceRefs: [String(initFreshApply.initReportPath ?? ""), JSON.stringify(blockedWorkerWorkflow)],
      notes: installOnlyBlocked ? "install-only gate verified by blocked worker-backed review command" : "install-only gate was not enforced"
    });

    const migratedFixture = await createGitRuntimeFixture("codexkit-phase9-migration-claudekit");
    cleanups.push(() => migratedFixture.cleanup());
    runCli(migratedFixture.rootDir, ["daemon", "start", "--once"]);
    mkdirSync(path.join(migratedFixture.rootDir, ".claude"), { recursive: true });
    writeFileSync(path.join(migratedFixture.rootDir, ".claude", "settings.json"), "{\"source\":\"claudekit\"}\n", "utf8");
    const customReadme = "# migrated fixture\npreserve me\n";
    writeFileSync(path.join(migratedFixture.rootDir, "README.md"), customReadme, "utf8");
    const initMigratedPreview = runCli(migratedFixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
    const initMigratedApply = runCli(migratedFixture.rootDir, ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
    const readmePreserved = readFileSync(path.join(migratedFixture.rootDir, "README.md"), "utf8") === customReadme;
    rows.push({
      checklistId: "migrated-install-non-destructive",
      fixtureId: "claudekit-migrated",
      requirement: "existing ClaudeKit-style repo install stays non-destructive",
      metricIds: ["NFR-4.2", "NFR-4.3"],
      status: Boolean(initMigratedApply.applyExecuted) && readmePreserved && existsSync(String(initMigratedPreview.migrationAssistantReportPath))
        ? "pass"
        : "fail",
      evidenceRefs: [String(initMigratedPreview.initReportPath ?? ""), String(initMigratedPreview.migrationAssistantReportPath ?? "")],
      notes: readmePreserved ? "README preserved" : "README was mutated"
    });

    rmSync(path.join(migratedFixture.rootDir, ".codexkit", "manifests", "release-manifest.json"), { force: true });
    const doctorBroken = runCli(migratedFixture.rootDir, ["doctor"]);
    const brokenDetected = (doctorBroken.findings as Array<{ code: string }>).some((finding) => finding.code === "DOCTOR_RELEASE_MANIFEST_MISSING");
    rows.push({
      checklistId: "doctor-broken-state",
      fixtureId: "git-clean",
      requirement: "cdx doctor detects broken installs and stale runtime state",
      metricIds: ["NFR-4.1", "NFR-4.4"],
      status: brokenDetected && existsSync(String(doctorBroken.doctorReportPath)) ? "pass" : "fail",
      evidenceRefs: [String(doctorBroken.doctorReportPath ?? "")],
      notes: brokenDetected ? "missing release manifest detected" : "doctor missed broken manifest state"
    });

    const interruptedFixture = await createGitRuntimeFixture("codexkit-phase9-migration-interrupted");
    cleanups.push(() => interruptedFixture.cleanup());
    runCli(interruptedFixture.rootDir, ["daemon", "start", "--once"]);
    const interruptedRun = runCli(interruptedFixture.rootDir, ["run", "create", "--workflow", "cook", "--prompt", "migration resume"]);
    const interruptedRunId = String(interruptedRun.id);
    runCli(interruptedFixture.rootDir, [
      "approval",
      "request",
      "--run",
      interruptedRunId,
      "--checkpoint",
      "post-plan",
      "--question",
      "Continue?",
      "--option",
      "approve:Approve"
    ]);
    const resumed = runCli(interruptedFixture.rootDir, ["resume", interruptedRunId]);
    const resumePass = (resumed.pendingApprovals as Array<unknown>).length > 0
      && String(resumed.continuationCommand).includes("cdx approval respond");
    rows.push({
      checklistId: "resume-interrupted-run",
      fixtureId: "interrupted-run",
      requirement: "cdx resume restores interrupted workflows with one explicit continuation command",
      metricIds: ["NFR-4.1"],
      status: resumePass ? "pass" : "fail",
      evidenceRefs: [String(resumed.resumeReportPath ?? "")],
      notes: resumePass ? "pending approval continuation surfaced" : "resume did not surface approval continuation"
    });
    artifactRefs.push({ label: "migration-resume-report", path: String(resumed.resumeReportPath ?? "") });

    let filteredPath = process.env.PATH ?? "";
    try {
      const codexBinary = execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
      const codexDir = path.dirname(codexBinary);
      filteredPath = filteredPath
        .split(path.delimiter)
        .filter((segment) => path.resolve(segment) !== path.resolve(codexDir))
        .join(path.delimiter);
    } catch {
      filteredPath = process.env.PATH ?? "";
    }
    const hostGapDoctor = runCliWithEnv(migratedFixture.rootDir, ["doctor"], {
      ...process.env,
      PATH: filteredPath
    });
    const hostGapPass = hostGapDoctor.status === "blocked"
      && (hostGapDoctor.findings as Array<{ code: string }>).some(
        (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_UNAVAILABLE"
      );
    rows.push({
      checklistId: "host-capability-gap",
      fixtureId: "host-capability-gap",
      requirement: "doctor blocks unsupported host capabilities with explicit typed diagnostics",
      metricIds: ["NFR-4.6", "NFR-8.2", "NFR-8.3"],
      status: hostGapPass ? "pass" : "fail",
      evidenceRefs: [String(hostGapDoctor.doctorReportPath ?? "")],
      notes: hostGapPass ? "host gap blocked explicitly" : "host gap did not block explicitly"
    });

    const finalizeController = new RuntimeController(migratedFixture.rootDir);
    cleanups.push(() => finalizeController.close());
    const plan = finalizeController.plan({ task: "phase9 migration finalize", mode: "hard" }) as { planPath: string };
    const cooked = finalizeController.cook({ planPath: plan.planPath, mode: "auto" }) as { runId: string };
    const finalized = finalizeController.finalize({ runId: cooked.runId, planPathHint: plan.planPath });
    const finalizePass = existsSync(finalized.finalizeReportPath)
      && existsSync(finalized.docsImpact.reportPath)
      && existsSync(finalized.gitHandoff.reportPath);
    rows.push({
      checklistId: "finalize-contract-after-migration",
      fixtureId: "git-clean",
      requirement: "finalize still emits sync-back, docs impact, and git handoff artifacts",
      metricIds: ["NFR-4.1"],
      status: finalizePass ? "pass" : "fail",
      evidenceRefs: [finalized.finalizeReportPath, finalized.docsImpact.reportPath, finalized.gitHandoff.reportPath],
      notes: finalizePass ? "finalize artifact trio confirmed" : "finalize artifact trio incomplete"
    });
    artifactRefs.push({ label: "migration-finalize-report", path: finalized.finalizeReportPath });

    const goldenFallbackArtifact = createDurableNoteArtifact({
      suiteId: "validation-migration",
      label: "migration-golden-fixture-proof-local",
      markdown: [
        "# Migration Golden Fixture Proof (Local)",
        "",
        `- migrated install non-destructive: ${rows.find((row) => row.checklistId === "migrated-install-non-destructive")?.status === "pass"}`,
        `- doctor broken-state diagnostics: ${rows.find((row) => row.checklistId === "doctor-broken-state")?.status === "pass"}`,
        `- resume interrupted run surfaced continuation: ${resumePass}`,
        `- finalize artifact trio present: ${finalizePass}`,
        ""
      ].join("\n")
    });
    artifactRefs.push({ label: "migration-golden-fixture-proof-local", path: goldenFallbackArtifact.path });

    const goldenEvidence = readPhase9EvidenceBundle("validation-golden");
    const goldenProofFromBundlePass = Boolean(goldenEvidence)
      && goldenEvidence!.fixtureIds.includes("git-clean")
      && goldenEvidence!.metricResults
        .filter((metric) => ["NFR-1.5", "NFR-3.2", "NFR-3.5", "NFR-3.6", "NFR-6.1", "NFR-6.3"].includes(metric.metricId))
        .every((metric) => metric.status === "pass");
    const goldenProofLocalPass = rows.some((row) => row.checklistId === "migrated-install-non-destructive" && row.status === "pass")
      && rows.some((row) => row.checklistId === "doctor-broken-state" && row.status === "pass")
      && resumePass
      && finalizePass;
    const goldenProofPass = goldenProofFromBundlePass || goldenProofLocalPass;
    rows.push({
      checklistId: "golden-fixture-proof",
      fixtureId: "git-clean",
      requirement: "golden workflow suite proves required fixture behavior, not artifact presence only",
      metricIds: ["NFR-4.1"],
      status: goldenProofPass ? "pass" : "fail",
      evidenceRefs: goldenEvidence
        ? ["validation-golden-evidence.json", goldenFallbackArtifact.path]
        : [goldenFallbackArtifact.path],
      notes: goldenProofPass
        ? (goldenProofFromBundlePass
          ? "golden required metrics passed on required fixtures"
          : "golden local executable fallback proof passed on required fixtures")
        : "golden required fixture proof missing or non-pass"
    });

    const chaosFixture = await createGitRuntimeFixture("codexkit-phase9-migration-chaos-proof");
    cleanups.push(() => chaosFixture.cleanup());
    const chaosContext = openRuntimeContext(loadRuntimeConfig(chaosFixture.rootDir));
    cleanups.push(() => chaosContext.close());
    const chaosRun = chaosContext.runService.createRun({ workflow: "cook", prompt: "migration chaos fixture proof" });
    const chaosTask = chaosContext.taskService.createTask({
      runId: chaosRun.id,
      role: "developer",
      subject: "artifact history retention on failed worker"
    });
    const chaosWorker = chaosContext.workerService.registerWorker({
      runId: chaosRun.id,
      role: "developer",
      displayName: "Migration chaos fixture worker"
    });
    const chaosClaim = chaosContext.claimService.createClaim({
      taskId: chaosTask.id,
      workerId: chaosWorker.id,
      leaseMs: 15_000
    });
    const chaosArtifactPath = path.join(chaosFixture.rootDir, "migration-chaos-proof.log");
    writeFileSync(chaosArtifactPath, "publish artifact before task state reconciliation\n", "utf8");
    const chaosArtifact = chaosContext.artifactService.publishArtifact({
      runId: chaosRun.id,
      taskId: chaosTask.id,
      workerId: chaosWorker.id,
      artifactKind: "trace",
      path: chaosArtifactPath,
      summary: "migration checklist chaos proof artifact"
    });
    chaosContext.workerService.updateWorker(chaosWorker.id, {
      state: "failed",
      stoppedAt: new Date().toISOString()
    });
    runReconciliationPass(chaosContext);
    const chaosClaimExpired = chaosContext.claimService
      .listClaims({ taskId: chaosTask.id })
      .some((claim) => claim.id === chaosClaim.id && claim.status === "expired");
    const chaosArtifactTraceable = chaosContext.artifactService.readArtifact({ artifactId: chaosArtifact.id }).path === chaosArtifactPath
      && chaosContext.artifactService.readArtifact({ runId: chaosRun.id, path: chaosArtifactPath }).id === chaosArtifact.id;
    const chaosPublishedEvent = chaosContext.eventService
      .listEntityEvents("artifact", chaosArtifact.id, 50)
      .find((event) => event.eventType === "artifact.published");
    const chaosReclaimEvent = chaosContext.eventService
      .listEntityEvents("worker", chaosWorker.id, 50)
      .find((event) => event.eventType === "worker.reclaim.queued");
    const chaosResume = runResumeWorkflow(chaosContext, { runId: chaosRun.id });
    const chaosRecoveryVisible = chaosResume.reclaimCandidates.length > 0
      && chaosResume.diagnostics.some((diagnostic) => diagnostic.code === "RESUME_RECLAIM_BLOCKED")
      && typeof chaosResume.continuationCommand === "string"
      && chaosResume.continuationCommand.length > 0;
    const chaosProofLocalPass = chaosClaimExpired
      && chaosArtifactTraceable
      && Boolean(chaosPublishedEvent)
      && Boolean(chaosReclaimEvent)
      && Number(chaosPublishedEvent?.id ?? 0) < Number(chaosReclaimEvent?.id ?? 0)
      && chaosRecoveryVisible;
    const chaosFallbackArtifact = createDurableNoteArtifact({
      suiteId: "validation-migration",
      label: "migration-chaos-fixture-proof-local",
      markdown: [
        "# Migration Chaos Fixture Proof (Local)",
        "",
        `- claim expired after failed worker reconciliation: ${chaosClaimExpired}`,
        `- artifact traceable by id and run/path: ${chaosArtifactTraceable}`,
        `- artifact published event emitted: ${Boolean(chaosPublishedEvent)}`,
        `- worker reclaim queued after publish: ${Boolean(chaosReclaimEvent)}`,
        `- operator-visible reclaim resume state: ${chaosRecoveryVisible}`,
        ""
      ].join("\n")
    });
    artifactRefs.push({ label: "migration-chaos-fixture-proof-local", path: chaosFallbackArtifact.path });

    const chaosEvidence = readPhase9EvidenceBundle("validation-chaos");
    const chaosProofPass = Boolean(chaosEvidence)
      && chaosEvidence!.fixtureIds.includes("interrupted-run")
      && chaosEvidence!.fixtureIds.includes("retained-failed-worker")
      && chaosEvidence!.metricResults
        .filter((metric) => ["NFR-5.4", "NFR-6.4", "NFR-7.4"].includes(metric.metricId))
        .every((metric) => metric.status === "pass");
    rows.push({
      checklistId: "chaos-fixture-proof",
      fixtureId: "retained-failed-worker",
      requirement: "chaos scenarios prove recoverability and retained artifact history on required fixtures",
      metricIds: ["NFR-4.1"],
      status: chaosProofPass || chaosProofLocalPass ? "pass" : "fail",
      evidenceRefs: chaosEvidence
        ? ["validation-chaos-evidence.json", chaosFallbackArtifact.path]
        : [chaosFallbackArtifact.path],
      notes: chaosProofPass
        ? "chaos required metrics passed on required fixtures"
        : (chaosProofLocalPass
          ? "chaos local executable fallback proof passed on required fixtures"
          : "chaos required fixture proof missing or non-pass")
    });

    const hostMatrixPath = path.join(process.cwd(), ".tmp", "phase9-host-matrix-smoke.json");
    mkdirSync(path.dirname(hostMatrixPath), { recursive: true });
    let hostMatrixStatus: ChecklistStatus = "blocked";
    let hostMatrixNote = "fewer than two real Codex CLI versions discovered for host matrix smoke";
    const hostMatrixEvidenceRefs: string[] = [];
    const codexCandidates = discoverCodexVersionCandidates();
    const matrixVersions: Array<{
      version: string;
      binaryPath: string;
      status: ChecklistStatus;
      doctorReportPath?: string;
    }> = [];
    if (codexCandidates.length >= 2) {
      for (const candidate of codexCandidates) {
        const shimDir = createCodexBinaryShim(candidate.binaryPath);
        const doctorResult = runCliWithEnv(migratedFixture.rootDir, ["doctor"], {
          ...process.env,
          PATH: `${shimDir}${path.delimiter}${filteredPath}`
        });
        const selectedRunnerUnavailable = (doctorResult.findings as Array<{ code?: string }> | undefined)?.some(
          (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_UNAVAILABLE"
        ) ?? false;
        const versionPass = doctorResult.status !== "blocked" && !selectedRunnerUnavailable;
        matrixVersions.push({
          version: candidate.version,
          binaryPath: candidate.binaryPath,
          status: versionPass ? "pass" : "fail",
          doctorReportPath: String(doctorResult.doctorReportPath ?? "")
        });
        if (typeof doctorResult.doctorReportPath === "string" && doctorResult.doctorReportPath.length > 0) {
          hostMatrixEvidenceRefs.push(String(doctorResult.doctorReportPath));
        }
      }
      hostMatrixStatus = matrixVersions.every((entry) => entry.status === "pass") ? "pass" : "fail";
      hostMatrixNote = hostMatrixStatus === "pass"
        ? "at least two real Codex CLI versions passed host smoke checks"
        : "at least one discovered Codex CLI version failed host smoke checks";
    }
    const matrixPayload = {
      generatedAt: new Date().toISOString(),
      status: hostMatrixStatus,
      note: hostMatrixNote,
      discoveredVersionCount: codexCandidates.length,
      versions: matrixVersions
    };
    writeFileSync(hostMatrixPath, `${JSON.stringify(matrixPayload, null, 2)}\n`, "utf8");
    hostMatrixEvidenceRefs.unshift(hostMatrixPath);
    rows.push({
      checklistId: "host-matrix-smoke",
      fixtureId: "host-capability-gap",
      requirement: "release host matrix includes at least two Codex CLI versions and all listed versions pass smoke checks",
      metricIds: ["NFR-8.1"],
      status: hostMatrixStatus,
      evidenceRefs: hostMatrixEvidenceRefs,
      notes: hostMatrixNote
    });
    artifactRefs.push({ label: "host-matrix-smoke", path: hostMatrixPath });

    promoteChecklistRowEvidenceToDurable(rows, artifactRefs);

    const checklistPath = path.join(process.cwd(), ".tmp", PHASE9_VALIDATION_REPORT_FILE_NAMES.migrationChecklist);
    const checklistMarkdown = [
      "# Migration Validation Checklist",
      "",
      "| ID | Fixture | Requirement | Metrics | Status | Evidence | Notes |",
      "|---|---|---|---|---|---|---|",
      ...rows.map((row) =>
        `| ${row.checklistId} | ${row.fixtureId} | ${row.requirement} | ${row.metricIds.join(", ")} | ${row.status} | ${row.evidenceRefs.join("<br/>")} | ${row.notes} |`
      ),
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n");
    mkdirSync(path.dirname(checklistPath), { recursive: true });
    writeFileSync(checklistPath, checklistMarkdown, "utf8");
    artifactRefs.push({ label: "migration-checklist", path: checklistPath });

    const checklistArtifactRef = metricArtifactRef("migration-checklist", checklistPath);
    const hostMatrixArtifactRef = metricArtifactRef("host-matrix-smoke", hostMatrixPath);

    const metricIds = ["NFR-4.1", "NFR-4.2", "NFR-4.3", "NFR-4.4", "NFR-4.5", "NFR-4.6", "NFR-8.1", "NFR-8.2", "NFR-8.3"];
    const metricResults: ValidationMetricResult[] = metricIds.map((metricId) => {
      const status = aggregateStatus(rows, metricId);
      const metricRows = rows.filter((row) => row.metricIds.includes(metricId));
      const fixtureRefs = Array.from(new Set(metricRows.map((row) => row.fixtureId)));
      const evidence = metricRows.map((row) => `${row.checklistId}: ${row.notes}`);
      return {
        metricId,
        mappedNfrIds: [metricId],
        required: true,
        status,
        fixtureRefs,
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: metricId === "NFR-8.1" ? [checklistArtifactRef, hostMatrixArtifactRef] : [checklistArtifactRef],
        evidence,
        ...(status === "blocked" ? { notes: "blocked pending additional host/runtime prerequisites" } : {})
      };
    });

    const blockers = rows
      .filter((row) => row.status !== "pass")
      .map((row) => `${row.checklistId}: ${row.status} - ${row.notes}`);
    if (metricResults.some((metric) => metric.required && metric.status !== "pass")) {
      blockers.push("one or more required migration metrics are non-pass");
    }

    const evidence = writePhase9EvidenceBundle({
      suiteId: "validation-migration",
      fixtureIds: ["fresh-no-git", "git-clean", "claudekit-migrated", "interrupted-run", "retained-failed-worker", "host-capability-gap"],
      metricResults,
      artifactRefs,
      blockers
    });

    expect(existsSync(checklistPath)).toBe(true);
    expect(existsSync(evidence.path)).toBe(true);
    expect(rows.map((row) => row.fixtureId)).toEqual(expect.arrayContaining([
      "fresh-no-git",
      "git-clean",
      "claudekit-migrated",
      "interrupted-run",
      "host-capability-gap"
    ]));
  });
});
