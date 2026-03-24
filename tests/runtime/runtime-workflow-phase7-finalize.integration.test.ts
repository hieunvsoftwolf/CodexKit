import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { RuntimeController } from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function gitHead(rootDir: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf8"
  }).trim();
}

function listPhasePaths(planPath: string): string[] {
  const planDir = path.dirname(planPath);
  return readdirSync(planDir)
    .filter((entry) => /^phase-\d{2}-.+\.md$/i.test(entry))
    .sort()
    .map((entry) => path.join(planDir, entry));
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 7 finalize workflow", () => {
  test(
    "auto cook does not claim finalize completion before delegated test and review evidence",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase7-finalize-ordering");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const beforeHead = gitHead(fixture.rootDir);
      const plan = runCli(fixture.rootDir, ["plan", "Phase", "7", "finalize", "ordering", "--hard"]);
      const result = runCli(fixture.rootDir, ["cook", "--auto", String(plan.planPath)]);

      expect(result.workflow).toBe("cook");
      expect(result.completedThroughPostImplementation).toBe(true);
      expect(result.completedThroughFinalize).toBe(false);
      expect(result.checkpointIds).not.toContain("finalize-sync");
      expect(result.checkpointIds).not.toContain("finalize-docs");
      expect(result.checkpointIds).not.toContain("finalize-git");

      const shownRun = runCli(fixture.rootDir, ["run", "show", String(result.runId)]);
      const artifacts = (shownRun.artifacts ?? []) as Array<{ path?: string }>;
      expect(artifacts.some((artifact) => path.basename(String(artifact.path ?? "")) === "finalize-report.md")).toBe(false);
      expect(gitHead(fixture.rootDir)).toBe(beforeHead);
    }
  );

  test(
    "finalize without an active plan records no-active-plan and still emits docs/git/finalize reports",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase7-no-active-plan");
      cleanups.push(() => fixture.cleanup());
      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const run = controller.createRun({ workflow: "review", mode: "auto", prompt: "phase-7 no active plan" });
      const finalize = controller.finalize({ runId: run.id });

      expect(finalize.sync.status).toBe("no-active-plan");
      expect(finalize.noAutoCommit).toBe(true);
      expect(existsSync(finalize.docsImpact.reportPath)).toBe(true);
      expect(existsSync(finalize.gitHandoff.reportPath)).toBe(true);
      expect(existsSync(finalize.finalizeReportPath)).toBe(true);

      const finalizeReport = readFileSync(finalize.finalizeReportPath, "utf8");
      expect(finalizeReport).toContain("Active plan path: no active plan");
      expect(finalizeReport).toContain("## Next Action");
      expect(finalizeReport).toContain("docs-impact-report.md");
      expect(finalizeReport).toContain("git-handoff-report.md");
      expect(finalizeReport).toContain("not created automatically");
    }
  );

  test(
    "sync-back keeps unmatched checklist items unchecked and preserves user-authored progress narrative",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase7-safe-sync-back");
      cleanups.push(() => fixture.cleanup());
      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const plan = controller.plan({ task: "Phase 7 safe sync-back", mode: "hard" }) as { planPath: string };
      const planPath = plan.planPath;
      const originalPlan = readFileSync(planPath, "utf8");
      writeFileSync(
        planPath,
        `${originalPlan}\n## Progress\n\n- Team note: preserve this line.\n- Manual context: do not overwrite.\n`,
        "utf8"
      );

      const cook = controller.cook({ planPath, mode: "auto" }) as { runId: string; completedThroughFinalize: boolean };
      expect(cook.completedThroughFinalize).toBe(false);

      const finalize = controller.finalize({ runId: cook.runId, planPathHint: planPath });
      expect(finalize.sync.status).toBe("synced");
      expect(finalize.sync.unresolvedMappings.length).toBeGreaterThan(0);
      expect(typeof finalize.sync.unresolvedMappingReportPath).toBe("string");
      expect(existsSync(String(finalize.sync.unresolvedMappingReportPath))).toBe(true);

      const phasePaths = listPhasePaths(planPath);
      expect(phasePaths.length).toBeGreaterThanOrEqual(3);
      const uncheckedItems = phasePaths
        .map((phasePath) => (readFileSync(phasePath, "utf8").match(/^- \[ \]/gm) ?? []).length)
        .reduce((sum, count) => sum + count, 0);
      expect(uncheckedItems).toBeGreaterThan(0);

      const updatedPlan = readFileSync(planPath, "utf8");
      expect(updatedPlan).toContain("Team note: preserve this line.");
      expect(updatedPlan).toContain("Manual context: do not overwrite.");
      expect(updatedPlan).toContain("<!-- codexkit:managed-progress:start -->");
      expect(updatedPlan).toContain("| Phase | Checked | Total | Percent | Status |");

      const finalizeReport = readFileSync(finalize.finalizeReportPath, "utf8");
      expect(finalizeReport).toContain(`Active plan path: ${path.resolve(planPath)}`);
      expect(finalizeReport).toContain("## Next Action");
      expect(finalizeReport).toContain("unresolved-mapping-report.md");
    }
  );

  test(
    "finalize ignores non-plan hints and uses the durable plan.md target",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase7-ignore-phase-hint");
      cleanups.push(() => fixture.cleanup());
      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const plan = controller.plan({ task: "Phase 7 ignore non-plan hint", mode: "hard" }) as { planPath: string };
      const planPath = plan.planPath;
      const phasePaths = listPhasePaths(planPath);
      expect(phasePaths.length).toBeGreaterThan(0);
      const phaseHintPath = phasePaths[0]!;
      const phaseBeforeFinalize = readFileSync(phaseHintPath, "utf8");
      expect(phaseBeforeFinalize).not.toContain("<!-- codexkit:managed-progress:start -->");

      const cook = controller.cook({ planPath, mode: "auto" }) as { runId: string; completedThroughFinalize: boolean };
      expect(cook.completedThroughFinalize).toBe(false);

      const finalize = controller.finalize({ runId: cook.runId, planPathHint: phaseHintPath });
      expect(finalize.sync.status).toBe("synced");
      expect(finalize.sync.planPath).toBe(path.resolve(planPath));
      expect(finalize.sync.planPath).not.toBe(path.resolve(phaseHintPath));

      const phaseAfterFinalize = readFileSync(phaseHintPath, "utf8");
      expect(phaseAfterFinalize).not.toContain("<!-- codexkit:managed-progress:start -->");

      const finalizeReport = readFileSync(finalize.finalizeReportPath, "utf8");
      expect(finalizeReport).toContain(`Active plan path: ${path.resolve(planPath)}`);
    }
  );

  test(
    "finalize rejects plan.md symlink aliases and keeps report placement on the durable plan root",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase7-reject-symlink-alias");
      cleanups.push(() => fixture.cleanup());
      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const plan = controller.plan({ task: "Phase 7 reject symlink alias hint", mode: "hard" }) as { planPath: string };
      const planPath = plan.planPath;
      const phasePaths = listPhasePaths(planPath);
      expect(phasePaths.length).toBeGreaterThan(0);
      const phaseTargetPath = phasePaths[0]!;
      const phaseBeforeFinalize = readFileSync(phaseTargetPath, "utf8");
      expect(phaseBeforeFinalize).not.toContain("<!-- codexkit:managed-progress:start -->");

      const planDir = path.dirname(path.resolve(planPath));
      const aliasRoot = path.join(planDir, "alias-plan-root");
      mkdirSync(aliasRoot, { recursive: true });
      const aliasPlanPath = path.join(aliasRoot, "plan.md");
      symlinkSync(path.relative(aliasRoot, phaseTargetPath), aliasPlanPath);

      const cook = controller.cook({ planPath, mode: "auto" }) as { runId: string; completedThroughFinalize: boolean };
      expect(cook.completedThroughFinalize).toBe(false);

      const finalize = controller.finalize({ runId: cook.runId, planPathHint: aliasPlanPath });
      expect(finalize.sync.status).toBe("synced");
      expect(finalize.sync.planPath).toBe(path.resolve(planPath));
      expect(finalize.sync.planPath).not.toBe(path.resolve(aliasPlanPath));

      const phaseAfterFinalize = readFileSync(phaseTargetPath, "utf8");
      expect(phaseAfterFinalize).not.toContain("<!-- codexkit:managed-progress:start -->");

      const durableReportsDir = path.join(planDir, "reports");
      expect(path.dirname(finalize.docsImpact.reportPath)).toBe(path.resolve(durableReportsDir));
      expect(path.dirname(finalize.gitHandoff.reportPath)).toBe(path.resolve(durableReportsDir));
      expect(path.dirname(finalize.finalizeReportPath)).toBe(path.resolve(durableReportsDir));
      if (finalize.sync.unresolvedMappingReportPath) {
        expect(path.dirname(finalize.sync.unresolvedMappingReportPath)).toBe(path.resolve(durableReportsDir));
      }

      const aliasReportsDir = path.join(aliasRoot, "reports");
      expect(existsSync(path.join(aliasReportsDir, "docs-impact-report.md"))).toBe(false);
      expect(existsSync(path.join(aliasReportsDir, "git-handoff-report.md"))).toBe(false);
      expect(existsSync(path.join(aliasReportsDir, "finalize-report.md"))).toBe(false);
    }
  );

  test(
    "finalize with no active plan ignores arbitrary markdown hints",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase7-ignore-arbitrary-hint");
      cleanups.push(() => fixture.cleanup());
      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const run = controller.createRun({ workflow: "review", mode: "auto", prompt: "phase-7 hostile hint" });
      const arbitraryPath = path.join(fixture.rootDir, "hostile-hint.md");
      const original = "# Hostile Hint\n\n- do not rewrite this file\n";
      writeFileSync(arbitraryPath, original, "utf8");

      const finalize = controller.finalize({ runId: run.id, planPathHint: arbitraryPath });
      expect(finalize.sync.status).toBe("no-active-plan");
      expect(readFileSync(arbitraryPath, "utf8")).toBe(original);
      expect(existsSync(finalize.finalizeReportPath)).toBe(true);
    }
  );
});
