import { createStableId } from "../ids.ts";
import type { ArtifactKind, ArtifactRecord, JsonObject, RuntimeClock } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { ArtifactListFilters, RuntimeStore } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

export interface PublishArtifactInput {
  runId: string;
  taskId?: string | null;
  workerId?: string | null;
  artifactKind: ArtifactKind;
  path: string;
  checksum?: string | null;
  mimeType?: string | null;
  summary?: string;
  metadata?: JsonObject;
}

export class ArtifactService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(store: RuntimeStore, clock: RuntimeClock) {
    this.store = store;
    this.clock = clock;
  }

  publishArtifact(input: PublishArtifactInput): ArtifactRecord {
    return this.store.transaction(() => {
      const run = this.store.runs.getById(input.runId);
      invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);
      if (input.taskId) {
        const task = this.store.tasks.getById(input.taskId);
        invariant(task && task.runId === input.runId, "ARTIFACT_TASK_INVALID", "artifact task must belong to the run");
      }
      if (input.workerId) {
        const worker = this.store.workers.getById(input.workerId);
        invariant(worker && worker.runId === input.runId, "ARTIFACT_WORKER_INVALID", "artifact worker must belong to the run");
      }
      const timestamp = nowIso(this.clock);
      const artifact = this.store.artifacts.create({
        id: createStableId("artifact"),
        runId: input.runId,
        taskId: input.taskId ?? null,
        workerId: input.workerId ?? null,
        artifactKind: input.artifactKind,
        path: input.path,
        checksum: input.checksum ?? null,
        mimeType: input.mimeType ?? null,
        summary: input.summary ?? "",
        metadata: input.metadata ?? {},
        createdAt: timestamp
      });
      this.store.events.append({
        runId: artifact.runId,
        entityType: "artifact",
        entityId: artifact.id,
        eventType: "artifact.published",
        payload: { artifactKind: artifact.artifactKind, path: artifact.path }
      });
      return artifact;
    });
  }

  listArtifacts(filters?: ArtifactListFilters): ArtifactRecord[] {
    return this.store.artifacts.list(filters);
  }

  getArtifact(artifactId: string): ArtifactRecord {
    const artifact = this.store.artifacts.getById(artifactId);
    invariant(artifact, "ARTIFACT_NOT_FOUND", `artifact '${artifactId}' was not found`);
    return artifact;
  }

  readArtifact(input: { artifactId?: string; runId?: string; path?: string }): ArtifactRecord {
    if (input.artifactId) {
      return this.getArtifact(input.artifactId);
    }
    invariant(Boolean(input.runId && input.path), "ARTIFACT_REFERENCE_REQUIRED", "artifactId or runId+path is required");
    const artifact = this.store.artifacts.getByRunPath(input.runId!, input.path!);
    invariant(artifact, "ARTIFACT_NOT_FOUND", `artifact '${input.path}' was not found in run '${input.runId}'`);
    return artifact;
  }
}
