import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadRuntimeConfig, openRuntimeContext, WorkerRuntime } from "../../packages/codexkit-daemon/src/index.ts";
import { runReconciliationPass } from "../../packages/codexkit-daemon/src/runtime-kernel.ts";
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

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

async function waitForFirstProgress(logPath: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(logPath) && statSync(logPath).size > 0 && readFileSync(logPath, "utf8").includes("progress")) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for first progress signal in ${logPath}`);
}

describe("phase 2 worker latency benchmarks", () => {
  test("NFR-7.1 launch latency p95 stays within 8s for git-clean and git-dirty-text fixtures", {
    timeout: 120_000
  }, async () => {
    const cases = [
      { label: "git-clean", dirty: false },
      { label: "git-dirty-text", dirty: true }
    ] as const;
    const evidence: Record<string, { samplesMs: number[]; p95Ms: number }> = {};

    for (const entry of cases) {
      const fixture = await createGitRuntimeFixture(`codexkit-phase2-latency-${entry.label}`);
      cleanups.push(async () => fixture.cleanup());
      const config = loadRuntimeConfig(fixture.rootDir);
      const context = openRuntimeContext(config);
      cleanups.push(() => context.close());
      const runtime = new WorkerRuntime(context, { heartbeatMs: 25, gracefulTimeoutMs: 200 });
      cleanups.push(() => runtime.shutdownAll());
      const run = context.runService.createRun({ workflow: "cook" });
      const samples: number[] = [];

      for (let index = 0; index < 6; index += 1) {
        if (entry.dirty) {
          writeFileSync(path.join(fixture.rootDir, "README.md"), `# fixture\ndirty-mode-${index}\n`, "utf8");
        }
        const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: `${entry.label}-${index}` });
        const approvedSpawnAt = Date.now();
        const launched = runtime.spawnWorker({
          runId: run.id,
          taskId: task.id,
          role: "developer",
          displayName: `${entry.label}-${index}`,
          prompt: "latency benchmark",
          context: { case: entry.label, index },
          ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: [] },
          command: command("process.stdout.write('progress\\n');")
        });
        const waitResult = runtime.waitForWorker(launched.workerId);
        await waitForFirstProgress(path.join(config.paths.logsDir, `${launched.workerId}.stdout.log`));
        samples.push(Date.now() - approvedSpawnAt);
        const completed = await waitResult;
        expect(completed?.state, JSON.stringify(completed)).toBe("stopped");
      }

      const latencyP95 = p95(samples);
      expect(latencyP95).toBeLessThanOrEqual(8_000);
      evidence[entry.label] = { samplesMs: samples, p95Ms: latencyP95 };
    }

    mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
    writeFileSync(path.join(process.cwd(), ".tmp", "nfr-7.1-launch-latency.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  });

  test("NFR-7.2 dispatch latency p95 stays within 1s on a warm runtime", { timeout: 120_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-dispatch-latency");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Dispatch Benchmark Worker" });
    const samples: number[] = [];

    for (let index = 0; index < 8; index += 1) {
      const blocker = context.taskService.createTask({ runId: run.id, role: "developer", subject: `blocker-${index}` });
      const target = context.taskService.createTask({
        runId: run.id,
        role: "developer",
        subject: `target-${index}`,
        dependsOn: [blocker.id]
      });
      context.taskService.updateTask(blocker.id, { status: "completed" });
      const dependencyClearedAt = Date.now();
      runReconciliationPass(context);
      const claim = context.claimService.listClaims({ taskId: target.id, status: "active" })[0];
      expect(claim).toBeTruthy();
      samples.push(Date.now() - dependencyClearedAt);
      context.claimService.releaseClaim(claim!.id, "released");
      context.taskService.updateTask(target.id, { status: "completed" });
      runReconciliationPass(context);
    }

    const latencyP95 = p95(samples);
    expect(latencyP95).toBeLessThanOrEqual(1_000);
    mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
    writeFileSync(
      path.join(process.cwd(), ".tmp", "nfr-7.2-dispatch-latency.json"),
      `${JSON.stringify({ samplesMs: samples, p95Ms: latencyP95 }, null, 2)}\n`,
      "utf8"
    );
    expect(context.workerService.getWorker(worker.id).state).toBe("idle");
  });
});
