import { RuntimeEventDispatcher } from "./event-dispatcher.ts";
import type { RuntimeContext } from "./runtime-context.ts";

export function runReconciliationPass(context: RuntimeContext): { cursor: number } {
  context.claimService.expireStaleClaims();
  context.workerService.markStaleWorkers(context.config.workerStaleMs);
  context.approvalService.expireApprovals();

  const dispatcher = new RuntimeEventDispatcher(context);
  const cursor = dispatcher.dispatchPending();

  for (const task of context.store.tasks.list()) {
    context.taskService.recomputeTask(task.id);
  }
  for (const run of context.store.runs.list()) {
    context.runService.recomputeRun(run.id);
  }

  return { cursor };
}
