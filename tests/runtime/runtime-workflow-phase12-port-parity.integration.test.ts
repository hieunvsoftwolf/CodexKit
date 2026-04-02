import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadRuntimeConfig, openRuntimeContext } from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function expectCheckpointShape(value: unknown) {
  expect(Array.isArray(value)).toBe(true);
  const checkpoints = value as string[];
  expect(checkpoints.length).toBeGreaterThan(0);
  expect(new Set(checkpoints).size).toBe(checkpoints.length);
  expect(checkpoints.every((entry) => typeof entry === "string" && entry.length > 0)).toBe(true);
}

function expectPublishedArtifacts(paths: Array<string | undefined>, artifacts: Array<{ path: string }>) {
  expect(artifacts.length).toBeGreaterThan(0);
  expect(artifacts.every((artifact) => path.isAbsolute(artifact.path) && existsSync(artifact.path))).toBe(true);
  for (const artifactPath of paths.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)) {
    expect(artifacts.some((artifact) => artifact.path === artifactPath)).toBe(true);
  }
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 phase 4 workflow port parity runtime", () => {
  test("fix creates a durable run on explicit entry and bare chooser continuation publishes artifacts on the same run", async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-fix-runtime");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const explicitFix = runCli(fixture.rootDir, ["fix", "intermittent", "test", "failure", "--quick"]);
    expect(explicitFix.workflow).toBe("fix");
    expectCheckpointShape(explicitFix.checkpointIds);
    const explicitRunId = String(explicitFix.runId);
    expect(context.runService.getRun(explicitRunId)?.workflow).toBe("fix");
    expectPublishedArtifacts([], context.artifactService.listArtifacts({ runId: explicitRunId }));

    const chooserFix = runCli(fixture.rootDir, ["fix"]);
    const chooserRunId = String(chooserFix.runId);
    expect(chooserFix.workflow).toBe("fix");
    expect((chooserFix.checkpointIds as unknown[])).toHaveLength(0);
    const pendingApproval = chooserFix.pendingApproval as { checkpoint?: string; approvalId?: string; nextStep?: string } | undefined;
    expect(typeof pendingApproval?.checkpoint).toBe("string");
    expect(typeof pendingApproval?.approvalId).toBe("string");
    expect(String(pendingApproval?.nextStep ?? "")).toContain("cdx approval respond");
    const pendingRun = context.runService.getRun(chooserRunId);
    expect(pendingRun?.workflow).toBe("fix");
    expect((pendingRun?.metadata as { workflow?: { currentCheckpoint?: string } } | undefined)?.workflow?.currentCheckpoint).toBe(
      pendingApproval?.checkpoint
    );
    expect(context.artifactService.listArtifacts({ runId: chooserRunId })).toHaveLength(0);

    const resumed = runCli(fixture.rootDir, [
      "approval",
      "respond",
      String(pendingApproval?.approvalId),
      "--response",
      "approve",
      "--text",
      "autonomous"
    ]);
    const continuation = (resumed.continuation ?? null) as { workflow?: string; checkpointIds?: string[] } | null;
    expect(continuation?.workflow).toBe("fix");
    expectCheckpointShape(continuation?.checkpointIds);
    expectPublishedArtifacts([], context.artifactService.listArtifacts({ runId: chooserRunId }));
  });

  test("team creates a durable run, checkpoint chain, artifact output, and worker-side team activity", async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-team-runtime");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const team = runCli(fixture.rootDir, ["team", "review", "payment", "flow"]);
    expect(team.workflow).toBe("team");
    expectCheckpointShape(team.checkpointIds);
    const runId = String(team.runId);
    expect(context.runService.getRun(runId)?.workflow).toBe("team");
    expect(context.workerService.listWorkers({ runId }).length).toBeGreaterThan(0);
    expectPublishedArtifacts([], context.artifactService.listArtifacts({ runId }));
  });

  test("docs publishes a standalone durable docs artifact set on a docs workflow run", async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-docs-runtime");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const docs = runCli(fixture.rootDir, ["docs", "refresh", "architecture", "summary"]);
    expect(docs.workflow).toBe("docs");
    expectCheckpointShape(docs.checkpointIds);
    const runId = String(docs.runId);
    expect(context.runService.getRun(runId)?.workflow).toBe("docs");
    expectPublishedArtifacts([docs.docsReportPath as string | undefined], context.artifactService.listArtifacts({ runId }));
  });

  test("scout publishes a standalone durable scout artifact set on a scout workflow run", async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-scout-runtime");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const scout = runCli(fixture.rootDir, ["scout", "payment", "onboarding", "risk"]);
    expect(scout.workflow).toBe("scout");
    expectCheckpointShape(scout.checkpointIds);
    const runId = String(scout.runId);
    expect(context.runService.getRun(runId)?.workflow).toBe("scout");
    expectPublishedArtifacts([scout.scoutReportPath as string | undefined], context.artifactService.listArtifacts({ runId }));
  });
});
