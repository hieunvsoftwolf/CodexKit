import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { TeamListFilters, TeamRecord, TeamsRepository } from "../../../codexkit-core/src/index.ts";
import { mapTeamRow, stringifyJson } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  name: "name",
  slug: "slug",
  status: "status",
  description: "description",
  orchestratorWorkerId: "orchestrator_worker_id",
  metadataJson: "metadata_json",
  updatedAt: "updated_at"
} as const;

export class TeamsRepositorySqlite implements TeamsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: TeamRecord): TeamRecord {
    this.database
      .prepare(
        `
          INSERT INTO teams (
            id, run_id, name, slug, status, description, orchestrator_worker_id, metadata_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.runId,
        record.name,
        record.slug,
        record.status,
        record.description,
        record.orchestratorWorkerId,
        stringifyJson(record.metadata),
        record.createdAt,
        record.updatedAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): TeamRecord | null {
    const row = this.database.prepare("SELECT * FROM teams WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapTeamRow(row) : null;
  }

  getByRunName(runId: string, name: string): TeamRecord | null {
    const row = this.database
      .prepare("SELECT * FROM teams WHERE run_id = ? AND name = ? ORDER BY created_at ASC LIMIT 1")
      .get(runId, name) as Record<string, unknown> | undefined;
    return row ? mapTeamRow(row) : null;
  }

  list(filters?: TeamListFilters): TeamRecord[] {
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    if (filters?.runId) {
      clauses.push("run_id = ?");
      values.push(filters.runId);
    }
    if (filters?.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    if (filters?.slug) {
      clauses.push("slug = ?");
      values.push(filters.slug);
    }
    let sql = "SELECT * FROM teams";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY created_at ASC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapTeamRow);
  }

  update(id: string, patch: Partial<TeamRecord>): TeamRecord {
    const serialized = {
      ...patch,
      metadataJson: patch.metadata ? stringifyJson(patch.metadata) : undefined
    };
    delete (serialized as Record<string, unknown>).metadata;
    const assignment = buildAssignments(serialized, PATCH_COLUMNS);
    this.database.prepare(`UPDATE teams SET ${assignment.sql} WHERE id = ?`).run(...assignment.values, id);
    return this.getById(id)!;
  }
}
