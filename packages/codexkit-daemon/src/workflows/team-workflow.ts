import { CodexkitError, type WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

type TeamTemplate = "research" | "cook" | "review" | "debug";

interface TeamCounts {
  devs: number;
  researchers: number;
  reviewers: number;
  debuggers: number;
}

export interface TeamWorkflowInput {
  template: string;
  context: string;
  devs?: number;
  researchers?: number;
  reviewers?: number;
  debuggers?: number;
  planApproval?: boolean;
  delegate?: boolean;
}

export interface TeamWorkflowResult extends WorkflowBaseResult {
  workflow: "team";
  template: TeamTemplate;
  context: string;
  teamId: string;
  teamStatus: "active" | "idle" | "waiting" | "shutting_down" | "deleted";
  workerCount: number;
  taskCount: number;
  teamReportPath: string;
  teamReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

function parseTemplate(input: string): TeamTemplate {
  const normalized = input.trim().toLowerCase();
  if (normalized === "research" || normalized === "cook" || normalized === "review" || normalized === "debug") {
    return normalized;
  }
  throw new CodexkitError("CLI_USAGE", "unsupported team template", {
    code: "WF_TEAM_TEMPLATE_INVALID",
    cause: `Template '${input}' is not supported in this workflow port.`,
    nextStep: "Use one of: research, cook, review, debug."
  });
}

function normalizeCount(value: number | undefined, fallback: number, field: string): number {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 0 || resolved > 8) {
    throw new CodexkitError("CLI_USAGE", `${field} count must be an integer between 0 and 8`, {
      code: "WF_TEAM_COUNT_INVALID",
      cause: `Received ${String(value)} for ${field}.`,
      nextStep: `Retry with --${field} <0..8>.`
    });
  }
  return resolved;
}

function resolveCounts(template: TeamTemplate, input: TeamWorkflowInput): TeamCounts {
  const defaults: Record<TeamTemplate, TeamCounts> = {
    research: { devs: 0, researchers: 2, reviewers: 0, debuggers: 0 },
    cook: { devs: 2, researchers: 1, reviewers: 1, debuggers: 0 },
    review: { devs: 0, researchers: 0, reviewers: 2, debuggers: 0 },
    debug: { devs: 0, researchers: 0, reviewers: 0, debuggers: 2 }
  };
  const fallback = defaults[template];
  return {
    devs: normalizeCount(input.devs, fallback.devs, "devs"),
    researchers: normalizeCount(input.researchers, fallback.researchers, "researchers"),
    reviewers: normalizeCount(input.reviewers, fallback.reviewers, "reviewers"),
    debuggers: normalizeCount(input.debuggers, fallback.debuggers, "debuggers")
  };
}

function roleAssignments(counts: TeamCounts): string[] {
  return [
    ...Array.from({ length: counts.devs }, () => "fullstack-developer"),
    ...Array.from({ length: counts.researchers }, () => "researcher"),
    ...Array.from({ length: counts.reviewers }, () => "code-reviewer"),
    ...Array.from({ length: counts.debuggers }, () => "debugger")
  ];
}

function templateTaskSubject(template: TeamTemplate, role: string, index: number): string {
  if (template === "research") {
    return `Research angle ${index + 1} (${role})`;
  }
  if (template === "cook") {
    return `Cook pipeline task ${index + 1} (${role})`;
  }
  if (template === "review") {
    return `Review scope ${index + 1} (${role})`;
  }
  return `Debug hypothesis ${index + 1} (${role})`;
}

export function runTeamWorkflow(context: RuntimeContext, input: TeamWorkflowInput): TeamWorkflowResult {
  const template = parseTemplate(input.template);
  const contextText = input.context.trim();
  const counts = resolveCounts(template, input);
  const roles = roleAssignments(counts);
  const run = context.runService.createRun({
    workflow: "team",
    mode: "parallel",
    prompt: `${template} ${contextText}`.trim()
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];

  const team = context.teamService.createTeam({
    runId: run.id,
    name: `${template}-team`,
    description: contextText,
    orchestratorRole: "lead",
    metadata: {
      template,
      delegate: input.delegate === true,
      planApproval: input.planApproval !== false
    }
  });

  const bootstrapTask = context.taskService.createTask({
    runId: run.id,
    teamId: team.id,
    role: "lead",
    subject: "Team bootstrap",
    description: "Bootstrap team runtime, context, and execution topology."
  });
  context.taskService.updateTask(bootstrapTask.id, { status: "completed" });
  const bootstrapReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "team-bootstrap",
    fileName: "team-bootstrap-report.md",
    summary: "team bootstrap report",
    markdown: [
      "# Team Bootstrap Report",
      "",
      `- Template: ${template}`,
      `- Context: ${contextText}`,
      `- Delegate mode: ${input.delegate === true ? "on" : "off"}`,
      `- Plan approval: ${input.planApproval === false ? "off" : "on"}`,
      `- Planned workers: ${roles.length}`,
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(run.id, "team-bootstrap", {
    artifactPath: bootstrapReport.artifactPath,
    artifactId: bootstrapReport.artifactId
  });
  checkpointIds.push("team-bootstrap");

  const seededTaskIds: string[] = [];
  const workerIds: string[] = [];
  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index]!;
    const task = context.taskService.createTask({
      runId: run.id,
      teamId: team.id,
      role,
      subject: templateTaskSubject(template, role, index),
      description: `Template ${template} execution slice owned by ${role}.`,
      dependsOn: [bootstrapTask.id]
    });
    const worker = context.workerService.registerWorker({
      runId: run.id,
      teamId: team.id,
      role,
      displayName: `${role}-${index + 1}`,
      executionMode: "local_worktree",
      metadata: {
        template,
        delegatedByLead: input.delegate === true
      }
    });
    const claim = context.claimService.createClaim({
      taskId: task.id,
      workerId: worker.id,
      leaseMs: 30_000,
      note: "team-workflow"
    });
    context.messageService.sendMessage({
      runId: run.id,
      teamId: team.id,
      fromKind: "system",
      fromId: "team-orchestrator",
      fromWorkerId: null,
      toKind: "worker",
      toId: worker.id,
      messageType: "message",
      body: `Start ${template} assignment: ${task.subject}.`,
      metadata: { template, taskId: task.id }
    });
    context.claimService.releaseClaim(claim.id);
    context.taskService.updateTask(task.id, { status: "completed" });
    context.workerService.updateWorker(worker.id, { state: "idle" });
    seededTaskIds.push(task.id);
    workerIds.push(worker.id);
  }

  const monitorTask = context.taskService.createTask({
    runId: run.id,
    teamId: team.id,
    role: "lead",
    subject: "Monitor team events",
    description: "Track task completion, worker idle state, and team message flow.",
    dependsOn: seededTaskIds
  });
  context.taskService.updateTask(monitorTask.id, { status: "completed" });
  const monitorReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "team-monitor",
    fileName: "team-monitor-report.md",
    summary: "team monitor report",
    markdown: [
      "# Team Monitor Report",
      "",
      `- Template: ${template}`,
      `- Team ID: ${team.id}`,
      `- Worker count: ${workerIds.length}`,
      `- Seeded task count: ${seededTaskIds.length}`,
      `- Message count: ${context.messageService.listMessages({ runId: run.id }).length}`,
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(run.id, "team-monitor", {
    artifactPath: monitorReport.artifactPath,
    artifactId: monitorReport.artifactId
  });
  checkpointIds.push("team-monitor");

  const shutdownTask = context.taskService.createTask({
    runId: run.id,
    teamId: team.id,
    role: "lead",
    subject: "Shutdown team runtime",
    description: "Drain workers, emit shutdown evidence, and delete team.",
    dependsOn: [monitorTask.id]
  });

  const firstDelete = context.teamService.deleteTeam(team.id, "team workflow completed");
  const shutdownWorkerIds = Array.from(
    new Set([
      ...workerIds,
      ...(team.orchestratorWorkerId ? [team.orchestratorWorkerId] : [])
    ])
  );
  for (const workerId of shutdownWorkerIds) {
    context.workerService.updateWorker(workerId, {
      state: "stopped",
      stoppedAt: context.clock.now().toISOString()
    });
    context.messageService.sendMessage({
      runId: run.id,
      teamId: team.id,
      fromKind: "worker",
      fromId: workerId,
      fromWorkerId: workerId,
      toKind: "team",
      toId: team.id,
      messageType: "shutdown_response",
      body: "Worker drained and stopped.",
      metadata: { template }
    });
  }
  const finalTeam = context.teamService.deleteTeam(team.id, "team workflow completed");

  const shutdownReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "team-shutdown",
    fileName: "team-workflow-report.md",
    summary: "team workflow shutdown report",
    markdown: [
      "# Team Workflow Report",
      "",
      `- Template: ${template}`,
      `- Team ID: ${team.id}`,
      `- Initial shutdown status: ${firstDelete.status}`,
      `- Final shutdown status: ${finalTeam.status}`,
      `- Worker count: ${workerIds.length}`,
      `- Shutdown workers drained: ${shutdownWorkerIds.length}`,
      `- Task count: ${seededTaskIds.length + 3}`,
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  if (finalTeam.status !== "deleted") {
    context.taskService.updateTask(shutdownTask.id, {
      status: "blocked",
      blockingReason: `team '${team.id}' remained '${finalTeam.status}' after worker drain`
    });
    diagnostics.push({
      code: "TEAM_SHUTDOWN_INCOMPLETE",
      cause: `Team remained '${finalTeam.status}' after shutdown drain, so completion was not recorded.`,
      nextStep: "Inspect team-workflow-report.md, resolve worker lifecycle drift, and rerun cdx team."
    });
    return {
      runId: run.id,
      workflow: "team",
      template,
      context: contextText,
      teamId: team.id,
      teamStatus: finalTeam.status,
      workerCount: workerIds.length,
      taskCount: seededTaskIds.length + 3,
      checkpointIds,
      teamReportPath: shutdownReport.artifactPath,
      teamReportArtifactId: shutdownReport.artifactId,
      diagnostics
    };
  }
  context.taskService.updateTask(shutdownTask.id, { status: "completed" });
  context.runService.recordWorkflowCheckpoint(run.id, "team-shutdown", {
    artifactPath: shutdownReport.artifactPath,
    artifactId: shutdownReport.artifactId
  });
  checkpointIds.push("team-shutdown");

  diagnostics.push({
    code: "TEAM_WORKFLOW_COMPLETED",
    cause: `Template '${template}' executed with team/task/worker/message/claim primitives.`,
    nextStep: "Inspect team-workflow-report.md for bootstrap, monitor, and shutdown details."
  });

  return {
    runId: run.id,
    workflow: "team",
    template,
    context: contextText,
    teamId: team.id,
    teamStatus: finalTeam.status,
    workerCount: workerIds.length,
    taskCount: seededTaskIds.length + 3,
    checkpointIds,
    teamReportPath: shutdownReport.artifactPath,
    teamReportArtifactId: shutdownReport.artifactId,
    diagnostics
  };
}
