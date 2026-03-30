import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createGitRuntimeFixture, createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[], env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function readReport(reportPath: unknown): string {
  return readFileSync(String(reportPath), "utf8");
}

async function createInstallOnlyGitFixture(prefix: string) {
  const fixture = await createRuntimeFixture(prefix);
  execFileSync("git", ["init"], { cwd: fixture.rootDir });
  execFileSync("git", ["config", "user.name", "CodexKit Test"], { cwd: fixture.rootDir });
  execFileSync("git", ["config", "user.email", "codexkit-test@example.com"], { cwd: fixture.rootDir });
  return fixture;
}

function runInitPreviewAndApply(rootDir: string): Record<string, unknown> {
  runCli(rootDir, ["init", "--approve-protected", "--approve-managed-overwrite"]);
  return runCli(rootDir, ["init", "--apply", "--approve-protected", "--approve-managed-overwrite"]);
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 10 onboarding emitted-artifact contract", () => {
  test("init-report next steps follow public onboarding path and never default to resume", { timeout: 90_000 }, async () => {
    const gitBacked = await createGitRuntimeFixture("codexkit-phase10-init-onboarding-git-backed");
    cleanups.push(() => gitBacked.cleanup());
    runCli(gitBacked.rootDir, ["daemon", "start", "--once"]);
    const gitBackedInitApply = runInitPreviewAndApply(gitBacked.rootDir);
    const gitBackedInitReport = readReport(gitBackedInitApply.initReportPath);
    expect(gitBackedInitReport).toContain("## Next Steps");
    expect(gitBackedInitReport).toContain("- Run cdx doctor (or npx @codexkit/cli doctor).");
    expect(gitBackedInitReport).toContain("- Start onboarding flow: cdx brainstorm <task> -> cdx plan <task> -> cdx cook <absolute-plan-path>.");
    expect(gitBackedInitReport).not.toContain("cdx resume");

    const installOnly = await createInstallOnlyGitFixture("codexkit-phase10-init-onboarding-install-only");
    cleanups.push(() => installOnly.cleanup());
    runCli(installOnly.rootDir, ["daemon", "start", "--once"]);
    const installOnlyInitApply = runInitPreviewAndApply(installOnly.rootDir);
    expect(installOnlyInitApply.installOnly).toBe(true);
    const installOnlyInitReport = readReport(installOnlyInitApply.initReportPath);
    expect(installOnlyInitReport).toContain("- Create the first commit before worker-backed workflows.");
    expect(installOnlyInitReport).toContain("- Run cdx doctor (or npx @codexkit/cli doctor).");
    expect(installOnlyInitReport).toContain("- Start onboarding flow: cdx brainstorm <task> -> cdx plan <task> -> cdx cook <absolute-plan-path>.");
    expect(installOnlyInitReport).not.toContain("cdx resume");
  });

  test("doctor and migration assistant align to doctor -> brainstorm -> plan -> cook unless resumable runs exist", { timeout: 90_000 }, async () => {
    const gitBacked = await createGitRuntimeFixture("codexkit-phase10-doctor-onboarding-git-backed");
    cleanups.push(() => gitBacked.cleanup());
    runCli(gitBacked.rootDir, ["daemon", "start", "--once"]);
    runInitPreviewAndApply(gitBacked.rootDir);
    const gitBackedDoctor = runCli(gitBacked.rootDir, ["doctor"]);
    const gitBackedDoctorReport = readReport(gitBackedDoctor.doctorReportPath);
    expect(gitBackedDoctorReport).toContain("- Active runner source:");
    expect(gitBackedDoctorReport).toContain("- Active runner command:");
    expect(gitBackedDoctorReport).toContain("- Run cdx brainstorm <task>, then cdx plan <task>, then cdx cook <absolute-plan-path>.");
    expect(gitBackedDoctorReport).not.toContain("Run cdx resume or cdx cook <absolute-plan-path> as needed.");
    const gitBackedMigrationReport = readReport(gitBackedDoctor.migrationAssistantReportPath);
    expect(gitBackedMigrationReport).toContain("## Recommended Next Command Sequence");
    expect(gitBackedMigrationReport).toContain("- cdx doctor");
    expect(gitBackedMigrationReport).toContain("- cdx brainstorm <task>");
    expect(gitBackedMigrationReport).toContain("- cdx plan <task>");
    expect(gitBackedMigrationReport).toContain("- cdx cook <absolute-plan-path>");
    expect(gitBackedMigrationReport).not.toContain("cdx resume");

    const installOnly = await createInstallOnlyGitFixture("codexkit-phase10-doctor-onboarding-install-only");
    cleanups.push(() => installOnly.cleanup());
    runCli(installOnly.rootDir, ["daemon", "start", "--once"]);
    runInitPreviewAndApply(installOnly.rootDir);
    const installOnlyDoctor = runCli(installOnly.rootDir, ["doctor"]);
    const installOnlyDoctorReport = readReport(installOnlyDoctor.doctorReportPath);
    expect(installOnlyDoctorReport).toContain("- Create the first commit before worker-backed workflows.");
    expect(installOnlyDoctorReport).toContain("- Rerun cdx doctor after the first commit.");
    expect(installOnlyDoctorReport).toContain("- Continue onboarding with cdx brainstorm <task>, then cdx plan <task>, then cdx cook <absolute-plan-path>.");
    expect(installOnlyDoctorReport).not.toContain("Run cdx resume or cdx cook <absolute-plan-path> as needed.");
    const installOnlyMigrationReport = readReport(installOnlyDoctor.migrationAssistantReportPath);
    expect(installOnlyMigrationReport).toContain("- git add . && git commit -m 'bootstrap codexkit install'");
    expect(installOnlyMigrationReport).toContain("- cdx doctor");
    expect(installOnlyMigrationReport).toContain("- cdx brainstorm <task>");
    expect(installOnlyMigrationReport).toContain("- cdx plan <task>");
    expect(installOnlyMigrationReport).toContain("- cdx cook <absolute-plan-path>");
    expect(installOnlyMigrationReport).not.toContain("cdx resume");
  });
});
