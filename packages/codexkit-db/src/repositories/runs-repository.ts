import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { RunListFilters, RunRecord, RunsRepository } from "../../../codexkit-core/src/index.ts";
import { mapRunRow, stringifyJson } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  workflow: "workflow",
  mode: "mode",
  status: "status",
  rootTaskId: "root_task_id",
  parentRunId: "parent_run_id",
  planDir: "plan_dir",
  initiatedBy: "initiated_by",
  commandLine: "command_line",
  metadataJson: "metadata_json",
  startedAt: "started_at",
  completedAt: "completed_at",
  updatedAt: "updated_at"
} as const;

export class RunsRepositorySqlite implements RunsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: RunRecord): RunRecord {
    this.database
      .prepare(
        `
          INSERT INTO runs (
            id, workflow, mode, status, root_task_id, parent_run_id, plan_dir, initiated_by,
            command_line, metadata_json, started_at, completed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.workflow,
        record.mode,
        record.status,
        record.rootTaskId,
        record.parentRunId,
        record.planDir,
        record.initiatedBy,
        record.commandLine,
        stringifyJson(record.metadata),
        record.startedAt,
        record.completedAt,
        record.createdAt,
        record.updatedAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): RunRecord | null {
    const row = this.database.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapRunRow(row) : null;
  }

  list(filters?: RunListFilters): RunRecord[] {
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    if (filters?.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    if (filters?.activeOnly) {
      clauses.push("status NOT IN ('completed', 'failed', 'cancelled')");
    }

    let sql = "SELECT * FROM runs";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY updated_at DESC";
    if (filters?.limit) {
      sql += " LIMIT ?";
      values.push(filters.limit);
    }

    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapRunRow);
  }

  update(id: string, patch: Partial<RunRecord>): RunRecord {
    const serialized = {
      ...patch,
      metadataJson: patch.metadata ? stringifyJson(patch.metadata) : undefined
    };
    delete (serialized as Record<string, unknown>).metadata;
    const assignment = buildAssignments(serialized, PATCH_COLUMNS);
    this.database.prepare(`UPDATE runs SET ${assignment.sql} WHERE id = ?`).run(...assignment.values, id);
    return this.getById(id)!;
  }
}
