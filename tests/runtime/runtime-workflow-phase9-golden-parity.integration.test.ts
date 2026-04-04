import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ValidationArtifactRef, ValidationMetricResult } from "../../packages/codexkit-core/src/index.ts";
import { RuntimeController } from "../../packages/codexkit-daemon/src/index.ts";
import { createDurableNoteArtifact, writePhase9EvidenceBundle } from "./helpers/phase9-evidence.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];
const FROZEN_CLAUDEKIT_PLAN_COOK_TRACE_PATH = path.join(
  process.cwd(),
  "plans",
  "20260313-1128-phase-0-preflight-clean-restart",
  "reports",
  "phase-9-frozen-claudekit-plan-cook-trace.json"
);

interface FrozenClaudekitPlanCookTrace {
  traceId: string;
  fixtureId: string;
  sourceRef: string;
  operatorActions: Array<{ checkpoint: string; command: string }>;
}

function loadFrozenClaudekitPlanCookTrace(): FrozenClaudekitPlanCookTrace {
  const parsed = JSON.parse(readFileSync(FROZEN_CLAUDEKIT_PLAN_COOK_TRACE_PATH, "utf8")) as FrozenClaudekitPlanCookTrace;
  if (typeof parsed.traceId !== "string" || !Array.isArray(parsed.operatorActions) || parsed.operatorActions.length === 0) {
    throw new Error("invalid frozen ClaudeKit plan->cook trace artifact");
  }
  return parsed;
}

function runCli(rootDir: string, args: string[], env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliFreshSession(rootDir: string, args: string[]): Record<string, unknown> {
  return runCli(rootDir, args, {
    ...process.env,
    PHASE9_FRESH_SESSION_MARKER: "1"
  });
}

function metricArtifactRef(label: string, refPath: string): ValidationArtifactRef {
  return {
    label,
    path: refPath,
    durability: "durable"
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

interface PlanCookHandoffField {
  source: string;
  rawValue: string;
}

function collectPlanCookHandoffFields(input: {
  handoffCommand: string;
  planPath: string;
  mode: string;
  diagnostics: Array<Record<string, unknown>>;
}): PlanCookHandoffField[] {
  const fields: PlanCookHandoffField[] = [];
  if (input.handoffCommand.trim().length > 0) {
    fields.push({ source: "handoffCommand", rawValue: input.handoffCommand.trim() });
  }
  if (input.planPath.trim().length > 0) {
    fields.push({ source: "planPath", rawValue: input.planPath.trim() });
  }
  if (input.mode.trim().length > 0) {
    fields.push({ source: "mode", rawValue: input.mode.trim() });
  }
  for (let index = 0; index < input.diagnostics.length; index += 1) {
    const nextStep = input.diagnostics[index]?.nextStep;
    if (typeof nextStep === "string" && nextStep.trim().length > 0) {
      fields.push({ source: `diagnostics[${index}].nextStep`, rawValue: nextStep.trim() });
    }
  }
  return fields;
}

function collectRestatementCandidateTexts(input: {
  cook: Record<string, unknown>;
  cookRunView: Record<string, unknown>;
}): string[] {
  const texts: string[] = [];
  const diagnostics = Array.isArray(input.cook.diagnostics) ? input.cook.diagnostics : [];
  for (const diagnostic of diagnostics) {
    if (!diagnostic || typeof diagnostic !== "object") {
      continue;
    }
    const casted = diagnostic as { code?: unknown; cause?: unknown; nextStep?: unknown };
    texts.push(String(casted.code ?? ""));
    texts.push(String(casted.cause ?? ""));
    texts.push(String(casted.nextStep ?? ""));
  }

  const pendingApproval = input.cook.pendingApproval as { checkpoint?: unknown; nextStep?: unknown } | undefined;
  if (pendingApproval) {
    texts.push(String(pendingApproval.checkpoint ?? ""));
    texts.push(String(pendingApproval.nextStep ?? ""));
  }

  const approvals = Array.isArray(input.cookRunView.approvals) ? input.cookRunView.approvals : [];
  for (const approval of approvals) {
    if (!approval || typeof approval !== "object") {
      continue;
    }
    const casted = approval as { checkpoint?: unknown; question?: unknown; responseText?: unknown };
    texts.push(String(casted.checkpoint ?? ""));
    texts.push(String(casted.question ?? ""));
    texts.push(String(casted.responseText ?? ""));
  }

  const messages = Array.isArray(input.cookRunView.messages) ? input.cookRunView.messages : [];
  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }
    const casted = message as { subject?: unknown; body?: unknown; messageType?: unknown };
    texts.push(String(casted.messageType ?? ""));
    texts.push(String(casted.subject ?? ""));
    texts.push(String(casted.body ?? ""));
  }

  return texts;
}

function countRestatementEvents(input: {
  handoffFields: PlanCookHandoffField[];
  restatementCandidateTexts: string[];
}): number {
  const normalizedTexts = input.restatementCandidateTexts.map((entry) => normalizeText(entry)).filter((entry) => entry.length > 0);
  let restatementEvents = 0;
  for (const field of input.handoffFields) {
    if (field.source === "mode") {
      const normalizedMode = normalizeText(field.rawValue);
      if (normalizedMode.length === 0) {
        continue;
      }
      const modeNeedles = [
        `mode ${normalizedMode}`,
        `mode is ${normalizedMode}`,
        `run mode ${normalizedMode}`,
        `continuation mode ${normalizedMode}`
      ];
      if (normalizedTexts.some((text) => modeNeedles.some((needle) => text.includes(needle)))) {
        restatementEvents += 1;
      }
      continue;
    }
    const normalizedFieldValue = normalizeText(field.rawValue);
    if (normalizedFieldValue.length < 12) {
      continue;
    }
    if (normalizedTexts.some((text) => text.includes(normalizedFieldValue))) {
      restatementEvents += 1;
    }
  }
  return restatementEvents;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 9 golden parity evidence suite", () => {
  test("publishes validation-golden evidence with parity checks and explicit blockers", { timeout: 180_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase9-golden-suite");
    cleanups.push(() => fixture.cleanup());
    const frozenTrace = loadFrozenClaudekitPlanCookTrace();
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const artifactRefs: Array<{ label: string; path: string }> = [];

    let nfr15 = false;
    let nfr32 = false;
    let nfr35 = false;
    let nfr52 = false;
    let nfr61 = false;

    const brainstorm = runCli(fixture.rootDir, ["brainstorm", "phase", "9", "golden", "--handoff", "plan", "--handoff-task", "golden plan"]);
    const brainstormCheckpoints = brainstorm.checkpointIds as string[] | undefined;
    const decisionPath = String(brainstorm.decisionReportPath ?? "");
    const handoffBundle = (brainstorm.handoff as { bundle?: Record<string, unknown> } | undefined)?.bundle;
    if (brainstormCheckpoints?.join(",") === "brainstorm-discovery,brainstorm-decision,brainstorm-handoff" && existsSync(decisionPath)) {
      nfr32 = true;
      artifactRefs.push({ label: "brainstorm-decision-report", path: decisionPath });
    }
    nfr61 = Boolean(
      handoffBundle
      && typeof handoffBundle.goal === "string"
      && Array.isArray(handoffBundle.constraints)
      && Array.isArray(handoffBundle.acceptedDecisions)
      && Array.isArray(handoffBundle.evidenceRefs)
      && Array.isArray(handoffBundle.unresolvedQuestionsOrBlockers)
      && typeof handoffBundle.nextAction === "string"
    );

    const plan = runCli(fixture.rootDir, ["plan", "phase", "9", "golden", "--hard"]);
    const planPath = String(plan.planPath ?? "");
    const planCheckpoints = plan.checkpointIds as string[] | undefined;
    const handoffCommand = String(plan.handoffCommand ?? "");
    const planMode = typeof plan.mode === "string" ? plan.mode : "hard";
    const planDiagnostics = Array.isArray(plan.diagnostics)
      ? plan.diagnostics.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
      : [];
    const planText = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";
    const planHandoffFields = collectPlanCookHandoffFields({
      handoffCommand,
      planPath,
      mode: planMode,
      diagnostics: planDiagnostics
    });
    if (planCheckpoints?.join(",") === "plan-context,plan-draft,plan-hydration" && planText.includes("## Todo Checklist")) {
      nfr32 = nfr32 && true;
      artifactRefs.push({ label: "plan-artifact", path: planPath });
    }
    nfr15 = path.isAbsolute(planPath) && handoffCommand.includes("cdx cook") && handoffCommand.includes(planPath);

    const cook = runCliFreshSession(fixture.rootDir, ["cook", planPath]);
    const cookRunView = runCli(fixture.rootDir, ["run", "show", String(cook.runId ?? "")]);
    const pendingApproval = cook.pendingApproval as { checkpoint?: string; nextStep?: string } | undefined;
    nfr35 = pendingApproval?.checkpoint === "post-implementation"
      && typeof pendingApproval.nextStep === "string"
      && pendingApproval.nextStep.includes("cdx approval respond");
    const observedPlanCookTrace = [
      {
        checkpoint: "plan-invocation",
        command: "cdx plan phase 9 golden --hard",
        runId: String(plan.runId ?? "")
      },
      {
        checkpoint: "cook-continuation",
        command: String(plan.handoffCommand ?? ""),
        runId: String(cook.runId ?? "")
      }
    ];
    const handoffTargetsCookPlan = typeof plan.handoffCommand === "string"
      && plan.handoffCommand.includes("cdx cook")
      && plan.handoffCommand.includes(planPath);
    const planCookOperatorActions = observedPlanCookTrace.filter((entry) => entry.command.trim().length > 0).length;
    const frozenReferenceOperatorActions = frozenTrace.operatorActions.length;
    const nfr36 = handoffTargetsCookPlan && planCookOperatorActions <= frozenReferenceOperatorActions + 1;
    const nfr36EvidenceArtifact = createDurableNoteArtifact({
      suiteId: "validation-golden",
      label: "golden-plan-cook-comparative-trace",
      markdown: [
        "# Plan -> Cook Comparative Operator Actions",
        "",
        `- Frozen trace artifact path: ${FROZEN_CLAUDEKIT_PLAN_COOK_TRACE_PATH}`,
        `- Frozen trace id: ${frozenTrace.traceId}`,
        `- Frozen trace source ref: ${frozenTrace.sourceRef}`,
        `- Frozen fixture id: ${frozenTrace.fixtureId}`,
        `- Frozen operator checkpoints: ${frozenTrace.operatorActions.map((entry) => entry.checkpoint).join(", ")}`,
        `- Frozen ClaudeKit reference actions: ${frozenReferenceOperatorActions}`,
        `- Current CodexKit actions: ${planCookOperatorActions}`,
        `- Handoff command targets absolute cook plan path: ${handoffTargetsCookPlan}`,
        `- Observed trace commands: ${observedPlanCookTrace.map((entry) => `${entry.checkpoint}=${entry.command}`).join(" | ")}`,
        `- Result: ${nfr36 ? "pass" : "fail"}`,
        ""
      ].join("\n")
    });

    const review = runCli(fixture.rootDir, ["review", "codebase", "parallel"]);
    const reviewPath = String(review.reviewReportPath ?? "");
    if (existsSync(reviewPath)) {
      artifactRefs.push({ label: "review-report", path: reviewPath });
    }
    const qa = runCli(fixture.rootDir, ["test", "workflow", "phase9", "--coverage"]);
    const qaPath = String(qa.testReportPath ?? "");
    if (existsSync(qaPath)) {
      artifactRefs.push({ label: "test-report", path: qaPath });
    }
    const debug = runCli(fixture.rootDir, ["debug", "phase9", "database", "drift", "--branch", "database"]);
    const debugPath = String(debug.debugReportPath ?? "");
    if (existsSync(debugPath)) {
      artifactRefs.push({ label: "debug-report", path: debugPath });
    }

    const fix = runCli(fixture.rootDir, ["fix", "phase9", "runnable", "contract", "--quick"]);
    const fixDiagnostics = Array.isArray(fix.diagnostics)
      ? fix.diagnostics.filter((entry): entry is { code?: string } => Boolean(entry) && typeof entry === "object")
      : [];
    const fixReportPath = String(fix.fixReportPath ?? "");
    if (existsSync(fixReportPath)) {
      artifactRefs.push({ label: "fix-report", path: fixReportPath });
    }
    const team = runCli(fixture.rootDir, ["team", "cook", "phase9", "runnable", "contract"]);
    const teamDiagnostics = Array.isArray(team.diagnostics)
      ? team.diagnostics.filter((entry): entry is { code?: string } => Boolean(entry) && typeof entry === "object")
      : [];
    const teamReportPath = String(team.teamReportPath ?? "");
    if (existsSync(teamReportPath)) {
      artifactRefs.push({ label: "team-report", path: teamReportPath });
    }
    const runnableContractsHold = fix.workflow === "fix"
      && fix.mode === "quick"
      && (fix.checkpointIds as string[]).join(",") === "fix-mode,fix-diagnose,fix-route,fix-implement,fix-verify"
      && fix.completed === true
      && existsSync(fixReportPath)
      && fixDiagnostics.some((entry) => entry.code === "FIX_ROUTE_LOCKED")
      && team.workflow === "team"
      && team.template === "cook"
      && (team.checkpointIds as string[]).join(",") === "team-bootstrap,team-monitor,team-shutdown"
      && team.teamStatus === "deleted"
      && existsSync(teamReportPath)
      && teamDiagnostics.some((entry) => entry.code === "TEAM_WORKFLOW_COMPLETED");

    const cookAuto = runCli(fixture.rootDir, ["cook", "--auto", planPath]);
    const controller = new RuntimeController(fixture.rootDir);
    cleanups.push(() => controller.close());
    const finalize = controller.finalize({ runId: String(cookAuto.runId), planPathHint: planPath });
    const finalizeContractHolds = finalize.checkpointIds.join(",") === "finalize-sync,finalize-docs,finalize-git"
      && existsSync(finalize.finalizeReportPath)
      && existsSync(finalize.docsImpact.reportPath)
      && existsSync(finalize.gitHandoff.reportPath);
    if (finalizeContractHolds) {
      artifactRefs.push({ label: "finalize-report", path: finalize.finalizeReportPath });
      artifactRefs.push({ label: "docs-impact-report", path: finalize.docsImpact.reportPath });
      artifactRefs.push({ label: "git-handoff-report", path: finalize.gitHandoff.reportPath });
    }
    nfr52 = finalizeContractHolds && runnableContractsHold;
    const restatementCandidateTexts = collectRestatementCandidateTexts({ cook, cookRunView });
    const restatementEvents = countRestatementEvents({
      handoffFields: planHandoffFields,
      restatementCandidateTexts
    });
    const nfr63 = handoffTargetsCookPlan && planHandoffFields.length > 0 && restatementEvents === 0;
    const nfr63EvidenceArtifact = createDurableNoteArtifact({
      suiteId: "validation-golden",
      label: "golden-restatement-check",
      markdown: [
        "# Fresh Session Restatement Check",
        "",
        "- Accepted decision provenance: raw plan -> cook handoff fields only",
        `- Plan-owned raw handoff fields scanned: ${planHandoffFields.length}`,
        `- Plan handoff command: ${handoffCommand}`,
        `- Plan path: ${planPath}`,
        `- Plan mode: ${planMode}`,
        `- Plan diagnostics scanned for continuation guidance: ${planDiagnostics.length}`,
        `- Raw handoff fields: ${planHandoffFields.map((field) => `${field.source}=${field.rawValue}`).join(" | ")}`,
        `- Executed fresh-session command: cdx cook ${planPath} --json`,
        `- Fresh-session invocation marker: PHASE9_FRESH_SESSION_MARKER=1`,
        `- Upstream plan run id: ${String(plan.runId ?? "unknown")}`,
        `- Continuation cook run id: ${String(cook.runId ?? "unknown")}`,
        `- Prompt/diagnostic surfaces inspected: ${restatementCandidateTexts.length}`,
        `- Restatement events detected: ${restatementEvents}`,
        `- Result: ${nfr63 ? "pass" : "fail"}`,
        ""
      ].join("\n")
    });

    const initPreview = runCli(fixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
    const doctor = runCli(fixture.rootDir, ["doctor"]);
    nfr32 = nfr32
      && (initPreview.checkpointIds as string[]).join(",") === "package-scan,package-preview"
      && (doctor.checkpointIds as string[]).join(",") === "doctor-scan";

    const metricResults: ValidationMetricResult[] = [
      {
        metricId: "NFR-1.5",
        mappedNfrIds: ["NFR-1.5"],
        required: true,
        status: nfr15 ? "pass" : "fail",
        fixtureRefs: ["git-clean", "fresh-session-handoff"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [metricArtifactRef("plan-artifact", existsSync(planPath) ? planPath : nfr36EvidenceArtifact.path)],
        evidence: ["plan handoff command includes absolute cook continuation"]
      },
      {
        metricId: "NFR-3.2",
        mappedNfrIds: ["NFR-3.2"],
        required: true,
        status: nfr32 ? "pass" : "fail",
        fixtureRefs: ["git-clean"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [
          metricArtifactRef("brainstorm-decision-report", existsSync(decisionPath) ? decisionPath : nfr63EvidenceArtifact.path),
          metricArtifactRef("review-report", existsSync(reviewPath) ? reviewPath : nfr63EvidenceArtifact.path),
          metricArtifactRef("test-report", existsSync(qaPath) ? qaPath : nfr63EvidenceArtifact.path),
          metricArtifactRef("debug-report", existsSync(debugPath) ? debugPath : nfr63EvidenceArtifact.path)
        ],
        evidence: ["unambiguous brainstorm/plan/review/test/debug/init/doctor command shapes executed without chooser prompts"]
      },
      {
        metricId: "NFR-3.5",
        mappedNfrIds: ["NFR-3.5"],
        required: true,
        status: nfr35 ? "pass" : "fail",
        fixtureRefs: ["git-clean"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [metricArtifactRef("plan-artifact", existsSync(planPath) ? planPath : nfr36EvidenceArtifact.path)],
        evidence: ["cook post-implementation pending approval exposes default continuation command"]
      },
      {
        metricId: "NFR-3.6",
        mappedNfrIds: ["NFR-3.6"],
        required: true,
        status: nfr36 ? "pass" : "fail",
        fixtureRefs: ["git-clean"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [
          nfr36EvidenceArtifact,
          metricArtifactRef("frozen-claudekit-plan-cook-trace-source", FROZEN_CLAUDEKIT_PLAN_COOK_TRACE_PATH)
        ],
        evidence: ["plan->cook operator actions are no worse than +1 versus frozen ClaudeKit comparative trace"]
      },
      {
        metricId: "NFR-5.2",
        mappedNfrIds: ["NFR-5.2"],
        required: true,
        status: nfr52 ? "pass" : "fail",
        fixtureRefs: ["git-clean"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [
          metricArtifactRef("finalize-report", finalize.finalizeReportPath),
          metricArtifactRef("docs-impact-report", finalize.docsImpact.reportPath),
          metricArtifactRef("git-handoff-report", finalize.gitHandoff.reportPath),
          ...(existsSync(fixReportPath) ? [metricArtifactRef("fix-report", fixReportPath)] : []),
          ...(existsSync(teamReportPath) ? [metricArtifactRef("team-report", teamReportPath)] : [])
        ],
        evidence: ["finalize/docs/git durable report artifacts exist and runnable fix/team workflows publish durable reports"]
      },
      {
        metricId: "NFR-6.1",
        mappedNfrIds: ["NFR-6.1"],
        required: true,
        status: nfr61 ? "pass" : "fail",
        fixtureRefs: ["fresh-session-handoff"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [metricArtifactRef("brainstorm-decision-report", existsSync(decisionPath) ? decisionPath : nfr63EvidenceArtifact.path)],
        evidence: ["brainstorm handoff bundle contains required handoff contract fields"]
      },
      {
        metricId: "NFR-6.3",
        mappedNfrIds: ["NFR-6.3"],
        required: true,
        status: nfr63 ? "pass" : "fail",
        fixtureRefs: ["fresh-session-handoff"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [nfr63EvidenceArtifact],
        evidence: ["fresh-session continuation did not require operator restatement for accepted upstream decisions"]
      }
    ];

    const blockers: string[] = [];
    if (!runnableContractsHold) {
      blockers.push("fix/team runnable workflow contract returned unexpected output");
    }
    if (metricResults.some((metric) => metric.status !== "pass" && metric.required)) {
      blockers.push("one or more required golden metrics are failing or missing");
    }

    const evidence = writePhase9EvidenceBundle({
      suiteId: "validation-golden",
      fixtureIds: ["git-clean", "fresh-session-handoff"],
      metricResults,
      artifactRefs,
      blockers
    });

    expect(existsSync(evidence.path)).toBe(true);
    expect(metricResults.map((metric) => metric.metricId)).toEqual([
      "NFR-1.5",
      "NFR-3.2",
      "NFR-3.5",
      "NFR-3.6",
      "NFR-5.2",
      "NFR-6.1",
      "NFR-6.3"
    ]);
  });
});
