import type { DatabaseSync } from "node:sqlite";
import type { MailboxCursorRecord, MailboxCursorsRepository, RecipientKind } from "../../../codexkit-core/src/index.ts";
import { mapMailboxCursorRow } from "../row-codecs.ts";

export class MailboxCursorsRepositorySqlite implements MailboxCursorsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  get(ownerKind: RecipientKind, ownerId: string): MailboxCursorRecord | null {
    const row = this.database
      .prepare("SELECT * FROM mailbox_cursors WHERE owner_kind = ? AND owner_id = ?")
      .get(ownerKind, ownerId) as Record<string, unknown> | undefined;
    return row ? mapMailboxCursorRow(row) : null;
  }

  upsert(record: MailboxCursorRecord): MailboxCursorRecord {
    this.database
      .prepare(
        `
          INSERT INTO mailbox_cursors (
            owner_kind, owner_id, last_message_id, last_message_at, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(owner_kind, owner_id)
          DO UPDATE SET
            last_message_id = excluded.last_message_id,
            last_message_at = excluded.last_message_at,
            updated_at = excluded.updated_at
        `
      )
      .run(record.ownerKind, record.ownerId, record.lastMessageId, record.lastMessageAt, record.updatedAt);
    return this.get(record.ownerKind, record.ownerId)!;
  }
}
