import { CodexkitError } from "../../codexkit-core/src/index.ts";
import { invokeCompatTool, type CompatCaller, type CompatToolRequest } from "../../codexkit-compat-mcp/src/index.ts";
import { readDaemonStatus } from "./daemon-state.ts";
import { runReconciliationPass } from "./runtime-kernel.ts";
import { loadRuntimeConfig } from "./runtime-config.ts";
import { createSystemClock, openRuntimeContext } from "./runtime-context.ts";
import {
  readInstallState,
  runDoctorWorkflow,
  resumeWorkflowFromApproval,
  runBrainstormWorkflow,
  runCookWorkflow,
  runDebugWorkflow,
  runFinalizeWorkflow,
  runInitWorkflow,
  runPlanArchiveWorkflow,
  runPlanRedTeamWorkflow,
  runPlanValidateWorkflow,
  runPlanWorkflow,
  runResumeWorkflow,
  runReviewWorkflow,
  runSharedRepoScan,
  runTestWorkflow,
  runUpdateWorkflow,
  type WorkflowName,
  type PlanMode
} from "./workflows/index.ts";

export class RuntimeController {
  private readonly config;
  private readonly context;

  constructor(rootDir = process.cwd()) {
    this.config = loadRuntimeConfig(rootDir);
    this.context = openRuntimeContext(this.config, createSystemClock());
  }

  close(): void {
    this.context.close();
  }

  private assertWorkerWorkflowAllowed(command: string): void {
    const installState = readInstallState(this.config.paths.rootDir);
    if (!installState?.installOnly) {
      return;
    }
    const scan = runSharedRepoScan(this.config.paths.rootDir);
    if (scan.hasInitialCommit) {
      return;
    }
    throw new CodexkitError("WORKFLOW_BLOCKED", `${command} is blocked while repository is install-only`, {
      code: "WF_INSTALL_ONLY_REPO_BLOCKED",
      cause: "Repository is marked install-only and has no initial commit, so worker-backed workflows are blocked.",
      nextStep: `Create the first commit, run cdx doctor, then rerun ${command}.`
    });
  }

  daemonStatus() {
    return readDaemonStatus(this.config.paths);
  }

  reconcile() {
    return runReconciliationPass(this.context);
  }

  createRun(input: { workflow: string; mode?: "interactive" | "auto" | "fast" | "parallel" | "no-test" | "code"; prompt?: string }) {
    const run = this.context.runService.createRun(input);
    this.reconcile();
    return run;
  }

  brainstorm(input: {
    topic: string;
    constraints?: string[];
    mode?: "interactive" | "auto" | "fast" | "parallel" | "no-test" | "code";
    handoffToPlan?: boolean;
    handoffTask?: string;
    handoffMode?: "interactive" | "auto" | "fast" | "parallel" | "no-test" | "code";
    inheritAutoApproval?: boolean;
  }) {
    const result = runBrainstormWorkflow(this.context, {
      topic: input.topic,
      ...(input.constraints ? { constraints: input.constraints } : {}),
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.handoffToPlan ? { handoffToPlan: true } : {}),
      ...(input.handoffTask ? { handoffTask: input.handoffTask } : {}),
      ...(input.handoffMode || input.inheritAutoApproval !== undefined
        ? {
            handoffPolicy: {
              ...(input.handoffMode ? { mode: input.handoffMode } : {}),
              ...(input.inheritAutoApproval !== undefined ? { inheritAutoApproval: input.inheritAutoApproval } : {})
            }
          }
        : {})
    });
    this.reconcile();
    return result;
  }

  plan(input: { task: string; mode?: PlanMode; noTasks?: boolean }) {
    const result = runPlanWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  planValidate(input: { planPath: string }) {
    const result = runPlanValidateWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  planRedTeam(input: { planPath: string }) {
    const result = runPlanRedTeamWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  planArchive(input: { planPath?: string }) {
    const result = runPlanArchiveWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  cook(input: { planPath?: string; mode?: "interactive" | "auto" | "fast" | "parallel" | "no-test" | "code" }) {
    this.assertWorkerWorkflowAllowed("cdx cook");
    const result = runCookWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  review(input: { context?: string; scope?: "recent" | "codebase"; parallel?: boolean }) {
    this.assertWorkerWorkflowAllowed("cdx review");
    const result = runReviewWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  test(input: { context?: string; mode?: "default" | "ui" | "coverage" | "chooser"; url?: string }) {
    this.assertWorkerWorkflowAllowed("cdx test");
    const result = runTestWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  debug(input: { issue: string; branch?: "code" | "logs-ci" | "database" | "performance" | "frontend" }) {
    this.assertWorkerWorkflowAllowed("cdx debug");
    const result = runDebugWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  init(input: {
    apply?: boolean;
    initGit?: boolean;
    approveGitInit?: boolean;
    approveProtected?: boolean;
    approveManagedOverwrite?: boolean;
  }) {
    const result = runInitWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  update(input: {
    apply?: boolean;
    approveProtected?: boolean;
    approveManagedOverwrite?: boolean;
  }) {
    const result = runUpdateWorkflow(this.context, input);
    this.reconcile();
    return result;
  }

  doctor() {
    const result = runDoctorWorkflow(this.context);
    this.reconcile();
    return result;
  }

  finalize(input: { runId: string; planPathHint?: string }) {
    const run = this.context.runService.getRun(input.runId);
    const workflow = run.workflow as WorkflowName;
    const result = runFinalizeWorkflow(this.context, {
      runId: input.runId,
      workflow,
      ...(input.planPathHint ? { planPathHint: input.planPathHint } : {})
    });
    this.reconcile();
    return result;
  }

  listRuns() {
    return this.context.runService.listRuns();
  }

  showRun(runId: string) {
    return {
      run: this.context.runService.getRun(runId),
      teams: this.context.teamService.listTeams({ runId }),
      tasks: this.context.taskService.listTasks({ runId }),
      workers: this.context.workerService.listWorkers({ runId }),
      claims: this.context.claimService.listClaims({ runId }),
      messages: this.context.messageService.listMessages({ runId }),
      approvals: this.context.approvalService.listApprovals({ runId }),
      artifacts: this.context.artifactService.listArtifacts({ runId }),
      events: this.context.eventService.listRunEvents(runId)
    };
  }

  resume(input?: { runId?: string }) {
    return runResumeWorkflow(this.context, input ?? {});
  }

  createTask(input: { runId: string; role: string; subject: string; description?: string; dependsOn?: string[] }) {
    const task = this.context.taskService.createTask(input);
    this.reconcile();
    return this.context.taskService.getTask(task.id);
  }

  listTasks(runId?: string) {
    return this.context.taskService.listTasks(runId ? { runId } : undefined);
  }

  showTask(taskId: string) {
    const task = this.context.taskService.getTask(taskId);
    return {
      task,
      dependencies: this.context.store.tasks.getDependencies(taskId),
      claims: this.context.claimService.listClaims({ taskId }),
      approvals: this.context.approvalService.listApprovals({ taskId }),
      events: this.context.eventService.listEntityEvents("task", taskId)
    };
  }

  updateTask(taskId: string, input: { status?: "pending" | "ready" | "in_progress" | "blocked" | "completed" | "failed" | "cancelled"; blockingReason?: string }) {
    const task = this.context.taskService.updateTask(taskId, input);
    this.reconcile();
    return task;
  }

  createTeam(input: { runId: string; name: string; description?: string; orchestratorRole?: string; metadata?: Record<string, unknown> }) {
    const team = this.context.teamService.createTeam(input);
    this.reconcile();
    return team;
  }

  listTeams(runId?: string) {
    return this.context.teamService.listTeams(runId ? { runId } : undefined);
  }

  deleteTeam(teamId: string, reason?: string) {
    const team = this.context.teamService.deleteTeam(teamId, reason);
    this.reconcile();
    return team;
  }

  spawnWorker(input: {
    runId: string;
    role: string;
    displayName?: string;
    teamId?: string;
    taskId?: string;
    executionMode?: "local_worktree" | "local_shared" | "cloud_task";
    ownedPaths?: string[];
    readOnly?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    if ((input.executionMode ?? "local_worktree") !== "local_worktree") {
      throw new CodexkitError("not_supported", `execution mode '${input.executionMode}' is not supported in phase 3`);
    }
    let effectiveTeamId: string | null = input.teamId ?? null;
    if (effectiveTeamId) {
      const team = this.context.teamService.getTeam(effectiveTeamId);
      if (team.runId !== input.runId) {
        throw new CodexkitError("validation_error", `team '${effectiveTeamId}' must belong to run '${input.runId}'`);
      }
    }
    if (input.taskId) {
      const task = this.context.taskService.getTask(input.taskId);
      if (task.runId !== input.runId) {
        throw new CodexkitError("validation_error", `task '${input.taskId}' must belong to run '${input.runId}'`);
      }
      if (effectiveTeamId !== null && task.teamId !== effectiveTeamId) {
        throw new CodexkitError("validation_error", "task team does not match worker team");
      }
      if (effectiveTeamId === null) {
        effectiveTeamId = task.teamId;
      }
      const existingWorker = this.context.store.workers.findCompatibleLiveByTask(input.taskId);
      if (existingWorker) {
        return existingWorker;
      }
    }
    const worker = this.context.workerService.registerWorker({
      runId: input.runId,
      role: input.role,
      displayName: input.displayName ?? `${input.role} worker`,
      teamId: effectiveTeamId,
      executionMode: "local_worktree",
      ownedPaths: input.ownedPaths ?? [],
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.readOnly ? { readOnly: true } : {})
      }
    });
    if (input.taskId) {
      this.context.claimService.createClaim({ taskId: input.taskId, workerId: worker.id, leaseMs: 30_000, note: "worker.spawn" });
    }
    this.reconcile();
    return this.context.workerService.getWorker(worker.id);
  }

  sendMessage(input: {
    runId: string;
    toKind: "user" | "worker" | "team";
    toId: string;
    body: string;
    messageType?: "message" | "status" | "shutdown_request" | "shutdown_response" | "approval_request" | "approval_response" | "plan_approval_response";
    subject?: string;
    priority?: number;
    metadata?: Record<string, unknown>;
  }) {
    const message = this.context.messageService.sendMessage({
      runId: input.runId,
      fromKind: "user",
      fromId: "terminal",
      fromWorkerId: null,
      toKind: input.toKind,
      toId: input.toId,
      messageType: input.messageType ?? "message",
      priority: input.priority ?? 100,
      subject: input.subject ?? null,
      body: input.body,
      metadata: input.metadata ?? {}
    });
    this.reconcile();
    return message;
  }

  pullMessages(input: { recipientKind: "user" | "worker" | "team"; recipientId: string; maxItems?: number; sinceMessageId?: string }) {
    if (input.recipientKind !== "user") {
      throw new CodexkitError("MESSAGE_PERMISSION_DENIED", "CLI caller can only pull user mailboxes");
    }
    if (!this.context.store.runs.getById(input.recipientId)) {
      throw new CodexkitError("RUN_NOT_FOUND", `run '${input.recipientId}' was not found`);
    }
    return this.context.messageService.pullMessages(input);
  }

  listClaims(runId?: string) {
    return this.context.claimService.listClaims(runId ? { runId } : undefined);
  }

  listWorkers(runId?: string) {
    return this.context.workerService.listWorkers(runId ? { runId } : undefined);
  }

  showWorker(workerId: string) {
    return {
      worker: this.context.workerService.getWorker(workerId),
      claims: this.context.claimService.listClaims({ workerId }),
      events: this.context.eventService.listEntityEvents("worker", workerId)
    };
  }

  listApprovals(runId?: string) {
    return this.context.approvalService.listApprovals(runId ? { runId } : undefined);
  }

  requestApproval(input: {
    runId: string;
    taskId?: string;
    checkpoint: string;
    question: string;
    options?: Array<{ code: string; label: string; description?: string }>;
    expiresAt?: string;
  }) {
    const approval = this.context.approvalService.requestApproval(input);
    this.reconcile();
    return approval;
  }

  respondApproval(input: { approvalId: string; status: "approved" | "revised" | "rejected" | "aborted" | "expired"; responseText?: string }) {
    const approval = this.context.approvalService.respondApproval(input.approvalId, input.status, input.responseText);
    const continuation = resumeWorkflowFromApproval(this.context, approval);
    this.reconcile();
    return continuation ? { ...approval, continuation } : approval;
  }

  showApproval(approvalId: string) {
    return {
      approval: this.context.approvalService.getApproval(approvalId),
      events: this.context.eventService.listEntityEvents("approval", approvalId)
    };
  }

  publishArtifact(input: {
    runId: string;
    kind: "report" | "patch" | "test-log" | "review" | "plan" | "summary" | "screenshot" | "trace" | "docs";
    path: string;
    summary?: string;
    taskId?: string;
    workerId?: string;
    checksum?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.context.artifactService.publishArtifact({
      runId: input.runId,
      taskId: input.taskId ?? null,
      workerId: input.workerId ?? null,
      artifactKind: input.kind,
      path: input.path,
      summary: input.summary ?? "",
      checksum: input.checksum ?? null,
      mimeType: input.mimeType ?? null,
      metadata: input.metadata ?? {}
    });
  }

  readArtifact(input: { artifactId?: string; runId?: string; path?: string }) {
    return this.context.artifactService.readArtifact(input);
  }

  invokeCompat(request: CompatToolRequest, caller: CompatCaller = { kind: "user" }) {
    const result = invokeCompatTool(this.context, caller, request);
    if (
      request.name.endsWith(".create") ||
      request.name.endsWith(".update") ||
      request.name.endsWith(".delete") ||
      request.name.endsWith(".spawn") ||
      request.name.endsWith(".send") ||
      request.name.endsWith(".request") ||
      request.name.endsWith(".respond") ||
      request.name.endsWith(".publish")
    ) {
      this.reconcile();
    }
    return result;
  }
}
