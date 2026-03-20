import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ArtifactListFilters, ArtifactRecord, ArtifactsRepository } from "../../../codexkit-core/src/index.ts";
import { mapArtifactRow, stringifyJson } from "../row-codecs.ts";

export class ArtifactsRepositorySqlite implements ArtifactsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: ArtifactRecord): ArtifactRecord {
    this.database
      .prepare(
        `
          INSERT INTO artifacts (
            id, run_id, task_id, worker_id, artifact_kind, path, checksum, mime_type, summary, metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.runId,
        record.taskId,
        record.workerId,
        record.artifactKind,
        record.path,
        record.checksum,
        record.mimeType,
        record.summary,
        stringifyJson(record.metadata),
        record.createdAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): ArtifactRecord | null {
    const row = this.database.prepare("SELECT * FROM artifacts WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapArtifactRow(row) : null;
  }

  getByRunPath(runId: string, path: string): ArtifactRecord | null {
    const row = this.database
      .prepare("SELECT * FROM artifacts WHERE run_id = ? AND path = ?")
      .get(runId, path) as Record<string, unknown> | undefined;
    return row ? mapArtifactRow(row) : null;
  }

  list(filters?: ArtifactListFilters): ArtifactRecord[] {
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    if (filters?.runId) {
      clauses.push("run_id = ?");
      values.push(filters.runId);
    }
    if (filters?.taskId) {
      clauses.push("task_id = ?");
      values.push(filters.taskId);
    }
    if (filters?.workerId) {
      clauses.push("worker_id = ?");
      values.push(filters.workerId);
    }
    if (filters?.artifactKind) {
      clauses.push("artifact_kind = ?");
      values.push(filters.artifactKind);
    }

    let sql = "SELECT * FROM artifacts";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY created_at ASC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapArtifactRow);
  }
}
