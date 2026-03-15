import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadRuntimeConfig, openRuntimeContext, WorkerRuntime } from "../../packages/codexkit-daemon/src/index.ts";
import { createFakeClock, createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function command(script: string): string[] {
  return [process.execPath, "-e", script];
}

describe("phase 2 worker runtime", () => {
  test("enforces owned-path boundaries and keeps root checkout isolated", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-worker-isolation");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "violate path policy" });

    const launched = runtime.spawnWorker({
      runId: run.id,
      taskId: task.id,
      role: "developer",
      displayName: "Worker A",
      prompt: "do work",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
      command: command("const fs=require('fs');fs.writeFileSync('forbidden.txt','x');")
    });
    const result = await runtime.waitForWorker(launched.workerId);

    expect(result?.state).toBe("failed");
    expect(result?.violations).toContain("forbidden.txt");
    expect(context.taskService.getTask(task.id).status).toBe("failed");
    expect(existsSync(path.join(fixture.rootDir, "forbidden.txt"))).toBe(false);
  });

  test("captures artifacts and publishes manifest scaffolding for successful workers", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-artifacts");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 50 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "write allowed file" });

    const launched = runtime.spawnWorker({
      runId: run.id,
      taskId: task.id,
      role: "developer",
      displayName: "Worker B",
      prompt: "do work",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: ["reports"] },
      command: command("const fs=require('fs');fs.mkdirSync('allowed',{recursive:true});fs.writeFileSync('allowed/a.txt','ok');")
    });
    const result = await runtime.waitForWorker(launched.workerId);
    const manifestPath = path.join(result!.artifactDir, "manifest.json");
    const patchPath = path.join(result!.artifactDir, "patch.diff");

    expect(result?.state).toBe("stopped");
    expect(existsSync(manifestPath)).toBe(true);
    expect(existsSync(patchPath)).toBe(true);
    expect(readFileSync(patchPath, "utf8")).toContain("allowed/a.txt");
    expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toMatchObject({ workerId: launched.workerId, violations: [] });
    expect(context.artifactService.listArtifacts({ workerId: launched.workerId }).length).toBeGreaterThanOrEqual(5);
  });

  test("includes deletion patch when worker removes overlay-replayed untracked file", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-untracked-overlay-delete");
    cleanups.push(async () => fixture.cleanup());
    writeFileSync(path.join(fixture.rootDir, "notes.md"), "overlay file\n", "utf8");
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 50, gracefulTimeoutMs: 200 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "delete overlay file" });

    const launched = runtime.spawnWorker({
      runId: run.id,
      taskId: task.id,
      role: "developer",
      displayName: "Worker Overlay Delete",
      prompt: "delete untracked overlay file",
      context: {},
      ownedPaths: { ownedWrite: ["notes.md"], sharedWrite: [], artifactWrite: [] },
      command: command("const fs=require('fs');fs.rmSync('notes.md',{force:true});")
    });
    const result = await runtime.waitForWorker(launched.workerId);
    const patch = readFileSync(path.join(result!.artifactDir, "patch.diff"), "utf8");
    const changedFiles = JSON.parse(readFileSync(path.join(result!.artifactDir, "changed-files.json"), "utf8")) as string[];

    expect(result?.state).toBe("stopped");
    expect(changedFiles).toContain("notes.md");
    expect(patch).toContain("notes.md");
    expect(patch).toContain("deleted file mode 100644");
  });

  test("handles heartbeat, graceful shutdown, crash reclaim evidence, and retention cleanup", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-heartbeat-retention");
    cleanups.push(async () => fixture.cleanup());
    const fake = createFakeClock();
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
    cleanups.push(() => context.close());
    const runtime = new WorkerRuntime(context, { heartbeatMs: 25, gracefulTimeoutMs: 200, claimLeaseMs: 100 });
    cleanups.push(() => runtime.shutdownAll());
    const run = context.runService.createRun({ workflow: "cook" });
    const shutdownTask = context.taskService.createTask({ runId: run.id, role: "developer", subject: "shutdown" });

    const long = runtime.spawnWorker({
      runId: run.id,
      taskId: shutdownTask.id,
      role: "developer",
      displayName: "Worker C",
      prompt: "long running",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: [] },
      command: command("process.on('SIGTERM',()=>process.exit(0)); setInterval(()=>{},1000);")
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const heartbeated = context.claimService.listClaims({ workerId: long.workerId, status: "active" })[0];
    expect(heartbeated?.heartbeatAt).toBeTruthy();
    const stopped = await runtime.shutdownWorker(long.workerId);
    expect(stopped?.state).toBe("stopped");

    const crashTask = context.taskService.createTask({ runId: run.id, role: "developer", subject: "crash" });
    const crashed = runtime.spawnWorker({
      runId: run.id,
      taskId: crashTask.id,
      role: "developer",
      displayName: "Worker D",
      prompt: "crash",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: [] },
      command: command("process.exit(2)")
    });
    const failed = await runtime.waitForWorker(crashed.workerId);
    const reclaimEvent = context.eventService
      .listEntityEvents("worker", crashed.workerId)
      .some((event) => event.eventType === "worker.reclaim.queued");
    expect(failed?.state).toBe("failed");
    expect(reclaimEvent).toBe(true);

    expect(runtime.cleanupRetainedWorktrees(fake.clock.now())).toHaveLength(0);
    fake.advanceMs(73 * 60 * 60 * 1000);
    const cleaned = runtime.cleanupRetainedWorktrees(fake.clock.now());
    expect(cleaned).toContain(crashed.workerId);
    expect(context.workerService.getWorker(crashed.workerId).worktreePath).toBeNull();
  });
});
