import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { WorkerListFilters, WorkerRecord, WorkersRepository } from "../../../codexkit-core/src/index.ts";
import { mapWorkerRow, stringifyJson } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  teamId: "team_id",
  role: "role",
  displayName: "display_name",
  state: "state",
  executionMode: "execution_mode",
  worktreePath: "worktree_path",
  branchName: "branch_name",
  cwd: "cwd",
  ownedPathsJson: "owned_paths_json",
  toolPolicyJson: "tool_policy_json",
  contextFingerprint: "context_fingerprint",
  lastHeartbeatAt: "last_heartbeat_at",
  stoppedAt: "stopped_at",
  metadataJson: "metadata_json",
  updatedAt: "updated_at"
} as const;

export class WorkersRepositorySqlite implements WorkersRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: WorkerRecord): WorkerRecord {
    this.database
      .prepare(
        `
          INSERT INTO workers (
            id, run_id, team_id, role, display_name, state, execution_mode, worktree_path,
            branch_name, cwd, owned_paths_json, tool_policy_json, context_fingerprint, last_heartbeat_at,
            spawned_at, stopped_at, metadata_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.runId,
        record.teamId,
        record.role,
        record.displayName,
        record.state,
        record.executionMode,
        record.worktreePath,
        record.branchName,
        record.cwd,
        stringifyJson(record.ownedPaths),
        stringifyJson(record.toolPolicy),
        record.contextFingerprint,
        record.lastHeartbeatAt,
        record.spawnedAt,
        record.stoppedAt,
        stringifyJson(record.metadata),
        record.createdAt,
        record.updatedAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): WorkerRecord | null {
    const row = this.database.prepare("SELECT * FROM workers WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapWorkerRow(row) : null;
  }

  list(filters?: WorkerListFilters): WorkerRecord[] {
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    if (filters?.runId) {
      clauses.push("run_id = ?");
      values.push(filters.runId);
    }
    if (filters?.state) {
      clauses.push("state = ?");
      values.push(filters.state);
    }

    let sql = "SELECT * FROM workers";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY created_at ASC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapWorkerRow);
  }

  update(id: string, patch: Partial<WorkerRecord>): WorkerRecord {
    const serialized = {
      ...patch,
      ownedPathsJson: patch.ownedPaths ? stringifyJson(patch.ownedPaths) : undefined,
      toolPolicyJson: patch.toolPolicy ? stringifyJson(patch.toolPolicy) : undefined,
      metadataJson: patch.metadata ? stringifyJson(patch.metadata) : undefined
    };
    delete (serialized as Record<string, unknown>).ownedPaths;
    delete (serialized as Record<string, unknown>).toolPolicy;
    delete (serialized as Record<string, unknown>).metadata;
    const assignment = buildAssignments(serialized, PATCH_COLUMNS);
    this.database.prepare(`UPDATE workers SET ${assignment.sql} WHERE id = ?`).run(...assignment.values, id);
    return this.getById(id)!;
  }
}
