import { readDaemonStatus } from "./daemon-state.ts";
import { runReconciliationPass } from "./runtime-kernel.ts";
import { loadRuntimeConfig } from "./runtime-config.ts";
import { createSystemClock, openRuntimeContext } from "./runtime-context.ts";

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

  listRuns() {
    return this.context.runService.listRuns();
  }

  showRun(runId: string) {
    return {
      run: this.context.runService.getRun(runId),
      tasks: this.context.taskService.listTasks({ runId }),
      workers: this.context.workerService.listWorkers({ runId }),
      claims: this.context.claimService.listClaims({ runId }),
      approvals: this.context.approvalService.listApprovals({ runId }),
      artifacts: this.context.artifactService.listArtifacts({ runId }),
      events: this.context.eventService.listRunEvents(runId)
    };
  }

  resume() {
    const lastRunId = this.context.store.settings.get("runtime.last_run_id");
    const runs = this.context.runService.resumeCandidates();
    return { lastRunId, runs, suggestion: runs[0] ? `cdx run show ${runs[0].id}` : null };
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

  showApproval(approvalId: string) {
    return {
      approval: this.context.approvalService.getApproval(approvalId),
      events: this.context.eventService.listEntityEvents("approval", approvalId)
    };
  }
}
