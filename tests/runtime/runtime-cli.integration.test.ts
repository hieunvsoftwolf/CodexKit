import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseCliFailure } from "./helpers/cli-json.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void>> = [];

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliFailure(rootDir: string, args: string[]) {
  try {
    runCli(rootDir, args);
    throw new Error("expected CLI failure");
  } catch (error) {
    return parseCliFailure(error);
  }
}

function runGeneratedHandoffCommand(rootDir: string, command: string) {
  expect(command.startsWith("cdx ")).toBe(true);
  const cliPath = shellQuote(path.resolve(process.cwd(), "cdx"));
  const shellCommand = `${cliPath} ${command.slice(4)} --json`;
  const output = execFileSync("zsh", ["-lc", shellCommand], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 1 CLI", () => {
  test(
    "supports create, list, show, update, and resume inspection flows",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli");
      cleanups.push(() => fixture.cleanup());

      runCli(fixture.rootDir, ["daemon", "start", "--once"]);
      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook", "--mode", "interactive", "--prompt", "add auth"]);
      const runId = String(run.id);
      const task = runCli(fixture.rootDir, [
        "task",
        "create",
        "--run",
        runId,
        "--role",
        "planner",
        "--subject",
        "Create implementation plan"
      ]);
      const taskId = String(task.id);

      const listedRuns = runCli(fixture.rootDir, ["run", "list"]);
      const listedTasks = runCli(fixture.rootDir, ["task", "list", "--run", runId]);
      const shownRun = runCli(fixture.rootDir, ["run", "show", runId]);
      runCli(fixture.rootDir, ["task", "update", taskId, "--status", "completed"]);
      const shownTask = runCli(fixture.rootDir, ["task", "show", taskId]);
      const resume = runCli(fixture.rootDir, ["resume"]);

      expect(Array.isArray(listedRuns)).toBe(true);
      expect(Array.isArray(listedTasks)).toBe(true);
      expect((shownRun.run as { id: string }).id).toBe(runId);
      expect((shownTask.task as { status: string }).status).toBe("completed");
      expect((resume.lastRunId as string | null) ?? null).toBe(runId);
    }
  );

  test(
    "compat call rejects self-asserted caller flags",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-compat-auth");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const failure = runCliFailure(fixture.rootDir, [
        "compat",
        "call",
        "--name",
        "task.list",
        "--payload",
        "{}",
        "--caller-kind",
        "worker",
        "--caller-worker",
        "worker_fake"
      ]);

      expect(failure.code).toBe("CLI_USAGE");
      expect(String(failure.message)).toContain("session-derived");
    }
  );

  test(
    "message pull blocks non-user mailboxes for CLI callers",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-mailbox-authz");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "team"]);
      const runId = String(run.id);
      const worker = runCli(fixture.rootDir, ["worker", "spawn", "--run", runId, "--role", "tester", "--display-name", "CLI worker"]);
      runCli(fixture.rootDir, ["message", "send", "--run", runId, "--to-kind", "worker", "--to-id", String(worker.id), "--body", "hello"]);

      const failure = runCliFailure(fixture.rootDir, [
        "message",
        "pull",
        "--recipient-kind",
        "worker",
        "--recipient-id",
        String(worker.id)
      ]);
      expect(failure.code).toBe("MESSAGE_PERMISSION_DENIED");
    }
  );

  test(
    "message send rejects spoofed --from-kind/--from-worker flags",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-message-spoof");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "team"]);
      const runId = String(run.id);
      const worker = runCli(fixture.rootDir, ["worker", "spawn", "--run", runId, "--role", "tester", "--display-name", "Spoof target"]);

      const failure = runCliFailure(fixture.rootDir, [
        "message",
        "send",
        "--run",
        runId,
        "--to-kind",
        "user",
        "--to-id",
        runId,
        "--body",
        "spoofed as worker",
        "--from-kind",
        "worker",
        "--from-worker",
        String(worker.id)
      ]);

      expect(failure.code).toBe("CLI_USAGE");
      expect(String(failure.message)).toContain("session-derived");
      const shownRun = runCli(fixture.rootDir, ["run", "show", runId]);
      const messages = shownRun.messages as Array<{ body: string }>;
      expect(messages.some((message) => message.body === "spoofed as worker")).toBe(false);
    }
  );

  test(
    "approval request rejects spoofed --requester-worker flag",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-approval-spoof");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook"]);
      const runId = String(run.id);
      const worker = runCli(fixture.rootDir, ["worker", "spawn", "--run", runId, "--role", "planner", "--display-name", "Spoof target"]);

      const failure = runCliFailure(fixture.rootDir, [
        "approval",
        "request",
        "--run",
        runId,
        "--checkpoint",
        "plan-review",
        "--question",
        "Approve?",
        "--option",
        "approve:Approve",
        "--requester-worker",
        String(worker.id)
      ]);

      expect(failure.code).toBe("CLI_USAGE");
      expect(String(failure.message)).toContain("session-derived");
      const approvals = runCli(fixture.rootDir, ["approval", "list", "--run", runId]) as unknown as Array<unknown>;
      expect(approvals).toHaveLength(0);
    }
  );

  test(
    "supports workflow command surface for brainstorm, plan, and cook through implementation boundary",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-workflow-wave1");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const brainstorm = runCli(fixture.rootDir, [
        "brainstorm",
        "phase",
        "five",
        "scope",
        "--handoff",
        "plan",
        "--handoff-task",
        "Plan phase five scope"
      ]);
      expect(brainstorm.workflow).toBe("brainstorm");
      expect(brainstorm.checkpointIds).toEqual(["brainstorm-discovery", "brainstorm-decision", "brainstorm-handoff"]);
      const handoff = brainstorm.handoff as { toRunId: string };
      expect(typeof handoff.toRunId).toBe("string");

      const plan = runCli(fixture.rootDir, ["plan", "Implement", "workflow", "parity", "--hard"]);
      expect(plan.workflow).toBe("plan");
      const planPath = String(plan.planPath);
      expect(path.isAbsolute(planPath)).toBe(true);
      expect(plan.handoffCommand).toBe(`cdx cook ${shellQuote(planPath)}`);

      const cook = runCli(fixture.rootDir, ["cook", planPath]);
      expect(cook.workflow).toBe("cook");
      expect(cook.mode).toBe("code");
      expect(cook.completedThroughPostImplementation).toBe(false);
      const diagnostics = cook.diagnostics as Array<{ code: string }>;
      expect(diagnostics.some((entry) => entry.code === "COOK_IMPLEMENTATION_READY")).toBe(true);
      const pendingApproval = cook.pendingApproval as { checkpoint: string } | undefined;
      expect(pendingApproval?.checkpoint).toBe("post-implementation");
      expect(String(cook.planPath)).toBe(planPath);
    }
  );

  test(
    "plan validate/red-team/archive subcommands require archive approval continuation before mutation and return deterministic outputs",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-plan-subcommands-wave1");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const plan = runCli(fixture.rootDir, ["plan", "Subcommand", "wave", "2", "target", "--hard"]);
      const planPath = String(plan.planPath);
      const validate = runCli(fixture.rootDir, ["plan", "validate", planPath]);
      expect(validate.subcommand).toBe("validate");
      expect(validate.status).toBe("valid");
      expect(String(validate.handoffCommand)).toBe(`cdx cook --auto ${shellQuote(planPath)}`);

      const redTeam = runCli(fixture.rootDir, ["plan", "red-team", planPath]);
      expect(redTeam.subcommand).toBe("red-team");
      expect(redTeam.status).toBe("revise");
      expect(String(redTeam.recommendedNextCommand)).toBe(`cdx plan validate ${shellQuote(planPath)}`);

      const planBeforeArchive = readFileSync(planPath, "utf8");
      const archive = runCli(fixture.rootDir, ["plan", "archive", planPath]) as {
        runId?: string;
        subcommand?: string;
        status?: string;
        pendingApproval?: { approvalId?: string; checkpoint?: string; nextStep?: string };
        archiveSummaryPath?: string;
        archiveJournalPath?: string;
      };
      expect(archive.subcommand).toBe("archive");
      expect(archive.status).toBe("pending");
      expect(archive.pendingApproval?.checkpoint).toBe("plan-archive-confirmation");
      expect(typeof archive.pendingApproval?.approvalId).toBe("string");
      expect(String(archive.pendingApproval?.nextStep ?? "")).toContain("cdx approval respond");
      expect(archive.archiveSummaryPath).toBeUndefined();
      expect(archive.archiveJournalPath).toBeUndefined();
      expect(readFileSync(planPath, "utf8")).toBe(planBeforeArchive);

      const approved = runCli(fixture.rootDir, [
        "approval",
        "respond",
        String(archive.pendingApproval?.approvalId),
        "--response",
        "approve"
      ]) as {
        continuation?: {
          status?: string;
          archiveSummaryPath?: string;
          archiveJournalPath?: string;
          archiveJournalArtifactId?: string;
        };
      };
      expect(approved.continuation?.status).toBe("valid");
      expect(typeof approved.continuation?.archiveSummaryPath).toBe("string");
      expect(typeof approved.continuation?.archiveJournalPath).toBe("string");
      expect(typeof approved.continuation?.archiveJournalArtifactId).toBe("string");
      expect(existsSync(String(approved.continuation?.archiveSummaryPath))).toBe(true);
      expect(existsSync(String(approved.continuation?.archiveJournalPath))).toBe(true);

      const shownRun = runCli(fixture.rootDir, ["run", "show", String(archive.runId)]);
      const artifacts = (shownRun.artifacts ?? []) as Array<{ id?: string; path?: string }>;
      expect(artifacts.some((artifact) => artifact.path === approved.continuation?.archiveSummaryPath)).toBe(true);
      expect(artifacts.some((artifact) => artifact.path === approved.continuation?.archiveJournalPath)).toBe(true);
      expect(artifacts.some((artifact) => artifact.id === approved.continuation?.archiveJournalArtifactId)).toBe(true);

      const planText = readFileSync(planPath, "utf8");
      expect(planText).toContain("## Validation Log");
      expect(planText).toContain("## Red Team Review");
      expect(planText).toContain('status: "archived"');
    }
  );

  test(
    "generated fast and parallel cook handoff commands are runnable",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-runnable-handoff");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const fastPlan = runCli(fixture.rootDir, ["plan", "Fast", "handoff", "check", "--fast"]);
      const fastPlanPath = String(fastPlan.planPath);
      const fastHandoff = String(fastPlan.handoffCommand);
      expect(fastHandoff).toBe(`cdx cook --auto ${shellQuote(fastPlanPath)}`);
      const fastCook = runGeneratedHandoffCommand(fixture.rootDir, fastHandoff);
      expect(fastCook.workflow).toBe("cook");
      expect(fastCook.completedThroughPostImplementation).toBe(true);
      expect(String(fastCook.planPath)).toBe(fastPlanPath);

      const parallelPlan = runCli(fixture.rootDir, ["plan", "Parallel", "handoff", "check", "--parallel"]);
      const parallelPlanPath = String(parallelPlan.planPath);
      const parallelHandoff = String(parallelPlan.handoffCommand);
      expect(parallelHandoff).toBe(`cdx cook --parallel ${shellQuote(parallelPlanPath)}`);
      const parallelCook = runGeneratedHandoffCommand(fixture.rootDir, parallelHandoff);
      expect(parallelCook.workflow).toBe("cook");
      const pendingApproval = parallelCook.pendingApproval as { checkpoint: string } | undefined;
      expect(pendingApproval?.checkpoint).toBe("post-research");
      expect(String(parallelCook.planPath)).toBe(parallelPlanPath);
    }
  );

  test(
    "supports phase 6 wave-1 review/test/debug commands and runs fix/team workflows with typed diagnostics",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-workflow-phase6-wave1");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const reviewRecent = runCli(fixture.rootDir, ["review", "recent", "auth", "path"]);
      expect(reviewRecent.workflow).toBe("review");
      expect(reviewRecent.scope).toBe("recent");
      expect(reviewRecent.checkpointIds).toEqual(["review-scout", "review-analysis", "review-publish"]);

      const reviewCodebase = runCli(fixture.rootDir, ["review", "codebase", "parallel"]);
      expect(reviewCodebase.workflow).toBe("review");
      expect(reviewCodebase.scope).toBe("codebase");
      expect(reviewCodebase.parallel).toBe(true);

      const testCoverage = runCli(fixture.rootDir, ["test", "workflow", "contracts", "--coverage"]);
      expect(testCoverage.workflow).toBe("test");
      expect(testCoverage.mode).toBe("coverage");
      expect(testCoverage.checkpointIds).toEqual(["test-preflight", "test-execution", "test-report"]);

      const testUi = runCli(fixture.rootDir, ["test", "ui"]);
      expect(testUi.workflow).toBe("test");
      expect(testUi.mode).toBe("ui");

      const debug = runCli(fixture.rootDir, ["debug", "ci", "pipeline", "failure", "--branch", "logs-ci"]);
      expect(debug.workflow).toBe("debug");
      expect(Array.isArray(debug.branches)).toBe(true);
      expect((debug.branches as string[]).includes("logs-ci")).toBe(true);
      expect(debug.checkpointIds).toEqual([
        "debug-precheck",
        "debug-route",
        "debug-hypotheses",
        "debug-evidence",
        "debug-conclusion"
      ]);

      const fix = runCli(fixture.rootDir, ["fix", "intermittent", "test", "failure", "--quick"]);
      expect(fix.workflow).toBe("fix");
      expect(fix.mode).toBe("quick");
      expect(fix.route).toBe("quick");
      expect(fix.approvalPolicy).toBe("human-in-the-loop");
      expect(fix.checkpointIds).toEqual(["fix-mode", "fix-diagnose", "fix-route", "fix-implement", "fix-verify"]);
      expect(fix.completed).toBe(true);
      const fixReportPath = String(fix.fixReportPath ?? "");
      expect(existsSync(fixReportPath)).toBe(true);
      const fixDiagnostics = fix.diagnostics as Array<{ code?: string }>;
      expect(fixDiagnostics.some((entry) => entry.code === "FIX_ROUTE_LOCKED")).toBe(true);

      const team = runCli(fixture.rootDir, ["team", "review", "payment", "flow"]);
      expect(team.workflow).toBe("team");
      expect(team.template).toBe("review");
      expect(team.checkpointIds).toEqual(["team-bootstrap", "team-monitor", "team-shutdown"]);
      expect(team.teamStatus).toBe("deleted");
      const teamReportPath = String(team.teamReportPath ?? "");
      expect(existsSync(teamReportPath)).toBe(true);
      const teamDiagnostics = team.diagnostics as Array<{ code?: string }>;
      expect(teamDiagnostics.some((entry) => entry.code === "TEAM_WORKFLOW_COMPLETED")).toBe(true);
    }
  );

  test(
    "worker spawn derives team from team-owned task when --team is omitted",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-spawn-team-derive");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "team"]);
      const runId = String(run.id);
      const team = runCli(fixture.rootDir, ["team", "create", "--run", runId, "--name", "Team B"]);
      const teamId = String(team.id);
      const taskCreate = runCli(fixture.rootDir, [
        "compat",
        "call",
        "--name",
        "task.create",
        "--payload",
        JSON.stringify({
          runId,
          teamId,
          subject: "Scoped team task",
          description: "spawn team enforcement",
          role: "fullstack-developer",
          stepRef: "phase3.cli.spawn.team.scope"
        })
      ]);
      const taskId = String((taskCreate.payload as { taskId: string }).taskId);

      const spawned = runCli(fixture.rootDir, [
        "worker",
        "spawn",
        "--run",
        runId,
        "--task",
        taskId,
        "--role",
        "fullstack-developer",
        "--display-name",
        "Derived team worker"
      ]);

      expect(spawned.teamId).toBe(teamId);
      const claims = runCli(fixture.rootDir, ["claim", "list", "--run", runId]) as unknown as Array<{ taskId: string; workerId: string; status: string }>;
      expect(claims.some((claim) => claim.taskId === taskId && claim.workerId === String(spawned.id) && claim.status === "active")).toBe(true);
    }
  );
});
