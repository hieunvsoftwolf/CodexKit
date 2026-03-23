import { createStableId } from "../ids.ts";
import type { CreateRunInput, JsonObject, RuntimeClock, RunRecord, WorkflowCheckpointId, WorkflowCheckpointResponse } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { RuntimeStore, RunListFilters } from "../repository-contracts.ts";
import { nextRunStatus, nowIso } from "../service-helpers.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class RunService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(
    store: RuntimeStore,
    clock: RuntimeClock
  ) {
    this.store = store;
    this.clock = clock;
  }

  createRun(input: CreateRunInput): RunRecord {
    invariant(input.workflow.trim().length > 0, "RUN_WORKFLOW_REQUIRED", "run workflow is required");

    return this.store.transaction(() => {
      const timestamp = nowIso(this.clock);
      const record: RunRecord = {
        id: createStableId("run"),
        workflow: input.workflow,
        mode: input.mode ?? "interactive",
        status: "pending",
        rootTaskId: null,
        parentRunId: input.parentRunId ?? null,
        planDir: input.planDir ?? null,
        initiatedBy: "user",
        commandLine: input.prompt?.trim() ? input.prompt.trim() : null,
        metadata: input.metadata ?? {},
        startedAt: null,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const run = this.store.runs.create(record);
      this.store.settings.set("runtime.last_run_id", run.id);
      this.store.events.append({
        runId: run.id,
        entityType: "run",
        entityId: run.id,
        eventType: "run.created",
        payload: { status: run.status, workflow: run.workflow }
      });
      return run;
    });
  }

  listRuns(filters?: RunListFilters): RunRecord[] {
    return this.store.runs.list(filters);
  }

  getRun(id: string): RunRecord {
    const run = this.store.runs.getById(id);
    invariant(run, "RUN_NOT_FOUND", `run '${id}' was not found`);
    return run;
  }

  updateRun(id: string, patch: Partial<RunRecord>): RunRecord {
    return this.store.transaction(() => this.store.runs.update(id, { ...patch, updatedAt: nowIso(this.clock) }));
  }

  updateRunMetadata(runId: string, patch: JsonObject): RunRecord {
    return this.store.transaction(() => {
      const run = this.getRun(runId);
      const metadata = { ...asRecord(run.metadata), ...patch };
      return this.store.runs.update(runId, {
        metadata,
        updatedAt: nowIso(this.clock)
      });
    });
  }

  setPlanDir(runId: string, planDir: string): RunRecord {
    return this.updateRun(runId, { planDir });
  }

  recordWorkflowCheckpoint(
    runId: string,
    checkpointId: WorkflowCheckpointId,
    options?: { artifactPath?: string; artifactId?: string; response?: WorkflowCheckpointResponse; noFile?: boolean }
  ): RunRecord {
    return this.store.transaction(() => {
      const run = this.getRun(runId);
      const metadata = asRecord(run.metadata);
      const workflow = asRecord(metadata.workflow);
      const checkpoints = asRecord(workflow.checkpoints);
      checkpoints[checkpointId] = {
        id: checkpointId,
        status: "completed",
        completedAt: nowIso(this.clock),
        ...(options?.artifactPath ? { artifactPath: options.artifactPath } : {}),
        ...(options?.artifactId ? { artifactId: options.artifactId } : {}),
        ...(options?.response ? { response: options.response } : {}),
        ...(typeof options?.noFile === "boolean" ? { noFile: options.noFile } : {})
      };
      const updated = this.store.runs.update(runId, {
        metadata: {
          ...metadata,
          workflow: {
            ...workflow,
            currentCheckpoint: checkpointId,
            checkpoints
          }
        },
        updatedAt: nowIso(this.clock)
      });
      this.store.events.append({
        runId,
        entityType: "run",
        entityId: runId,
        eventType: "run.checkpoint.recorded",
        payload: {
          checkpointId,
          ...(options?.artifactPath ? { artifactPath: options.artifactPath } : {}),
          ...(options?.artifactId ? { artifactId: options.artifactId } : {}),
          ...(options?.response ? { response: options.response } : {})
        }
      });
      return updated;
    });
  }

  recomputeRun(runId: string): RunRecord {
    return this.store.transaction(() => {
      const run = this.getRun(runId);
      const tasks = this.store.tasks.list({ runId });
      const approvals = this.store.approvals.list({ runId });
      const status = nextRunStatus(run, tasks, approvals);
      const timestamp = nowIso(this.clock);
      const patch: Partial<RunRecord> = {};

      if (status !== run.status) {
        patch.status = status;
      }

      if (!run.startedAt && tasks.some((task) => task.status !== "pending")) {
        patch.startedAt = timestamp;
      }

      if (status === "completed" || status === "failed" || status === "cancelled") {
        patch.completedAt = run.completedAt ?? timestamp;
      }

      if (Object.keys(patch).length === 0) {
        return run;
      }

      patch.updatedAt = timestamp;
      const updated = this.store.runs.update(runId, patch);
      this.store.events.append({
        runId,
        entityType: "run",
        entityId: runId,
        eventType: "run.recomputed",
        payload: { status: updated.status }
      });
      return updated;
    });
  }

  resumeCandidates(limit = 5): RunRecord[] {
    return this.store.runs.list({ activeOnly: true, limit });
  }
}
