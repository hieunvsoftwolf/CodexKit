import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";
import { loadRuntimeConfig, openRuntimeContext } from "../../packages/codexkit-daemon/src/index.ts";
import { CodexkitError } from "../../packages/codexkit-core/src/index.ts";
import { runReconciliationPass } from "../../packages/codexkit-daemon/src/runtime-kernel.ts";
import { createRuntimeFixture, createFakeClock } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function waitForPidExit(pid: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`timed out waiting for pid ${pid} to exit`);
}

describe("phase 1 runtime core", () => {
  test("persists runs across reopen and resume without duplicate rows", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-persist");
    cleanups.push(() => fixture.cleanup());
    const firstConfig = loadRuntimeConfig(fixture.rootDir);
    const firstContext = openRuntimeContext(firstConfig);
    const run = firstContext.runService.createRun({ workflow: "cook", prompt: "add auth" });
    runReconciliationPass(firstContext);
    expect(existsSync(firstConfig.paths.databasePath)).toBe(true);
    firstContext.close();

    const secondContext = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    runReconciliationPass(secondContext);
    const runs = secondContext.runService.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe(run.id);
    expect(secondContext.runService.resumeCandidates()[0]?.id).toBe(run.id);
    secondContext.close();
  });

  test("recomputes task readiness when blocking dependencies complete", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-task");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    const run = context.runService.createRun({ workflow: "plan" });
    const taskA = context.taskService.createTask({ runId: run.id, role: "planner", subject: "Create plan" });
    const taskB = context.taskService.createTask({
      runId: run.id,
      role: "planner",
      subject: "Review plan",
      dependsOn: [taskA.id]
    });

    runReconciliationPass(context);
    expect(context.taskService.getTask(taskB.id).status).toBe("blocked");

    context.taskService.updateTask(taskA.id, { status: "completed" });
    runReconciliationPass(context);
    expect(context.taskService.getTask(taskB.id).status).toBe("ready");
    context.close();
  });

  test("expires claims, marks stale workers, and preserves approval resolution", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-recovery");
    cleanups.push(() => fixture.cleanup());
    const fake = createFakeClock();
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "Implement feature" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Worker A" });
    const claim = context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 5_000 });
    const approval = context.approvalService.createApproval({
      runId: run.id,
      taskId: task.id,
      checkpoint: "post-plan",
      question: "Continue?"
    });

    runReconciliationPass(context);
    expect(context.taskService.getTask(task.id).status).toBe("blocked");

    context.approvalService.resolveApproval(approval.id, "approved", "go");
    fake.advanceMs(61_000);
    runReconciliationPass(context);

    expect(context.store.claims.getById(claim.id)?.status).toBe("expired");
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBeNull();
    expect(context.workerService.getWorker(worker.id).state).toBe("failed");
    expect(context.eventService.listEntityEvents("worker", worker.id).some((event) => event.eventType === "worker.stale")).toBe(true);
    context.close();

    const reopened = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
    expect(reopened.approvalService.getApproval(approval.id).status).toBe("approved");
    reopened.close();
  });

  test("reclaims active claims for stale workers even when lease has not expired yet", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-stale-reclaim");
    cleanups.push(async () => fixture.cleanup());
    const fake = createFakeClock();
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "Recover stale owner" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Stale Worker" });
    const claim = context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 5 * 60_000 });

    fake.advanceMs(61_000);
    runReconciliationPass(context);

    expect(context.workerService.getWorker(worker.id).state).toBe("failed");
    expect(context.claimService.listClaims({ taskId: task.id, status: "active" })).toHaveLength(0);
    expect(context.store.claims.getById(claim.id)?.status).toBe("expired");
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBeNull();
    expect(
      context.eventService.listEntityEvents("worker", worker.id).some((event) => event.eventType === "worker.reclaim.queued")
    ).toBe(true);
    context.close();
  });

  test("reclaims running workers when recorded pid is not live", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-pid-liveness");
    cleanups.push(async () => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "pid liveness reclaim" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Dead Pid Worker" });
    context.workerService.updateWorker(worker.id, {
      state: "running",
      metadata: { ...worker.metadata, pid: 999_999, launcherPid: process.pid, launcherSessionId: "session-a" }
    });
    const claim = context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 120_000 });

    runReconciliationPass(context);

    expect(context.workerService.getWorker(worker.id).state).toBe("failed");
    expect(context.store.claims.getById(claim.id)?.status).toBe("expired");
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBeNull();
    const reconciledEvent = context.eventService
      .listEntityEvents("worker", worker.id)
      .find((event) => event.eventType === "worker.reclaim.reconciled");
    expect(reconciledEvent?.payload.reason).toBe("pid-not-live");
  });

  test("kills orphaned child after restart mismatch and reclaims ownership", { timeout: 20_000 }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-orphaned-child");
    cleanups.push(async () => fixture.cleanup());
    const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000);"], { stdio: "ignore" });
    cleanups.push(async () => {
      const pid = child.pid;
      if (!pid) {
        return;
      }
      if (isPidAlive(pid)) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          return;
        }
      }
      await waitForPidExit(pid).catch(() => undefined);
    });
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "orphan reclaim" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Orphan Worker" });
    context.workerService.updateWorker(worker.id, {
      state: "running",
      metadata: { ...worker.metadata, pid: child.pid ?? -1, launcherPid: process.pid + 1, launcherSessionId: "old-session" }
    });
    const claim = context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 120_000 });

    runReconciliationPass(context);
    expect(context.claimService.listClaims({ taskId: task.id, status: "active" })).toHaveLength(1);
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBe(worker.id);
    if (child.pid) {
      await waitForPidExit(child.pid);
    }
    runReconciliationPass(context);

    expect(context.workerService.getWorker(worker.id).state).toBe("failed");
    expect(context.store.claims.getById(claim.id)?.status).toBe("expired");
    const reconciledEvent = context.eventService
      .listEntityEvents("worker", worker.id)
      .find((event) => event.eventType === "worker.reclaim.reconciled");
    expect(reconciledEvent?.payload.reason).toBe("orphaned-child-after-restart");
    expect(reconciledEvent?.payload.orphanKillAttempted).toBe(true);
  });

  test("reclaims launcher-state mismatches even when pid is still live", { timeout: 20_000 }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-launcher-mismatch");
    cleanups.push(async () => fixture.cleanup());
    const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000);"], { stdio: "ignore" });
    cleanups.push(async () => {
      const pid = child.pid;
      if (!pid) {
        return;
      }
      if (isPidAlive(pid)) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          return;
        }
      }
      await waitForPidExit(pid).catch(() => undefined);
    });
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "launcher mismatch reclaim" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Mismatch Worker" });
    context.workerService.updateWorker(worker.id, {
      state: "running",
      metadata: { ...worker.metadata, pid: child.pid ?? -1 }
    });
    const claim = context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 120_000 });

    runReconciliationPass(context);
    expect(context.claimService.listClaims({ taskId: task.id, status: "active" })).toHaveLength(1);
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBe(worker.id);
    if (child.pid) {
      await waitForPidExit(child.pid);
    }
    runReconciliationPass(context);

    expect(context.workerService.getWorker(worker.id).state).toBe("failed");
    expect(context.store.claims.getById(claim.id)?.status).toBe("expired");
    const reconciledEvent = context.eventService
      .listEntityEvents("worker", worker.id)
      .find((event) => event.eventType === "worker.reclaim.reconciled");
    expect(reconciledEvent?.payload.reason).toBe("launcher-state-mismatch");
  });

  test("holds orphan reclaim ownership until evidence timeout when kill cannot be confirmed", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-orphan-timeout");
    cleanups.push(async () => fixture.cleanup());
    const fake = createFakeClock();
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "orphan timeout reclaim" });
    const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: "Timeout Worker" });
    context.workerService.updateWorker(worker.id, {
      state: "running",
      metadata: { ...worker.metadata, pid: 424_242, launcherPid: process.pid + 1, launcherSessionId: "old-session" }
    });
    const claim = context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 120_000 });
    const killSpy = vi.spyOn(process, "kill").mockImplementation((pid: number, signal?: string | number) => {
      if (pid === 424_242 && signal === "SIGKILL") {
        const error = new Error("permission denied") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      }
      return true;
    });
    cleanups.push(() => killSpy.mockRestore());

    runReconciliationPass(context);
    expect(context.claimService.listClaims({ taskId: task.id, status: "active" })).toHaveLength(1);
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBe(worker.id);

    fake.advanceMs(6_000);
    runReconciliationPass(context);

    expect(context.workerService.getWorker(worker.id).state).toBe("failed");
    expect(context.store.claims.getById(claim.id)?.status).toBe("expired");
    expect(context.taskService.getTask(task.id).ownerWorkerId).toBeNull();
    const reconciledEvent = context.eventService
      .listEntityEvents("worker", worker.id)
      .find((event) => event.eventType === "worker.reclaim.reconciled");
    expect(reconciledEvent?.payload.reclaimEvidenceTimeout).toBe(true);
  });

  test("keeps rejected, aborted, and expired approvals as durable task blockers during reconciliation", { timeout: 20_000 }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-approval-blockers");
    cleanups.push(() => fixture.cleanup());
    const fake = createFakeClock();
    const statuses = ["rejected", "aborted", "expired"] as const;

    for (const status of statuses) {
      const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
      const run = context.runService.createRun({ workflow: "cook", metadata: { status } });
      const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: `Handle ${status}` });
      const worker = context.workerService.registerWorker({ runId: run.id, role: "developer", displayName: `Worker ${status}` });
      context.claimService.createClaim({ taskId: task.id, workerId: worker.id, leaseMs: 30_000 });
      const approval = context.approvalService.createApproval({
        runId: run.id,
        taskId: task.id,
        checkpoint: `checkpoint-${status}`,
        question: "Continue?",
        ...(status === "expired" ? { expiresAt: "2026-03-13T00:00:00.000Z" } : {})
      });

      if (status === "expired") {
        fake.advanceMs(1_000);
        context.approvalService.expireApprovals();
      } else {
        context.approvalService.resolveApproval(approval.id, status, status);
      }

      runReconciliationPass(context);
      runReconciliationPass(context);

      expect(context.taskService.getTask(task.id).status).toBe("blocked");
      expect(context.taskService.getTask(task.id).blockingReason).toBe(`system:approval:${status}`);
      expect(context.runService.getRun(run.id).status).toBe("blocked");
      context.close();
    }
  });

  test("keeps rejected, aborted, and expired run-scoped approvals as durable blockers during recompute", { timeout: 20_000 }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-run-approval-blockers");
    cleanups.push(() => fixture.cleanup());
    const fake = createFakeClock();
    const statuses = ["rejected", "aborted", "expired"] as const;

    for (const status of statuses) {
      const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir), fake.clock);
      const run = context.runService.createRun({ workflow: "cook", metadata: { status, scope: "run" } });
      const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: `Complete before ${status}` });

      context.taskService.updateTask(task.id, { status: "completed" });
      runReconciliationPass(context);
      expect(context.runService.getRun(run.id).status).toBe("completed");

      const approval = context.approvalService.createApproval({
        runId: run.id,
        checkpoint: `run-checkpoint-${status}`,
        question: "Continue?",
        ...(status === "expired" ? { expiresAt: "2026-03-13T00:00:00.000Z" } : {})
      });

      if (status === "expired") {
        fake.advanceMs(1_000);
        context.approvalService.expireApprovals();
      } else {
        context.approvalService.resolveApproval(approval.id, status, status);
      }

      expect(context.runService.recomputeRun(run.id).status).toBe("blocked");
      expect(context.runService.recomputeRun(run.id).status).toBe("blocked");
      context.close();
    }
  });

  test("enforces task transition guards for unresolved blockers and terminal states", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-transition-guards");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    const run = context.runService.createRun({ workflow: "plan" });
    const dependency = context.taskService.createTask({ runId: run.id, role: "planner", subject: "Dependency" });
    const blockedTask = context.taskService.createTask({
      runId: run.id,
      role: "planner",
      subject: "Blocked task",
      dependsOn: [dependency.id]
    });

    runReconciliationPass(context);

    expect(() => context.taskService.updateTask(blockedTask.id, { status: "ready" })).toThrowError(
      expect.objectContaining({ code: "TASK_BLOCKED" } satisfies Partial<CodexkitError>)
    );
    expect(() => context.taskService.updateTask(blockedTask.id, { status: "in_progress" })).toThrowError(
      expect.objectContaining({ code: "TASK_BLOCKED" } satisfies Partial<CodexkitError>)
    );

    context.taskService.updateTask(blockedTask.id, { status: "completed" });
    expect(() => context.taskService.updateTask(blockedTask.id, { status: "ready" })).toThrowError(
      expect.objectContaining({ code: "TASK_TERMINAL" } satisfies Partial<CodexkitError>)
    );
    context.close();
  });
});
