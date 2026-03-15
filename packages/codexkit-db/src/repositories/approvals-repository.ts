import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ApprovalListFilters, ApprovalRecord, ApprovalsRepository } from "../../../codexkit-core/src/index.ts";
import { mapApprovalRow, stringifyJson } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  taskId: "task_id",
  requestedByWorkerId: "requested_by_worker_id",
  checkpoint: "checkpoint",
  status: "status",
  question: "question",
  optionsJson: "options_json",
  responseCode: "response_code",
  responseText: "response_text",
  respondedBy: "responded_by",
  expiresAt: "expires_at",
  resolvedAt: "resolved_at",
  updatedAt: "updated_at"
} as const;

export class ApprovalsRepositorySqlite implements ApprovalsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: ApprovalRecord): ApprovalRecord {
    this.database
      .prepare(
        `
          INSERT INTO approvals (
            id, run_id, task_id, requested_by_worker_id, checkpoint, status, question, options_json,
            response_code, response_text, responded_by, expires_at, resolved_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.runId,
        record.taskId,
        record.requestedByWorkerId,
        record.checkpoint,
        record.status,
        record.question,
        stringifyJson(record.options),
        record.responseCode,
        record.responseText,
        record.respondedBy,
        record.expiresAt,
        record.resolvedAt,
        record.createdAt,
        record.updatedAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): ApprovalRecord | null {
    const row = this.database.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapApprovalRow(row) : null;
  }

  list(filters?: ApprovalListFilters): ApprovalRecord[] {
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
    if (filters?.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }

    let sql = "SELECT * FROM approvals";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY created_at DESC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapApprovalRow);
  }

  update(id: string, patch: Partial<ApprovalRecord>): ApprovalRecord {
    const serialized = {
      ...patch,
      optionsJson: patch.options ? stringifyJson(patch.options) : undefined
    };
    delete (serialized as Record<string, unknown>).options;
    const assignment = buildAssignments(serialized, PATCH_COLUMNS);
    this.database.prepare(`UPDATE approvals SET ${assignment.sql} WHERE id = ?`).run(...assignment.values, id);
    return this.getById(id)!;
  }
}
