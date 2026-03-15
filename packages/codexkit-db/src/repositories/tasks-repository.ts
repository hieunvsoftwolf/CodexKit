import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { TaskListFilters, TaskRecord, TasksRepository } from "../../../codexkit-core/src/index.ts";
import { mapDependencyRow, mapTaskRow, stringifyJson } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  teamId: "team_id",
  parentTaskId: "parent_task_id",
  subject: "subject",
  activeForm: "active_form",
  description: "description",
  role: "role",
  workflowStep: "workflow_step",
  status: "status",
  priority: "priority",
  ownerWorkerId: "owner_worker_id",
  planDir: "plan_dir",
  phaseFile: "phase_file",
  stepRef: "step_ref",
  blockingReason: "blocking_reason",
  fileOwnershipJson: "file_ownership_json",
  metadataJson: "metadata_json",
  startedAt: "started_at",
  completedAt: "completed_at",
  updatedAt: "updated_at"
} as const;

export class TasksRepositorySqlite implements TasksRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: TaskRecord, dependsOn: string[]): TaskRecord {
    this.database
      .prepare(
        `
          INSERT INTO tasks (
            id, run_id, team_id, parent_task_id, subject, active_form, description, role,
            workflow_step, status, priority, owner_worker_id, plan_dir, phase_file, step_ref,
            blocking_reason, file_ownership_json, metadata_json, started_at, completed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.runId,
        record.teamId,
        record.parentTaskId,
        record.subject,
        record.activeForm,
        record.description,
        record.role,
        record.workflowStep,
        record.status,
        record.priority,
        record.ownerWorkerId,
        record.planDir,
        record.phaseFile,
        record.stepRef,
        record.blockingReason,
        stringifyJson(record.fileOwnership),
        stringifyJson(record.metadata),
        record.startedAt,
        record.completedAt,
        record.createdAt,
        record.updatedAt
      );

    const statement = this.database.prepare(
      "INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type) VALUES (?, ?, 'blocks')"
    );
    for (const dependencyId of dependsOn) {
      statement.run(record.id, dependencyId);
    }
    return this.getById(record.id)!;
  }

  getById(id: string): TaskRecord | null {
    const row = this.database.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapTaskRow(row) : null;
  }

  list(filters?: TaskListFilters): TaskRecord[] {
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
    if (filters?.ownerWorkerId) {
      clauses.push("owner_worker_id = ?");
      values.push(filters.ownerWorkerId);
    }

    let sql = "SELECT * FROM tasks";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY priority ASC, created_at ASC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapTaskRow);
  }

  update(id: string, patch: Partial<TaskRecord>): TaskRecord {
    const serialized = {
      ...patch,
      fileOwnershipJson: patch.fileOwnership ? stringifyJson(patch.fileOwnership) : undefined,
      metadataJson: patch.metadata ? stringifyJson(patch.metadata) : undefined
    };
    delete (serialized as Record<string, unknown>).fileOwnership;
    delete (serialized as Record<string, unknown>).metadata;
    const assignment = buildAssignments(serialized, PATCH_COLUMNS);
    this.database.prepare(`UPDATE tasks SET ${assignment.sql} WHERE id = ?`).run(...assignment.values, id);
    return this.getById(id)!;
  }

  getDependencies(taskId: string) {
    return (
      this.database
        .prepare("SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY created_at ASC")
        .all(taskId) as Record<string, unknown>[]
    ).map(mapDependencyRow);
  }
}
