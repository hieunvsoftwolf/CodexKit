import type { EventRecord } from "../domain-types.ts";
import type { RuntimeStore } from "../repository-contracts.ts";

export class EventService {
  private readonly store: RuntimeStore;

  constructor(store: RuntimeStore) {
    this.store = store;
  }

  listRunEvents(runId: string, limit = 20): EventRecord[] {
    return this.store.events.listByRun(runId, limit);
  }

  listEntityEvents(entityType: EventRecord["entityType"], entityId: string, limit = 20): EventRecord[] {
    return this.store.events.listByEntity(entityType, entityId, limit);
  }

  drain(cursor: number, limit = 100): EventRecord[] {
    return this.store.events.listSince(cursor, limit);
  }
}
