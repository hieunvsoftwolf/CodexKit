import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
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

function expectDurableArtifacts(rootDir: string, runId: string) {
  const shownRun = runCli(rootDir, ["run", "show", runId]);
  const artifacts = (shownRun.artifacts ?? []) as Array<{ path?: string }>;
  expect(artifacts.length).toBeGreaterThan(0);
  expect(
    artifacts.some((artifact) => typeof artifact.path === "string" && path.isAbsolute(artifact.path) && existsSync(artifact.path))
  ).toBe(true);
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 phase 4 workflow port parity CLI", () => {
  test("real cdx fix covers explicit entry plus chooser continuation and publishes durable artifacts", { timeout: 90_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-fix-cli");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);

    const explicitFix = runCli(fixture.rootDir, ["fix", "intermittent", "test", "failure", "--quick"]);
    expect(explicitFix.workflow).toBe("fix");
    expectCheckpointShape(explicitFix.checkpointIds);
    expectDurableArtifacts(fixture.rootDir, String(explicitFix.runId));

    const chooserFix = runCli(fixture.rootDir, ["fix"]);
    expect(chooserFix.workflow).toBe("fix");
    expect(chooserFix.pendingApproval).toMatchObject({
      checkpoint: expect.any(String),
      approvalId: expect.any(String)
    });
    expect(String((chooserFix.pendingApproval as { nextStep?: string }).nextStep ?? "")).toContain("cdx approval respond");
    expect((chooserFix.checkpointIds as unknown[])).toHaveLength(0);

    const resumed = runCli(fixture.rootDir, [
      "approval",
      "respond",
      String((chooserFix.pendingApproval as { approvalId?: string }).approvalId),
      "--response",
      "approve",
      "--text",
      "autonomous"
    ]);
    const continuation = (resumed.continuation ?? null) as { workflow?: string; checkpointIds?: string[] } | null;
    expect(continuation?.workflow).toBe("fix");
    expectCheckpointShape(continuation?.checkpointIds);
    expectDurableArtifacts(fixture.rootDir, String(chooserFix.runId));
  });

  test("real cdx team creates a runnable team workflow with checkpointed output and durable artifacts", { timeout: 90_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-team-cli");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);

    const team = runCli(fixture.rootDir, ["team", "review", "payment", "flow"]);
    expect(team.workflow).toBe("team");
    expectCheckpointShape(team.checkpointIds);
    expectDurableArtifacts(fixture.rootDir, String(team.runId));
  });

  test("real cdx docs creates a standalone docs workflow with checkpointed output and durable artifacts", { timeout: 90_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-docs-cli");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);

    const docs = runCli(fixture.rootDir, ["docs", "refresh", "architecture", "summary"]);
    expect(docs.workflow).toBe("docs");
    expectCheckpointShape(docs.checkpointIds);
    expectDurableArtifacts(fixture.rootDir, String(docs.runId));
  });

  test("real cdx scout creates a standalone scout workflow with checkpointed output and durable artifacts", { timeout: 90_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase12-port-parity-scout-cli");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);

    const scout = runCli(fixture.rootDir, ["scout", "payment", "onboarding", "risk"]);
    expect(scout.workflow).toBe("scout");
    expectCheckpointShape(scout.checkpointIds);
    expectDurableArtifacts(fixture.rootDir, String(scout.runId));
  });
});
