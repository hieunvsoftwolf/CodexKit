import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { buildDefaultWorkerCommand, loadRuntimeConfig, openRuntimeContext, WorkerRuntime } from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function command(script: string): string[] {
  return [process.execPath, "-e", script];
}

describe("phase 2 worker isolation enforcement", () => {
  test("detects root-checkout escape writes and blocks normal patch publication", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-root-escape");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "root escape" });

    const launched = runtime.spawnWorker({
      runId: run.id,
      taskId: task.id,
      role: "developer",
      displayName: "Root Escape Worker",
      prompt: "escape root",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
      command: command(
        "const fs=require('fs');const path=require('path');const target=path.resolve(process.cwd(),'../../../../README.md');fs.appendFileSync(target,'escaped\\n');"
      )
    });
    const result = await runtime.waitForWorker(launched.workerId);
    const artifacts = context.artifactService.listArtifacts({ workerId: launched.workerId });

    expect(result?.state).toBe("failed");
    expect(result?.violations).toContain("root:README.md");
    expect(artifacts.some((artifact) => artifact.artifactKind === "patch")).toBe(false);
    expect(artifacts.some((artifact) => artifact.artifactKind === "trace")).toBe(true);
    expect(readFileSync(path.join(fixture.rootDir, "README.md"), "utf8")).toContain("escaped");
  });

  test("flags protected runtime-private path writes under .codexkit/runtime", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-runtime-private");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "runtime private write" });

    const launched = runtime.spawnWorker({
      runId: run.id,
      taskId: task.id,
      role: "developer",
      displayName: "Runtime Private Worker",
      prompt: "touch runtime private",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
      command: command(
        "const fs=require('fs');fs.mkdirSync('.codexkit/runtime',{recursive:true});fs.writeFileSync('.codexkit/runtime/probe.txt','x');"
      )
    });
    const result = await runtime.waitForWorker(launched.workerId);

    expect(result?.state).toBe("failed");
    expect(result?.violations).toContain(".codexkit/runtime/probe.txt");
  });

  test("detects .git protected-path mutations and releases claims", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-git-private");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "git private write" });

    const launched = runtime.spawnWorker({
      runId: run.id,
      taskId: task.id,
      role: "developer",
      displayName: "Git Private Worker",
      prompt: "touch git private",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
      command: command(
        "const fs=require('fs');const path=require('path');const target=path.resolve(process.cwd(),'../../../../.git/probe.txt');fs.writeFileSync(target,'x');"
      )
    });
    const result = await runtime.waitForWorker(launched.workerId);

    expect(result?.state).toBe("failed");
    expect(result?.violations.some((entry) => entry.startsWith(".git/"))).toBe(true);
    expect(context.claimService.listClaims({ workerId: launched.workerId, status: "active" })).toHaveLength(0);
  });

  test("builds default worker launch command with prompt and context bundle paths", () => {
    expect(buildDefaultWorkerCommand({ promptPath: "/tmp/prompt.md", contextPath: "/tmp/context.json" })).toEqual([
      "codex",
      "exec",
      "--input-file",
      "/tmp/prompt.md",
      "--context-file",
      "/tmp/context.json"
    ]);
  });

  test("appends launch bundle args to wrapper runner command", () => {
    expect(
      buildDefaultWorkerCommand(
        { promptPath: "/tmp/prompt.md", contextPath: "/tmp/context.json" },
        ["codex-safe", "exec", "--profile", "beta"]
      )
    ).toEqual([
      "codex-safe",
      "exec",
      "--profile",
      "beta",
      "--input-file",
      "/tmp/prompt.md",
      "--context-file",
      "/tmp/context.json"
    ]);
  });
});
