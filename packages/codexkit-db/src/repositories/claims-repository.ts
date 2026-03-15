import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ClaimListFilters, ClaimRecord, ClaimsRepository } from "../../../codexkit-core/src/index.ts";
import { mapClaimRow } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  taskId: "task_id",
  workerId: "worker_id",
  status: "status",
  leaseUntil: "lease_until",
  heartbeatAt: "heartbeat_at",
  releasedAt: "released_at",
  note: "note",
  updatedAt: "updated_at"
} as const;

export class ClaimsRepositorySqlite implements ClaimsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: ClaimRecord): ClaimRecord {
    this.database
      .prepare(
        `
          INSERT INTO claims (
            id, task_id, worker_id, status, lease_until, heartbeat_at, released_at, note, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.taskId,
        record.workerId,
        record.status,
        record.leaseUntil,
        record.heartbeatAt,
        record.releasedAt,
        record.note,
        record.createdAt,
        record.updatedAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): ClaimRecord | null {
    const row = this.database.prepare("SELECT * FROM claims WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapClaimRow(row) : null;
  }

  list(filters?: ClaimListFilters): ClaimRecord[] {
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    let sql = "SELECT claims.* FROM claims";

    if (filters?.runId) {
      sql += " INNER JOIN tasks ON tasks.id = claims.task_id";
      clauses.push("tasks.run_id = ?");
      values.push(filters.runId);
    }
    if (filters?.taskId) {
      clauses.push("claims.task_id = ?");
      values.push(filters.taskId);
    }
    if (filters?.workerId) {
      clauses.push("claims.worker_id = ?");
      values.push(filters.workerId);
    }
    if (filters?.status) {
      clauses.push("claims.status = ?");
      values.push(filters.status);
    }

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY claims.created_at DESC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapClaimRow);
  }

  update(id: string, patch: Partial<ClaimRecord>): ClaimRecord {
    const assignment = buildAssignments(patch, PATCH_COLUMNS);
    this.database.prepare(`UPDATE claims SET ${assignment.sql} WHERE id = ?`).run(...assignment.values, id);
    return this.getById(id)!;
  }
}
