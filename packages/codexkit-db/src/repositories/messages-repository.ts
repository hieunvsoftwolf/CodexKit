import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { MessageListFilters, MessageRecord, MessagesRepository } from "../../../codexkit-core/src/index.ts";
import { mapMessageRow, stringifyJson } from "../row-codecs.ts";
import { buildAssignments } from "../sqlite-helpers.ts";

const PATCH_COLUMNS = {
  deliveredAt: "delivered_at",
  readAt: "read_at"
} as const;

export class MessagesRepositorySqlite implements MessagesRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  create(record: MessageRecord): MessageRecord {
    this.database
      .prepare(
        `
          INSERT INTO messages (
            id, run_id, team_id, from_kind, from_id, from_worker_id, to_kind, to_id, thread_id, reply_to_message_id,
            message_type, priority, subject, body, artifact_refs_json, metadata_json, delivered_at, read_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        record.id,
        record.runId,
        record.teamId,
        record.fromKind,
        record.fromId,
        record.fromWorkerId,
        record.toKind,
        record.toId,
        record.threadId,
        record.replyToMessageId,
        record.messageType,
        record.priority,
        record.subject,
        record.body,
        stringifyJson(record.artifactRefs),
        stringifyJson(record.metadata),
        record.deliveredAt,
        record.readAt,
        record.createdAt
      );
    return this.getById(record.id)!;
  }

  getById(id: string): MessageRecord | null {
    const row = this.database.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapMessageRow(row) : null;
  }

  list(filters?: MessageListFilters): MessageRecord[] {
    const clauses: string[] = [];
    const values: SQLInputValue[] = [];
    if (filters?.runId) {
      clauses.push("run_id = ?");
      values.push(filters.runId);
    }
    if (filters?.toKind) {
      clauses.push("to_kind = ?");
      values.push(filters.toKind);
    }
    if (filters?.toId) {
      clauses.push("to_id = ?");
      values.push(filters.toId);
    }
    if (filters?.fromWorkerId) {
      clauses.push("from_worker_id = ?");
      values.push(filters.fromWorkerId);
    }
    let sql = "SELECT * FROM messages";
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(" AND ")}`;
    }
    sql += " ORDER BY created_at ASC, id ASC";
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapMessageRow);
  }

  listMailboxAfterCursor(input: {
    ownerKind: MessageRecord["toKind"];
    ownerId: string;
    afterMessageId?: string;
    limit: number;
  }): MessageRecord[] {
    let sql = "SELECT * FROM messages WHERE to_kind = ? AND to_id = ?";
    const values: SQLInputValue[] = [input.ownerKind, input.ownerId];
    if (input.afterMessageId) {
      const pivot = this.database
        .prepare("SELECT created_at, id FROM messages WHERE id = ?")
        .get(input.afterMessageId) as { created_at?: string; id?: string } | undefined;
      if (pivot?.created_at && pivot.id) {
        sql += " AND (created_at > ? OR (created_at = ? AND id > ?))";
        values.push(pivot.created_at, pivot.created_at, pivot.id);
      }
    }
    sql += " ORDER BY created_at ASC, id ASC LIMIT ?";
    values.push(input.limit);
    return (this.database.prepare(sql).all(...values) as Record<string, unknown>[]).map(mapMessageRow);
  }

  markDelivered(messageIds: string[], deliveredAt: string): void {
    if (messageIds.length === 0) {
      return;
    }
    const patch = buildAssignments({ deliveredAt }, PATCH_COLUMNS);
    const placeholders = messageIds.map(() => "?").join(", ");
    this.database
      .prepare(`UPDATE messages SET ${patch.sql} WHERE delivered_at IS NULL AND id IN (${placeholders})`)
      .run(...patch.values, ...messageIds);
  }

  markRead(messageIds: string[], readAt: string): void {
    if (messageIds.length === 0) {
      return;
    }
    const patch = buildAssignments({ readAt }, PATCH_COLUMNS);
    const placeholders = messageIds.map(() => "?").join(", ");
    this.database
      .prepare(`UPDATE messages SET ${patch.sql} WHERE read_at IS NULL AND id IN (${placeholders})`)
      .run(...patch.values, ...messageIds);
  }
}
