import { createStableId } from "../ids.ts";
import type { CreateMessageInput, MessageRecord, RecipientKind, RuntimeClock } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { MessageListFilters, RuntimeStore } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

export interface PullMessagesInput {
  recipientKind: RecipientKind;
  recipientId: string;
  sinceMessageId?: string;
  maxItems?: number;
  markAsRead?: boolean;
}

export class MessageService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(store: RuntimeStore, clock: RuntimeClock) {
    this.store = store;
    this.clock = clock;
  }

  sendMessage(input: CreateMessageInput): MessageRecord {
    const run = this.store.runs.getById(input.runId);
    invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);
    if (input.fromWorkerId) {
      const worker = this.store.workers.getById(input.fromWorkerId);
      invariant(worker && worker.runId === input.runId, "MESSAGE_SENDER_INVALID", "message sender worker must belong to the run");
    }
    if (input.toKind === "worker") {
      const worker = this.store.workers.getById(input.toId);
      invariant(worker && worker.runId === input.runId, "MESSAGE_RECIPIENT_INVALID", "message recipient worker must belong to the run");
    } else if (input.toKind === "team") {
      const team = this.store.teams.getById(input.toId);
      invariant(team && team.runId === input.runId, "MESSAGE_RECIPIENT_INVALID", "message recipient team must belong to the run");
      invariant(team.status !== "deleted", "MESSAGE_RECIPIENT_DELETED", `team '${team.id}' is deleted`);
    } else {
      invariant(input.toId === input.runId, "MESSAGE_RECIPIENT_INVALID", "user mailbox recipient must be the run id");
    }

    return this.store.transaction(() => {
      const timestamp = nowIso(this.clock);
      const message = this.store.messages.create({
        id: createStableId("msg"),
        runId: input.runId,
        teamId: input.teamId ?? (input.toKind === "team" ? input.toId : null),
        fromKind: input.fromKind,
        fromId: input.fromId ?? null,
        fromWorkerId: input.fromWorkerId ?? null,
        toKind: input.toKind,
        toId: input.toId,
        threadId: input.threadId ?? null,
        replyToMessageId: input.replyToMessageId ?? null,
        messageType: input.messageType ?? "message",
        priority: input.priority ?? 100,
        subject: input.subject ?? null,
        body: input.body,
        artifactRefs: input.artifactRefs ?? [],
        metadata: input.metadata ?? {},
        deliveredAt: null,
        readAt: null,
        createdAt: timestamp
      });

      this.store.events.append({
        runId: message.runId,
        entityType: "message",
        entityId: message.id,
        eventType: "message.sent",
        actorKind: input.fromKind,
        actorId: input.fromId ?? null,
        payload: { toKind: message.toKind, toId: message.toId, messageType: message.messageType }
      });
      return message;
    });
  }

  pullMessages(input: PullMessagesInput): MessageRecord[] {
    return this.store.transaction(() => {
      const maxItems = Math.max(1, Math.min(input.maxItems ?? 50, 200));
      const cursor = this.store.mailboxCursors.get(input.recipientKind, input.recipientId);
      const afterMessageId = input.sinceMessageId ?? cursor?.lastMessageId ?? undefined;
      const messages = this.store.messages.listMailboxAfterCursor({
        ownerKind: input.recipientKind,
        ownerId: input.recipientId,
        ...(afterMessageId ? { afterMessageId } : {}),
        limit: maxItems
      });

      if (messages.length === 0) {
        return messages;
      }

      const timestamp = nowIso(this.clock);
      const messageIds = messages.map((message) => message.id);
      this.store.messages.markDelivered(messageIds, timestamp);
      if (input.markAsRead) {
        this.store.messages.markRead(messageIds, timestamp);
      }
      const tail = messages.at(-1)!;
      this.store.mailboxCursors.upsert({
        ownerKind: input.recipientKind,
        ownerId: input.recipientId,
        lastMessageId: tail.id,
        lastMessageAt: tail.createdAt,
        updatedAt: timestamp
      });
      return this.store.messages.listMailboxAfterCursor({
        ownerKind: input.recipientKind,
        ownerId: input.recipientId,
        ...(afterMessageId ? { afterMessageId } : {}),
        limit: maxItems
      });
    });
  }

  listMessages(filters?: MessageListFilters): MessageRecord[] {
    return this.store.messages.list(filters);
  }
}
