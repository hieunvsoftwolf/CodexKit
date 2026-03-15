import type { DatabaseSync } from "node:sqlite";
import type { EventDraft, EventRecord, EventsRepository } from "../../../codexkit-core/src/index.ts";
import { mapEventRow, stringifyJson } from "../row-codecs.ts";

export class EventsRepositorySqlite implements EventsRepository {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  append(draft: EventDraft): EventRecord {
    const result = this.database
      .prepare(
        `
          INSERT INTO events (
            run_id, entity_type, entity_id, event_type, causation_id, correlation_id,
            actor_kind, actor_id, payload_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        draft.runId ?? null,
        draft.entityType,
        draft.entityId,
        draft.eventType,
        draft.causationId ?? null,
        draft.correlationId ?? null,
        draft.actorKind ?? "system",
        draft.actorId ?? null,
        stringifyJson(draft.payload ?? {})
      );

    const row = this.database
      .prepare("SELECT * FROM events WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
    return mapEventRow(row);
  }

  listSince(cursor: number, limit: number): EventRecord[] {
    return (
      this.database
        .prepare("SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?")
        .all(cursor, limit) as Record<string, unknown>[]
    ).map(mapEventRow);
  }

  listByRun(runId: string, limit: number): EventRecord[] {
    return (
      this.database
        .prepare("SELECT * FROM events WHERE run_id = ? ORDER BY id DESC LIMIT ?")
        .all(runId, limit) as Record<string, unknown>[]
    ).map(mapEventRow);
  }

  listByEntity(entityType: EventRecord["entityType"], entityId: string, limit: number): EventRecord[] {
    return (
      this.database
        .prepare("SELECT * FROM events WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT ?")
        .all(entityType, entityId, limit) as Record<string, unknown>[]
    ).map(mapEventRow);
  }
}
