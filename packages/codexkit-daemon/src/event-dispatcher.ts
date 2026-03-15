import { CodexkitError } from "../../codexkit-core/src/index.ts";
import type { EventRecord } from "../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "./runtime-context.ts";

const CURSOR_KEY = "daemon.event_cursor";

export class RuntimeEventDispatcher {
  private readonly context: RuntimeContext;

  constructor(context: RuntimeContext) {
    this.context = context;
  }

  dispatchPending(): number {
    let cursor = Number(this.context.store.settings.get(CURSOR_KEY) ?? "0");
    const events = this.context.eventService.drain(cursor, this.context.config.eventBatchSize);
    for (const event of events) {
      this.handleEvent(event);
      cursor = event.id;
      this.context.store.settings.set(CURSOR_KEY, String(cursor));
    }
    return cursor;
  }

  private handleEvent(event: EventRecord): void {
    switch (event.entityType) {
      case "task":
        this.context.taskService.recomputeTask(event.entityId);
        if (event.runId) {
          this.context.runService.recomputeRun(event.runId);
        }
        return;
      case "claim": {
        const claim = this.context.store.claims.getById(event.entityId);
        if (claim) {
          this.context.taskService.recomputeTask(claim.taskId);
          const task = this.context.store.tasks.getById(claim.taskId);
          if (task) {
            this.context.runService.recomputeRun(task.runId);
          }
        }
        return;
      }
      case "approval": {
        const approval = this.context.store.approvals.getById(event.entityId);
        if (approval?.taskId) {
          this.context.taskService.recomputeTask(approval.taskId);
        }
        if (approval?.runId) {
          this.context.runService.recomputeRun(approval.runId);
        }
        return;
      }
      case "worker":
        if (event.runId) {
          this.context.runService.recomputeRun(event.runId);
        }
        return;
      case "run":
        return;
      default:
        throw new CodexkitError("EVENT_UNSUPPORTED", `unsupported event entity '${String(event.entityType)}'`);
    }
  }
}
