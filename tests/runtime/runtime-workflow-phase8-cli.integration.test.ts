import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseCliFailure } from "./helpers/cli-json.ts";
import { createGitRuntimeFixture, createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env: process.env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliWithEnv(rootDir: string, args: string[], env: NodeJS.ProcessEnv) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliFailure(rootDir: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  try {
    runCliWithEnv(rootDir, args, env);
    throw new Error("expected CLI failure");
  } catch (error) {
    return parseCliFailure(error);
  }
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 8 CLI workflow contracts", () => {
  test(
    "supports init, doctor, and update with preview-first and protected-path gating",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase8-cli-packaging");
      cleanups.push(() => fixture.cleanup());
      const customReadme = "# custom fixture readme\nDo not overwrite.\n";
      const unmanagedPath = path.join(fixture.rootDir, "notes.keep.txt");
      writeFileSync(path.join(fixture.rootDir, "README.md"), customReadme, "utf8");
      writeFileSync(unmanagedPath, "keep me\n", "utf8");
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const updateBeforeInit = runCli(fixture.rootDir, ["update"]);
      expect(updateBeforeInit.workflow).toBe("update");
      expect(updateBeforeInit.checkpointIds).toEqual(["update-scan", "update-preview"]);
      expect((updateBeforeInit.diagnostics as Array<{ code: string }>).some((item) => item.code === "UPDATE_NOT_INSTALLED")).toBe(true);

      const initPreviewWithoutApprovals = runCli(fixture.rootDir, ["init"]);
      expect(initPreviewWithoutApprovals.workflow).toBe("init");
      const initBlockedActions = initPreviewWithoutApprovals.blockedActions as Array<{ code: string; path?: string }>;
      expect(
        initBlockedActions.some((entry) => entry.code === "APPROVAL_REQUIRED_PROTECTED_PATH" && entry.path === "AGENTS.md")
      ).toBe(true);
      expect(
        initBlockedActions.some((entry) => entry.code === "APPROVAL_REQUIRED_PROTECTED_PATH" && entry.path === ".codex/config.toml")
      ).toBe(true);

      const initApplyWithoutPreview = runCli(fixture.rootDir, [
        "init",
        "--apply",
        "--approve-protected",
        "--approve-managed-overwrite"
      ]);
      expect(initApplyWithoutPreview.workflow).toBe("init");
      expect(initApplyWithoutPreview.applyExecuted).toBe(false);
      expect(
        (initApplyWithoutPreview.blockedActions as Array<{ code: string }>).some((entry) => entry.code === "INIT_APPLY_REQUIRES_PREVIEW")
      ).toBe(true);

      const initPreview = runCli(fixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
      expect(initPreview.workflow).toBe("init");
      expect(initPreview.checkpointIds).toEqual(["package-scan", "package-preview"]);
      expect(initPreview.applyExecuted).toBe(false);
      expect(initPreview.runnerSource).toBe("default");
      expect(initPreview.runnerCommand).toBe("codex exec");
      expect(existsSync(String(initPreview.initReportPath))).toBe(true);
      expect(existsSync(String(initPreview.migrationAssistantReportPath))).toBe(true);

      const initApply = runCli(fixture.rootDir, [
        "init",
        "--apply",
        "--approve-protected",
        "--approve-managed-overwrite"
      ]);
      expect(initApply.workflow).toBe("init");
      expect(initApply.applyExecuted).toBe(true);
      expect(existsSync(path.join(fixture.rootDir, "AGENTS.md"))).toBe(true);
      expect(existsSync(path.join(fixture.rootDir, ".codex", "config.toml"))).toBe(true);
      expect(existsSync(path.join(fixture.rootDir, ".codexkit", "state", "install-state.json"))).toBe(true);
      expect(existsSync(path.join(fixture.rootDir, ".codexkit", "manifests", "release-manifest.json"))).toBe(true);
      expect(readFileSync(path.join(fixture.rootDir, "README.md"), "utf8")).toBe(customReadme);
      expect(readFileSync(unmanagedPath, "utf8")).toBe("keep me\n");
      const migrationAssistantReport = readFileSync(String(initPreview.migrationAssistantReportPath), "utf8");
      expect(migrationAssistantReport).toContain("## Detected Source Kit Markers");
      expect(migrationAssistantReport).toContain("## Required Install Or Upgrade Actions");
      expect(migrationAssistantReport).toContain("## Risky Customizations Needing Manual Review");
      expect(migrationAssistantReport).toContain("## Recommended Next Command Sequence");

      const doctor = runCli(fixture.rootDir, ["doctor"]);
      expect(doctor.workflow).toBe("doctor");
      expect(doctor.checkpointIds).toEqual(["doctor-scan"]);
      expect(doctor.runnerSource).toBe("default");
      expect(doctor.runnerCommand).toBe("codex exec");
      expect(typeof doctor.runnerAvailable).toBe("boolean");
      expect(existsSync(String(doctor.doctorReportPath))).toBe(true);
      expect(existsSync(String(doctor.migrationAssistantReportPath))).toBe(true);

      writeFileSync(path.join(fixture.rootDir, "AGENTS.md"), "# local customization\n", "utf8");
      writeFileSync(path.join(fixture.rootDir, ".codex", "config.toml"), "[custom]\nmode = \"local\"\n", "utf8");
      const updatePreview = runCli(fixture.rootDir, ["update"]);
      expect(updatePreview.workflow).toBe("update");
      expect(updatePreview.checkpointIds).toEqual(["update-scan", "update-preview"]);
      expect(existsSync(String(updatePreview.updateReportPath))).toBe(true);
      expect(existsSync(String(updatePreview.migrationAssistantReportPath))).toBe(true);
      const updateBlockedActions = updatePreview.blockedActions as Array<{ code: string; path?: string }>;
      expect(
        updateBlockedActions.some((entry) => entry.code === "APPROVAL_REQUIRED_PROTECTED_PATH" && entry.path === "AGENTS.md")
      ).toBe(true);
      expect(
        updateBlockedActions.some((entry) => entry.code === "APPROVAL_REQUIRED_PROTECTED_PATH" && entry.path === ".codex/config.toml")
      ).toBe(true);

      const updateApplyWithoutPreview = runCli(fixture.rootDir, [
        "update",
        "--apply",
        "--approve-protected",
        "--approve-managed-overwrite"
      ]);
      expect(updateApplyWithoutPreview.workflow).toBe("update");
      expect(updateApplyWithoutPreview.applyExecuted).toBe(false);
      expect(
        (updateApplyWithoutPreview.blockedActions as Array<{ code: string }>).some((entry) => entry.code === "UPDATE_APPLY_REQUIRES_PREVIEW")
      ).toBe(true);

      const updatePreviewWithApprovals = runCli(fixture.rootDir, ["update", "--approve-protected", "--approve-managed-overwrite"]);
      expect(updatePreviewWithApprovals.workflow).toBe("update");
      expect(updatePreviewWithApprovals.applyExecuted).toBe(false);

      const updateApply = runCli(fixture.rootDir, ["update", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
      expect(updateApply.workflow).toBe("update");
      expect(updateApply.applyExecuted).toBe(true);
      expect(readFileSync(unmanagedPath, "utf8")).toBe("keep me\n");

      rmSync(path.join(fixture.rootDir, ".codexkit", "manifests", "import-registry.json"), { force: true });
      const doctorAfterRegistryDrift = runCli(fixture.rootDir, ["doctor"]);
      expect(doctorAfterRegistryDrift.workflow).toBe("doctor");
      expect(
        (doctorAfterRegistryDrift.findings as Array<{ code: string }>).some((item) => item.code === "DOCTOR_IMPORT_REGISTRY_MISSING")
      ).toBe(true);
    }
  );

  test(
    "resume hardening surfaces pending approvals and one explicit continuation command",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase8-cli-resume");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook", "--prompt", "resume contract"]);
      const runId = String(run.id);
      const approval = runCli(fixture.rootDir, [
        "approval",
        "request",
        "--run",
        runId,
        "--checkpoint",
        "post-plan",
        "--question",
        "Continue?",
        "--option",
        "approve:Approve",
        "--option",
        "revise:Revise",
        "--option",
        "abort:Abort"
      ]);
      const approvalId = String(approval.id);

      const resume = runCli(fixture.rootDir, ["resume", runId]);
      expect(resume.workflow).toBe("resume");
      expect(resume.checkpointIds).toEqual(["resume-select", "resume-recover"]);
      expect(resume.recoveredRunId).toBe(runId);
      expect((resume.pendingApprovals as Array<{ id: string }>).some((entry) => entry.id === approvalId)).toBe(true);
      expect(String(resume.continuationCommand)).toContain(`cdx approval respond ${approvalId}`);
      expect(existsSync(String(resume.resumeReportPath))).toBe(true);
    }
  );

  test(
    "blocks worker-backed workflows on install-only repos until the first commit exists",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase8-install-only-block");
      cleanups.push(() => fixture.cleanup());
      execFileSync("git", ["init"], { cwd: fixture.rootDir });
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      runCli(fixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
      const initApply = runCli(fixture.rootDir, ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
      expect(initApply.workflow).toBe("init");
      expect(initApply.installOnly).toBe(true);

      for (const args of [["cook"], ["review"], ["test"], ["debug", "install-only gate"]]) {
        const blocked = runCliFailure(fixture.rootDir, args);
        expect(blocked.code).toBe("WORKFLOW_BLOCKED");
        expect((blocked.details as { code?: string }).code).toBe("WF_INSTALL_ONLY_REPO_BLOCKED");
      }
    }
  );

  test(
    "doctor surfaces explicit host-capability blocks and stale or broken install findings",
    { timeout: 120_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase8-doctor-diagnostics");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      runCli(fixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
      runCli(fixture.rootDir, ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"]);

      const installStatePath = path.join(fixture.rootDir, ".codexkit", "state", "install-state.json");
      const installState = JSON.parse(readFileSync(installStatePath, "utf8")) as Record<string, unknown>;
      installState.sourceRegistryPath = ".codexkit/manifests/import-registry-drift.json";
      writeFileSync(installStatePath, `${JSON.stringify(installState, null, 2)}\n`, "utf8");
      rmSync(path.join(fixture.rootDir, ".codexkit", "manifests", "release-manifest.json"), { force: true });
      writeFileSync(path.join(fixture.rootDir, ".codexkit", "state", "daemon.lock"), "stale-lock\n", "utf8");

      const doctor = runCli(fixture.rootDir, ["doctor"]);
      const findings = doctor.findings as Array<{ code: string }>;
      expect(findings.some((finding) => finding.code === "DOCTOR_IMPORT_REGISTRY_PATH_DRIFT")).toBe(true);
      expect(findings.some((finding) => finding.code === "DOCTOR_IMPORT_REGISTRY_MISSING")).toBe(true);
      expect(findings.some((finding) => finding.code === "DOCTOR_RELEASE_MANIFEST_MISSING")).toBe(true);
      expect(findings.some((finding) => finding.code === "DOCTOR_DAEMON_LOCK_STALE")).toBe(true);

      const doctorWithInvalidRunner = runCliWithEnv(fixture.rootDir, ["doctor"], {
        ...process.env,
        CODEXKIT_RUNNER: "definitely-not-a-real-runner --version"
      });
      expect(doctorWithInvalidRunner.status).toBe("blocked");
      expect(
        (doctorWithInvalidRunner.findings as Array<{ code: string; severity: string }>).some(
          (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_UNAVAILABLE" && finding.severity === "error"
        )
      ).toBe(true);
      expect(doctorWithInvalidRunner.runnerSource).toBe("env-override");
      expect(doctorWithInvalidRunner.runnerCommand).toBe("definitely-not-a-real-runner --version");
      expect(doctorWithInvalidRunner.runnerAvailable).toBe(false);

      let filteredPath = process.env.PATH ?? "";
      try {
        const codexBinary = execFileSync("which", ["codex"], { encoding: "utf8" }).trim();
        const codexDir = path.dirname(codexBinary);
        filteredPath = filteredPath
          .split(path.delimiter)
          .filter((segment) => path.resolve(segment) !== path.resolve(codexDir))
          .join(path.delimiter);
      } catch {
        // Codex may already be unavailable in PATH; keep current PATH as-is.
      }
      const doctorWithHostGap = runCliWithEnv(fixture.rootDir, ["doctor"], {
        ...process.env,
        PATH: filteredPath
      });
      expect(doctorWithHostGap.status).toBe("blocked");
      expect(
        (doctorWithHostGap.findings as Array<{ code: string; severity: string }>).some(
          (finding) => finding.code === "DOCTOR_SELECTED_RUNNER_UNAVAILABLE" && finding.severity === "error"
        )
      ).toBe(true);
      expect(doctorWithHostGap.runnerSource).toBe("default");
      expect(doctorWithHostGap.runnerCommand).toBe("codex exec");
      expect(doctorWithHostGap.runnerAvailable).toBe(false);
    }
  );

  test(
    "resume surfaces one concrete next action when recovery is reclaim-blocked",
    { timeout: 130_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase8-reclaim-block");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook", "--prompt", "resume reclaim"]);
      const runId = String(run.id);
      const task = runCli(fixture.rootDir, [
        "task",
        "create",
        "--run",
        runId,
        "--role",
        "tester",
        "--subject",
        "stale claim fixture task"
      ]);
      runCli(fixture.rootDir, [
        "worker",
        "spawn",
        "--run",
        runId,
        "--task",
        String(task.id),
        "--role",
        "tester",
        "--display-name",
        "phase8 stale worker"
      ]);

      await new Promise((resolve) => setTimeout(resolve, 31_000));

      const resume = runCli(fixture.rootDir, ["resume", runId]);
      expect(resume.workflow).toBe("resume");
      expect((resume.reclaimCandidates as Array<unknown>).length).toBeGreaterThan(0);
      expect((resume.diagnostics as Array<{ code: string }>).some((item) => item.code === "RESUME_RECLAIM_BLOCKED")).toBe(true);
      expect(String(resume.continuationCommand)).toContain("cdx daemon start --once && cdx resume");
    }
  );

  test(
    "resume returns explicit cook continuation after cdx plan",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase8-resume-plan-run");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const plan = runCli(fixture.rootDir, ["plan", "phase8 continuation contract"]);
      const runId = String(plan.runId);
      const planPath = String(plan.planPath);
      const resume = runCli(fixture.rootDir, ["resume", runId]);

      expect(resume.workflow).toBe("resume");
      expect(resume.recoveredRunId).toBe(runId);
      expect(String(resume.continuationCommand)).toContain("cdx cook");
      expect(String(resume.continuationCommand)).toContain(planPath);
      expect(String(resume.continuationCommand)).not.toContain("cdx run show");
    }
  );

  test(
    "invalidates init and update preview tokens when previewed payload changes",
    { timeout: 120_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase8-preview-payload-token");
      let fixtureRoot = fixture.rootDir;
      cleanups.push(() => rmSync(fixtureRoot, { recursive: true, force: true }));
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const initPreview = runCli(fixture.rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
      expect(initPreview.applyExecuted).toBe(false);

      const renamedRoot = `${fixture.rootDir}-renamed-a`;
      renameSync(fixture.rootDir, renamedRoot);
      fixtureRoot = renamedRoot;

      const initApplyAfterRename = runCli(renamedRoot, [
        "init",
        "--apply",
        "--approve-protected",
        "--approve-managed-overwrite"
      ]);
      expect(initApplyAfterRename.applyExecuted).toBe(false);
      expect(
        (initApplyAfterRename.blockedActions as Array<{ code: string }>).some((entry) => entry.code === "INIT_APPLY_REQUIRES_PREVIEW")
      ).toBe(true);

      runCli(renamedRoot, ["init", "--approve-protected", "--approve-managed-overwrite"]);
      const initApply = runCli(renamedRoot, ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
      expect(initApply.applyExecuted).toBe(true);

      rmSync(path.join(renamedRoot, "README.md"), { force: true });
      const updatePreview = runCli(renamedRoot, ["update", "--approve-protected", "--approve-managed-overwrite"]);
      expect(updatePreview.applyExecuted).toBe(false);

      const renamedRootAgain = `${renamedRoot}-renamed-b`;
      renameSync(renamedRoot, renamedRootAgain);
      fixtureRoot = renamedRootAgain;

      const updateApplyAfterRename = runCli(renamedRootAgain, ["update", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
      expect(updateApplyAfterRename.applyExecuted).toBe(false);
      expect(
        (updateApplyAfterRename.blockedActions as Array<{ code: string }>).some((entry) => entry.code === "UPDATE_APPLY_REQUIRES_PREVIEW")
      ).toBe(true);
    }
  );

  test(
    "resume emits explicit plan-path continuation command when re-entry is required",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase8-resume-plan-path");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const planPath = path.join(fixture.rootDir, "plan.md");
      writeFileSync(planPath, "# plan fixture\n", "utf8");
      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook", "--prompt", planPath]);
      const runId = String(run.id);

      const resume = runCli(fixture.rootDir, ["resume", runId]);
      expect(resume.workflow).toBe("resume");
      expect(resume.recoveredRunId).toBe(runId);
      expect(String(resume.continuationCommand)).toContain("cdx cook");
      expect(String(resume.continuationCommand)).toContain(planPath);
    }
  );
});
