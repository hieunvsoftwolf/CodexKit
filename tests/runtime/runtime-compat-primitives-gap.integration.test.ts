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

function expectCompatError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("expected CompatToolError");
  } catch (error) {
    expect(error).toBeInstanceOf(CompatToolError);
    expect((error as CompatToolError).code).toBe(code);
  }
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 3 compatibility primitives gap coverage", () => {
  test("task.list and task.get remain read-only and return created tasks", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-task-readonly");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });

    const created = callTool(context, "task.create", {
      runId: run.id,
      subject: "Read-only checks",
      description: "verify list/get",
      role: "tester",
      stepRef: "phase3.task.list.get"
    });
    const taskId = created.payload.taskId as string;
    const eventsBefore = context.store.events.listByRun(run.id, 100).length;

    const listed = callTool(context, "task.list", { runId: run.id });
    const got = callTool(context, "task.get", { taskId });
    const eventsAfter = context.store.events.listByRun(run.id, 100).length;

    const tasks = listed.payload.tasks as Array<{ id: string }>;
    expect(tasks.some((task) => task.id === taskId)).toBe(true);
    expect((got.payload.task as { id: string }).id).toBe(taskId);
    expect(eventsAfter).toBe(eventsBefore);
  });

  test("team mailbox pull enforces orchestrator-only access and worker.spawn unsupported mode is stable", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-team-mailbox-authz");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "team" });

    const teamResult = callTool(context, "team.create", {
      runId: run.id,
      name: "Mailbox Team",
      orchestratorRole: "project-manager"
    });
    const teamId = teamResult.payload.teamId as string;
    const team = context.teamService.getTeam(teamId);
    const orchestratorWorkerId = team.orchestratorWorkerId as string;

    const member = callTool(context, "worker.spawn", {
      runId: run.id,
      teamId,
      role: "fullstack-developer",
      displayName: "Member worker"
    });
    const memberWorkerId = member.payload.workerId as string;

    expectCompatError(
      () =>
        callTool(
          context,
          "worker.spawn",
          { runId: run.id, role: "tester", executionMode: "cloud_task" },
          { kind: "user" }
        ),
      "not_supported"
    );

    callTool(context, "message.send", {
      runId: run.id,
      toKind: "team",
      toId: teamId,
      body: "team alert"
    });

    expectCompatError(
      () =>
        callTool(
          context,
          "message.pull",
          { recipientKind: "team", recipientId: teamId },
          { kind: "worker", workerId: memberWorkerId }
        ),
      "permission_denied"
    );

    const orchestratorPull = callTool(
      context,
      "message.pull",
      { recipientKind: "team", recipientId: teamId },
      { kind: "worker", workerId: orchestratorWorkerId }
    );
    const messages = orchestratorPull.payload.messages as Array<{ body: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).toBe("team alert");
  });

  test("user mailbox authz denial does not mutate worker mailbox cursor or delivery", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-user-mailbox-authz");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "team" });
    const worker = context.workerService.registerWorker({
      runId: run.id,
      role: "tester",
      displayName: "Mailbox worker"
    });

    callTool(context, "message.send", { runId: run.id, toKind: "worker", toId: worker.id, body: "first" });
    callTool(context, "message.send", { runId: run.id, toKind: "worker", toId: worker.id, body: "second" });
    const cursorBefore = context.store.mailboxCursors.get("worker", worker.id);
    const deliveredBefore = context.messageService.listMessages({ runId: run.id, toKind: "worker", toId: worker.id }).map((entry) => entry.deliveredAt);

    expectCompatError(() => callTool(context, "message.pull", { recipientKind: "worker", recipientId: worker.id }), "permission_denied");

    const cursorAfter = context.store.mailboxCursors.get("worker", worker.id);
    const deliveredAfter = context.messageService.listMessages({ runId: run.id, toKind: "worker", toId: worker.id }).map((entry) => entry.deliveredAt);
    expect(cursorAfter).toEqual(cursorBefore);
    expect(deliveredAfter).toEqual(deliveredBefore);

    const workerPull = callTool(
      context,
      "message.pull",
      { recipientKind: "worker", recipientId: worker.id, maxItems: 1 },
      { kind: "worker", workerId: worker.id }
    );
    const messages = workerPull.payload.messages as Array<{ body: string }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).toBe("first");
  });

  test("worker.spawn enforces task team scope even when teamId is omitted", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-worker-spawn-team-scope");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "team" });

    const teamA = callTool(context, "team.create", { runId: run.id, name: "Team A", orchestratorRole: "project-manager" });
    const teamB = callTool(context, "team.create", { runId: run.id, name: "Team B" });
    const taskB = callTool(context, "task.create", {
      runId: run.id,
      teamId: teamB.payload.teamId,
      subject: "Scoped work",
      description: "team scoped",
      role: "fullstack-developer",
      stepRef: "phase3.spawn.team.scope"
    });
    const teamAWorkerId = context.teamService.getTeam(teamA.payload.teamId as string).orchestratorWorkerId as string;

    expectCompatError(
      () =>
        callTool(
          context,
          "worker.spawn",
          {
            runId: run.id,
            taskId: taskB.payload.taskId,
            role: "fullstack-developer",
            displayName: "Bypass attempt"
          },
          { kind: "worker", workerId: teamAWorkerId }
        ),
      "permission_denied"
    );
    expect(context.claimService.listClaims({ taskId: taskB.payload.taskId as string })).toHaveLength(0);
  });

  test("approval auto_approve_run is transactionally coupled with policy write", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-approval-auto-policy");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({
      runId: run.id,
      role: "planner",
      subject: "Plan checkpoint",
      description: "auto approve run"
    });
    const worker = context.workerService.registerWorker({
      runId: run.id,
      role: "planner",
      displayName: "Planner worker"
    });
    const approval = callTool(
      context,
      "approval.request",
      {
        runId: run.id,
        taskId: task.id,
        checkpoint: "plan-review",
        question: "Approve?",
        options: [{ code: "approve", label: "Approve" }]
      },
      { kind: "worker", workerId: worker.id }
    );
    const approvalId = (approval.payload.approval as { id: string }).id;
    const policyKey = `approval.policy.run.${run.id}`;
    const settings = context.store.settings as { get(key: string): string | null; set(key: string, value: string): void };
    const originalSet = settings.set.bind(settings);

    settings.set = (key: string, value: string) => {
      if (key === policyKey) {
        throw new Error("injected settings failure");
      }
      originalSet(key, value);
    };
    try {
      expect(() => callTool(context, "approval.respond", { approvalId, responseCode: "auto_approve_run" })).toThrowError(CompatToolError);
      expect(context.approvalService.getApproval(approvalId).status).toBe("pending");
      expect(settings.get(policyKey)).toBeNull();
    } finally {
      settings.set = originalSet;
    }

    const resolved = callTool(context, "approval.respond", { approvalId, responseCode: "auto_approve_run", responseText: "go" });
    expect((resolved.payload.approval as { status: string }).status).toBe("approved");
    expect(settings.get(policyKey)).toBe("auto");
    const policyEvents = context.store.events.listByRun(run.id, 200).filter((event) => event.eventType === "run.approval_policy.updated");
    expect(policyEvents.length).toBeGreaterThan(0);
  });

  test("task.create normalizes ownedPaths and rejects non-relative paths", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-task-owned-paths");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "cook" });

    const created = callTool(context, "task.create", {
      runId: run.id,
      subject: "Owned path normalization",
      description: "normalize paths",
      role: "fullstack-developer",
      stepRef: "phase3.task.owned-paths",
      ownedPaths: ["./src//feature.ts", "src/../src/utils.ts"]
    });
    const task = context.taskService.getTask(created.payload.taskId as string);
    expect(task.fileOwnership).toEqual(["src/feature.ts", "src/utils.ts"]);

    expectCompatError(
      () =>
        callTool(context, "task.create", {
          runId: run.id,
          subject: "Owned path invalid",
          description: "invalid absolute path",
          role: "fullstack-developer",
          stepRef: "phase3.task.owned-paths.invalid",
          ownedPaths: ["/tmp/escape.ts"]
        }),
      "validation_error"
    );
  });

  test("artifact.read supports id and run/path lookup and enforces run scope", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase3-artifact-read");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const runA = context.runService.createRun({ workflow: "cook" });
    const runB = context.runService.createRun({ workflow: "cook" });
    const reportPath = path.join(fixture.rootDir, "artifact-read-report.md");
    writeFileSync(reportPath, "artifact body\n", "utf8");

    const published = callTool(context, "artifact.publish", {
      runId: runA.id,
      kind: "report",
      path: "./artifact-read-report.md",
      summary: "artifact read coverage"
    });
    const artifactId = published.payload.artifactId as string;

    const byId = callTool(context, "artifact.read", { artifactId }, { kind: "user", runId: runA.id });
    const byPath = callTool(context, "artifact.read", { runId: runA.id, path: "./artifact-read-report.md" });

    expect((byId.payload.artifact as { id: string }).id).toBe(artifactId);
    expect((byPath.payload.artifact as { id: string }).id).toBe(artifactId);
    expect((byId.payload.artifact as { path: string }).path).toBe(path.resolve(reportPath));
    expect((byId.payload.artifact as { metadata?: unknown }).metadata).toBeDefined();

    expectCompatError(() => callTool(context, "artifact.read", { artifactId }, { kind: "user", runId: runB.id }), "not_found");
  });
});
