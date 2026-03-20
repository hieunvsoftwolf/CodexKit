import { writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { invokeCompatTool } from "../../packages/codexkit-compat-mcp/src/index.ts";
import { CompatToolError } from "../../packages/codexkit-compat-mcp/src/errors.ts";
import { loadRuntimeConfig, openRuntimeContext } from "../../packages/codexkit-daemon/src/index.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function callTool(
  context: ReturnType<typeof openRuntimeContext>,
  name: Parameters<typeof invokeCompatTool>[2]["name"],
  payload: Record<string, unknown>,
  caller: Parameters<typeof invokeCompatTool>[1] = { kind: "user" }
) {
  return invokeCompatTool(context, caller, { kind: "request", name, payload });
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 3 compatibility primitives", () => {
  test("keeps task.create idempotent on natural key and supports patch-style updates", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-task-idempotency");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });

    const first = callTool(context, "task.create", {
      runId: run.id,
      subject: "Implement primitive",
      description: "Build MCP primitive",
      role: "fullstack-developer",
      stepRef: "phase3.task.create"
    });
    const second = callTool(context, "task.create", {
      runId: run.id,
      subject: "Implement primitive",
      description: "Build MCP primitive",
      role: "fullstack-developer",
      stepRef: "phase3.task.create"
    });
    expect(first.payload.taskId).toBe(second.payload.taskId);

    const updated = callTool(context, "task.update", {
      taskId: first.payload.taskId,
      patch: {
        priority: 5,
        appendNote: "idempotent update note"
      }
    });
    expect((updated.payload.task as { priority: number }).priority).toBe(5);
    expect((updated.payload.task as { metadata: { auditNotes: unknown[] } }).metadata.auditNotes.length).toBe(1);
  });

  test("enforces sender identity and preserves mailbox cursor across restart", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-mailbox-restart");
    cleanups.push(() => fixture.cleanup());
    const firstContext = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    const run = firstContext.runService.createRun({ workflow: "team" });
    const worker = firstContext.workerService.registerWorker({
      runId: run.id,
      role: "developer",
      displayName: "Worker A"
    });

    expect(() =>
      callTool(
        firstContext,
        "message.send",
        {
          runId: run.id,
          fromWorkerId: "worker_other",
          toKind: "worker",
          toId: worker.id,
          body: "identity mismatch"
        },
        { kind: "worker", workerId: worker.id }
      )
    ).toThrowError(CompatToolError);

    callTool(firstContext, "message.send", { runId: run.id, toKind: "worker", toId: worker.id, body: "one" });
    callTool(firstContext, "message.send", { runId: run.id, toKind: "worker", toId: worker.id, body: "two" });

    const firstPull = callTool(firstContext, "message.pull", { recipientKind: "worker", recipientId: worker.id, maxItems: 1 }, { kind: "worker", workerId: worker.id });
    expect((firstPull.payload.messages as unknown[]).length).toBe(1);

    firstContext.close();
    const reopened = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => reopened.close());
    const secondPull = callTool(reopened, "message.pull", { recipientKind: "worker", recipientId: worker.id }, { kind: "worker", workerId: worker.id });
    const messages = secondPull.payload.messages as Array<{ body: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).toBe("two");
  });

  test("keeps approval request/respond idempotent and side-effect safe", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-approval-idempotency");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({
      runId: run.id,
      role: "planner",
      subject: "Plan approval gate",
      description: "checkpoint"
    });
    const worker = context.workerService.registerWorker({
      runId: run.id,
      role: "planner",
      displayName: "Planner worker"
    });

    const first = callTool(
      context,
      "approval.request",
      {
        runId: run.id,
        taskId: task.id,
        checkpoint: "plan-review",
        question: "Approve plan?",
        options: [
          { code: "approve", label: "Approve" },
          { code: "revise", label: "Revise" },
          { code: "abort", label: "Abort" }
        ]
      },
      { kind: "worker", workerId: worker.id }
    );
    const second = callTool(
      context,
      "approval.request",
      {
        runId: run.id,
        taskId: task.id,
        checkpoint: "plan-review",
        question: "Approve plan?",
        options: [
          { code: "approve", label: "Approve" },
          { code: "revise", label: "Revise" },
          { code: "abort", label: "Abort" }
        ]
      },
      { kind: "worker", workerId: worker.id }
    );
    expect((first.payload.approval as { id: string }).id).toBe((second.payload.approval as { id: string }).id);
    expect(context.workerService.getWorker(worker.id).state).toBe("waiting_approval");

    const userInbox = callTool(context, "message.pull", { recipientKind: "user", recipientId: run.id });
    expect((userInbox.payload.messages as unknown[]).length).toBe(1);

    const approvalId = (first.payload.approval as { id: string }).id;
    const resolved = callTool(context, "approval.respond", { approvalId, responseCode: "approve", responseText: "ship it" });
    const replay = callTool(context, "approval.respond", { approvalId, responseCode: "approve", responseText: "ship it" });
    expect((resolved.payload.approval as { status: string }).status).toBe("approved");
    expect((replay.payload.approval as { status: string }).status).toBe("approved");
    expect(() => callTool(context, "approval.respond", { approvalId, responseCode: "reject" })).toThrowError(CompatToolError);
  });

  test("keeps team.delete in shutting_down until workers drain and preserves shutdown messaging", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-team-delete");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "team" });

    const created = callTool(context, "team.create", { runId: run.id, name: "Core Team", orchestratorRole: "project-manager" });
    const replay = callTool(context, "team.create", { runId: run.id, name: "Core Team", orchestratorRole: "project-manager" });
    expect(created.payload.teamId).toBe(replay.payload.teamId);

    const spawned = callTool(context, "worker.spawn", {
      runId: run.id,
      teamId: created.payload.teamId,
      role: "fullstack-developer",
      displayName: "Worker Z"
    });
    const firstDelete = callTool(context, "team.delete", { teamId: created.payload.teamId, reason: "done" });
    expect(firstDelete.payload.deleted).toBe(false);
    expect(context.teamService.getTeam(created.payload.teamId as string).status).toBe("shutting_down");

    const shutdownInbox = callTool(
      context,
      "message.pull",
      { recipientKind: "worker", recipientId: spawned.payload.workerId },
      { kind: "worker", workerId: spawned.payload.workerId as string }
    );
    const messages = shutdownInbox.payload.messages as Array<{ messageType: string }>;
    expect(messages.some((message) => message.messageType === "shutdown_request")).toBe(true);

    context.workerService.updateWorker(spawned.payload.workerId as string, { state: "stopped" });
    const orchestratorId = context.teamService.getTeam(created.payload.teamId as string).orchestratorWorkerId;
    if (orchestratorId) {
      context.workerService.updateWorker(orchestratorId, { state: "stopped" });
    }
    const secondDelete = callTool(context, "team.delete", { teamId: created.payload.teamId, reason: "done" });
    expect(secondDelete.payload.deleted).toBe(true);
  });

  test("canonicalizes artifact paths and rejects checksum-conflicting re-publish", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-artifact-canonical");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const reportPath = path.join(fixture.rootDir, "report.md");
    writeFileSync(reportPath, "initial\n", "utf8");

    const first = callTool(context, "artifact.publish", {
      runId: run.id,
      kind: "report",
      path: "./report.md",
      summary: "phase report"
    });
    const second = callTool(context, "artifact.publish", {
      runId: run.id,
      kind: "report",
      path: "./report.md",
      summary: "phase report"
    });
    expect(first.payload.artifactId).toBe(second.payload.artifactId);

    writeFileSync(reportPath, "changed\n", "utf8");
    expect(() =>
      callTool(context, "artifact.publish", {
        runId: run.id,
        kind: "report",
        path: "./report.md",
        summary: "phase report"
      })
    ).toThrowError(CompatToolError);
  });
});
