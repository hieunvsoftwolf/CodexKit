import path from "node:path";
import type { RunRecord, WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RunService } from "../../../codexkit-core/src/services/run-service.ts";
import type { WorkflowCheckpointEntry, WorkflowState } from "./contracts.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseCheckpointEntry(value: unknown): WorkflowCheckpointEntry | null {
  const record = asRecord(value);
  const id = typeof record.id === "string" ? (record.id as WorkflowCheckpointId) : null;
  const completedAt = typeof record.completedAt === "string" ? record.completedAt : null;
  if (!id || !completedAt) {
    return null;
  }
  return {
    id,
    status: "completed",
    completedAt,
    ...(typeof record.artifactPath === "string" ? { artifactPath: record.artifactPath } : {}),
    ...(typeof record.artifactId === "string" ? { artifactId: record.artifactId } : {}),
    ...(typeof record.response === "string"
      ? { response: record.response as "approved" | "revised" | "aborted" }
      : {}),
    ...(typeof record.noFile === "boolean" ? { noFile: record.noFile } : {})
  };
}

export function readWorkflowState(run: RunRecord): WorkflowState {
  const workflowRecord = asRecord(asRecord(run.metadata).workflow);
  const checkpointRecord = asRecord(workflowRecord.checkpoints);
  const checkpoints: WorkflowState["checkpoints"] = {};
  for (const key of Object.keys(checkpointRecord)) {
    const entry = parseCheckpointEntry(checkpointRecord[key]);
    if (entry) {
      checkpoints[entry.id] = entry;
    }
  }

  return {
    ...(typeof workflowRecord.currentCheckpoint === "string"
      ? { currentCheckpoint: workflowRecord.currentCheckpoint as WorkflowCheckpointId }
      : {}),
    checkpoints,
    ...(typeof workflowRecord.activePlanPath === "string" ? { activePlanPath: workflowRecord.activePlanPath } : {}),
    ...(typeof workflowRecord.suggestedPlanPath === "string" ? { suggestedPlanPath: workflowRecord.suggestedPlanPath } : {})
  };
}

export function writeWorkflowState(runService: RunService, runId: string, nextState: WorkflowState): RunRecord {
  const checkpointsRecord: Record<string, WorkflowCheckpointEntry> = {};
  for (const [checkpointId, checkpoint] of Object.entries(nextState.checkpoints)) {
    if (checkpoint) {
      checkpointsRecord[checkpointId] = checkpoint;
    }
  }
  return runService.updateRunMetadata(runId, {
    workflow: {
      ...(nextState.currentCheckpoint ? { currentCheckpoint: nextState.currentCheckpoint } : {}),
      checkpoints: checkpointsRecord,
      ...(nextState.activePlanPath ? { activePlanPath: path.resolve(nextState.activePlanPath) } : {}),
      ...(nextState.suggestedPlanPath ? { suggestedPlanPath: path.resolve(nextState.suggestedPlanPath) } : {})
    }
  });
}
