import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { createGitRuntimeFixture, createRuntimeFixture } from "./helpers/runtime-fixture.ts";
import {
  installPackedCliArtifact,
  packCliArtifactForSmoke,
  runInstalledCli,
  runInstalledCliFailure,
  type InstalledCliArtifact,
  type PackedCliArtifact
} from "./helpers/phase10-packaged-artifact-smoke.ts";

const cleanups: Array<() => Promise<void> | void> = [];
let packed: PackedCliArtifact;

function stableRunnerCommand(): string {
  return `"${process.execPath.replace(/"/g, "\\\"")}" --version`;
}

function withStableRunner(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...env,
    CODEXKIT_RUNNER: stableRunnerCommand()
  };
}

function writeWrappedRunner(rootDir: string): { pathEnv: string; runnerCommand: string } {
  const binDir = path.join(path.resolve(rootDir), ".tmp", "wrapper-bin");
  const wrapperPath = path.join(binDir, "codex-safe");
  mkdirSync(binDir, { recursive: true });
  writeFileSync(wrapperPath, "#!/bin/sh\nexit 0\n", "utf8");
  chmodSync(wrapperPath, 0o755);
  return {
    pathEnv: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    runnerCommand: "codex-safe exec --profile beta"
  };
}

function initializeGitRepoWithoutCommit(rootDir: string): void {
  execFileSync("git", ["init"], { cwd: rootDir });
  execFileSync("git", ["config", "user.name", "CodexKit Test"], { cwd: rootDir });
  execFileSync("git", ["config", "user.email", "codexkit-test@example.com"], { cwd: rootDir });
}

function writeRunnerConfig(rootDir: string, runnerCommand: string): void {
  const configDir = path.join(path.resolve(rootDir), ".codexkit");
  mkdirSync(configDir, { recursive: true });
  const escapedCommand = runnerCommand.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  writeFileSync(
    path.join(configDir, "config.toml"),
    `schema_version = 1\nmanaged_by = "codexkit"\n\n[runner]\ncommand = "${escapedCommand}"\n`,
    "utf8"
  );
}

function assertPackagedExecutionEvidence(result: Record<string, unknown>, install: InstalledCliArtifact): void {
  expect(result.packagedTarballPath).toBe(install.tarballPath);
  expect(result.packagedInstallRoot).toBe(install.installRoot);
  expect(result.packagedInstalledBinPath).toBe(install.installedBinPath);
  expect(result.packagedResolvedBinPath).toBe(install.resolvedInstalledBinPath);
  expect(result.fallbackToRepoCdx).toBe(false);
  const repoLocalCdx = path.resolve(process.cwd(), "cdx");
  expect(path.resolve(install.installedBinPath)).not.toBe(repoLocalCdx);
  expect(path.resolve(install.resolvedInstalledBinPath)).not.toBe(repoLocalCdx);
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

beforeAll(() => {
  packed = packCliArtifactForSmoke();
}, 300_000);

afterAll(() => {
  packed.cleanup();
});

describe("phase 10 packaged-artifact smoke harness", () => {
  test("fresh repo packaged install proves init preview/apply, installOnly, and doctor through installed cdx bin", { timeout: 180_000 }, async () => {
    const fixture = await createRuntimeFixture("codexkit-phase10-p10-s4-fresh-artifact");
    cleanups.push(() => fixture.cleanup());
    initializeGitRepoWithoutCommit(fixture.rootDir);
    const install = installPackedCliArtifact(fixture.rootDir, packed.tarballPath);
    const env = withStableRunner(install.env);

    const initPreview = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--approve-protected", "--approve-managed-overwrite"],
      env
    );
    const initApply = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
      env
    );
    const doctor = runInstalledCli(fixture.rootDir, install, ["doctor"], env);
    assertPackagedExecutionEvidence(initPreview, install);
    assertPackagedExecutionEvidence(initApply, install);
    assertPackagedExecutionEvidence(doctor, install);

    expect(initPreview.workflow).toBe("init");
    expect(initPreview.applyExecuted).toBe(false);
    expect(initPreview.runnerSource).toBe("env-override");
    expect(String(initPreview.runnerCommand)).toContain("--version");

    expect(initApply.workflow).toBe("init");
    expect(initApply.applyExecuted).toBe(true);
    expect(initApply.runnerSource).toBe("env-override");
    expect(String(initApply.runnerCommand)).toContain("--version");
    expect(initApply.installOnly).toBe(true);

    expect(doctor.workflow).toBe("doctor");
    expect(doctor.runnerSource).toBe("env-override");
    expect(doctor.runnerAvailable).toBe(true);
    const doctorReportPath = String(doctor.doctorReportPath);
    expect(doctorReportPath.endsWith("doctor-report.md")).toBe(true);
    expect(existsSync(doctorReportPath)).toBe(true);
    const doctorReport = readFileSync(doctorReportPath, "utf8");
    expect(doctorReport).toContain("Active runner source: env-override");
    expect(doctorReport).toContain(`Active runner command: ${String(doctor.runnerCommand)}`);
  });

  test(
    "git-backed repo packaged install supports init -> doctor -> brainstorm -> plan -> cook quickstart",
    { timeout: 180_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase10-p10-s4-git-backed");
      cleanups.push(() => fixture.cleanup());
      const install = installPackedCliArtifact(fixture.rootDir, packed.tarballPath);
      const env = withStableRunner(install.env);

      const initPreview = runInstalledCli(
        fixture.rootDir,
        install,
        ["init", "--approve-protected", "--approve-managed-overwrite"],
        env
      );
      const initApply = runInstalledCli(
        fixture.rootDir,
        install,
        ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
        env
      );
      const doctor = runInstalledCli(fixture.rootDir, install, ["doctor"], env);
      const brainstorm = runInstalledCli(fixture.rootDir, install, ["brainstorm", "P10 S4 quickstart smoke"], env);
      const plan = runInstalledCli(fixture.rootDir, install, ["plan", "P10 S4 quickstart smoke"], env);
      const planPath = String(plan.planPath);
      const cook = runInstalledCli(fixture.rootDir, install, ["cook", planPath], env);
      assertPackagedExecutionEvidence(initPreview, install);
      assertPackagedExecutionEvidence(initApply, install);
      assertPackagedExecutionEvidence(doctor, install);
      assertPackagedExecutionEvidence(brainstorm, install);
      assertPackagedExecutionEvidence(plan, install);
      assertPackagedExecutionEvidence(cook, install);

      expect(initPreview.workflow).toBe("init");
      expect(initPreview.applyExecuted).toBe(false);
      expect(initApply.workflow).toBe("init");
      expect(initApply.applyExecuted).toBe(true);
      expect(initApply.installOnly).toBe(false);
      expect(doctor.workflow).toBe("doctor");
      expect(doctor.runnerSource).toBe("env-override");
      expect(doctor.runnerAvailable).toBe(true);
      expect(brainstorm.workflow).toBe("brainstorm");
      expect(plan.workflow).toBe("plan");
      expect(planPath.endsWith("plan.md")).toBe(true);
      expect(cook.workflow).toBe("cook");
      expect(cook.planPath).toBe(planPath);
    }
  );

  test("install-only repos remain gated for worker-backed workflows via packaged install", { timeout: 180_000 }, async () => {
    const fixture = await createRuntimeFixture("codexkit-phase10-p10-s4-install-only");
    cleanups.push(() => fixture.cleanup());
    initializeGitRepoWithoutCommit(fixture.rootDir);
    const install = installPackedCliArtifact(fixture.rootDir, packed.tarballPath);
    const env = withStableRunner(install.env);

    const initPreview = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--approve-protected", "--approve-managed-overwrite"],
      env
    );
    const initApply = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
      env
    );
    assertPackagedExecutionEvidence(initPreview, install);
    assertPackagedExecutionEvidence(initApply, install);
    expect(initApply.installOnly).toBe(true);

    for (const args of [["cook"], ["review"], ["test"], ["debug", "install-only gate"]]) {
      const blocked = runInstalledCliFailure(fixture.rootDir, install, args, env);
      assertPackagedExecutionEvidence(blocked, install);
      expect(blocked.code).toBe("WORKFLOW_BLOCKED");
      expect((blocked.details as { code?: string }).code).toBe("WF_INSTALL_ONLY_REPO_BLOCKED");
    }
  });

  test("wrapped-runner config-file and env-over-config precedence are proven through packaged install", { timeout: 180_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase10-p10-s4-wrapped-runner");
    cleanups.push(() => fixture.cleanup());
    const install = installPackedCliArtifact(fixture.rootDir, packed.tarballPath);
    const wrapper = writeWrappedRunner(fixture.rootDir);
    writeRunnerConfig(fixture.rootDir, wrapper.runnerCommand);
    const configEnv: NodeJS.ProcessEnv = {
      ...install.env,
      PATH: wrapper.pathEnv
    };
    const configInitPreview = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--approve-protected", "--approve-managed-overwrite"],
      configEnv
    );
    assertPackagedExecutionEvidence(configInitPreview, install);
    expect(configInitPreview.applyExecuted).toBe(false);
    expect(configInitPreview.runnerSource).toBe("config-file");
    expect(configInitPreview.runnerCommand).toBe(wrapper.runnerCommand);
    const configPreviewInitReportPath = String(configInitPreview.initReportPath);
    expect(configPreviewInitReportPath.endsWith("init-report.md")).toBe(true);
    expect(existsSync(configPreviewInitReportPath)).toBe(true);
    const configPreviewInitReport = readFileSync(configPreviewInitReportPath, "utf8");
    expect(configPreviewInitReport).toContain("Runner source: config-file");
    expect(configPreviewInitReport).toContain(`Runner command: ${String(configInitPreview.runnerCommand)}`);

    const configInitApply = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"],
      configEnv
    );
    writeRunnerConfig(fixture.rootDir, wrapper.runnerCommand);
    const configDoctor = runInstalledCli(fixture.rootDir, install, ["doctor"], configEnv);
    assertPackagedExecutionEvidence(configInitApply, install);
    assertPackagedExecutionEvidence(configDoctor, install);

    expect(configInitApply.runnerSource).toBe("config-file");
    expect(configInitApply.runnerCommand).toBe(wrapper.runnerCommand);
    expect(configDoctor.runnerSource).toBe("config-file");
    expect(configDoctor.runnerCommand).toBe(wrapper.runnerCommand);
    expect(configDoctor.runnerAvailable).toBe(true);
    const configApplyInitReportPath = String(configInitApply.initReportPath);
    expect(configApplyInitReportPath.endsWith("init-report.md")).toBe(true);
    expect(existsSync(configApplyInitReportPath)).toBe(true);
    const configApplyInitReport = readFileSync(configApplyInitReportPath, "utf8");
    expect(configApplyInitReport).toContain("Runner source: config-file");
    expect(configApplyInitReport).toContain(`Runner command: ${String(configInitApply.runnerCommand)}`);

    const envRunnerCommand = "codex-safe exec --profile \"beta lane\"";
    const envOverride: NodeJS.ProcessEnv = {
      ...configEnv,
      CODEXKIT_RUNNER: envRunnerCommand
    };
    const envInit = runInstalledCli(
      fixture.rootDir,
      install,
      ["init", "--approve-protected", "--approve-managed-overwrite"],
      envOverride
    );
    const envDoctor = runInstalledCli(
      fixture.rootDir,
      install,
      ["doctor"],
      envOverride
    );
    assertPackagedExecutionEvidence(envInit, install);
    assertPackagedExecutionEvidence(envDoctor, install);

    expect(envInit.runnerSource).toBe("env-override");
    expect(String(envInit.runnerCommand)).toContain("codex-safe exec --profile");
    expect(String(envInit.runnerCommand)).toContain("beta lane");
    expect(envDoctor.runnerSource).toBe("env-override");
    expect(String(envDoctor.runnerCommand)).toContain("codex-safe exec --profile");
    expect(String(envDoctor.runnerCommand)).toContain("beta lane");
    expect(envDoctor.runnerAvailable).toBe(true);
    const envInitReportPath = String(envInit.initReportPath);
    expect(envInitReportPath.endsWith("init-report.md")).toBe(true);
    expect(existsSync(envInitReportPath)).toBe(true);
    const envInitReport = readFileSync(envInitReportPath, "utf8");
    expect(envInitReport).toContain("Runner source: env-override");
    expect(envInitReport).toContain(`Runner command: ${String(envInit.runnerCommand)}`);

    const configDoctorReportPath = String(configDoctor.doctorReportPath);
    expect(existsSync(configDoctorReportPath)).toBe(true);
    const configDoctorReport = readFileSync(configDoctorReportPath, "utf8");
    expect(configDoctorReport).toContain("Active runner source: config-file");
    expect(configDoctorReport).toContain(`Active runner command: ${wrapper.runnerCommand}`);

    const envDoctorReportPath = String(envDoctor.doctorReportPath);
    expect(existsSync(envDoctorReportPath)).toBe(true);
    const envDoctorReport = readFileSync(envDoctorReportPath, "utf8");
    expect(envDoctorReport).toContain("Active runner source: env-override");
    expect(envDoctorReport).toContain(`Active runner command: ${String(envDoctor.runnerCommand)}`);
    expect(envDoctorReport).toContain("codex-safe exec --profile");
    expect(envDoctorReport).toContain("beta lane");
  });
});
