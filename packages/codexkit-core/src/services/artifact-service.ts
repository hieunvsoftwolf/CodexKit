import { createStableId } from "../ids.ts";
import type { ArtifactKind, ArtifactRecord, JsonObject, RuntimeClock } from "../domain-types.ts";
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
}
