import { createStableId } from "../ids.ts";
import type { CreateTeamInput, RuntimeClock, TeamRecord } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { RuntimeStore, TeamListFilters } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "team";
}

export class TeamService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(store: RuntimeStore, clock: RuntimeClock) {
    this.store = store;
    this.clock = clock;
  }

  createTeam(input: CreateTeamInput): TeamRecord {
    invariant(input.name.trim().length > 0, "TEAM_NAME_REQUIRED", "team name is required");
    const run = this.store.runs.getById(input.runId);
    invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);

    return this.store.transaction(() => {
      const existing = this.store.teams.getByRunName(input.runId, input.name.trim());
      if (existing && existing.status !== "deleted") {
        return existing;
      }

      const timestamp = nowIso(this.clock);
      const team = this.store.teams.create({
        id: createStableId("team"),
        runId: input.runId,
        name: input.name.trim(),
        slug: slugify(input.name),
        status: "active",
        description: input.description ?? "",
        orchestratorWorkerId: null,
        metadata: input.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp
      });
      this.store.mailboxCursors.upsert({
        ownerKind: "team",
        ownerId: team.id,
        lastMessageId: null,
        lastMessageAt: null,
        updatedAt: timestamp
      });

      let updatedTeam = team;
      if (input.orchestratorRole) {
        const worker = this.store.workers.create({
          id: createStableId("worker"),
          runId: input.runId,
          teamId: team.id,
          role: input.orchestratorRole,
          displayName: `${team.name} orchestrator`,
          state: "idle",
          executionMode: "local_worktree",
          worktreePath: null,
          branchName: null,
          cwd: null,
          ownedPaths: [],
          toolPolicy: {},
          contextFingerprint: null,
          lastHeartbeatAt: timestamp,
          spawnedAt: timestamp,
          stoppedAt: null,
          metadata: { systemBootstrap: true },
          createdAt: timestamp,
          updatedAt: timestamp
        });
        updatedTeam = this.store.teams.update(team.id, {
          orchestratorWorkerId: worker.id,
          updatedAt: timestamp
        });
        this.store.events.append({
          runId: input.runId,
          entityType: "worker",
          entityId: worker.id,
          eventType: "worker.registered",
          payload: { state: worker.state, role: worker.role, teamId: team.id }
        });
      }

      this.store.events.append({
        runId: updatedTeam.runId,
        entityType: "team",
        entityId: updatedTeam.id,
        eventType: "team.created",
        payload: { status: updatedTeam.status, name: updatedTeam.name }
      });
      return updatedTeam;
    });
  }

  listTeams(filters?: TeamListFilters): TeamRecord[] {
    return this.store.teams.list(filters);
  }

  getTeam(teamId: string): TeamRecord {
    const team = this.store.teams.getById(teamId);
    invariant(team, "TEAM_NOT_FOUND", `team '${teamId}' was not found`);
    return team;
  }

  deleteTeam(teamId: string, reason?: string): TeamRecord {
    return this.store.transaction(() => {
      const team = this.getTeam(teamId);
      if (team.status === "deleted") {
        return team;
      }
      const timestamp = nowIso(this.clock);
      let deleting = team;
      let transitionedToShuttingDown = false;
      if (deleting.status !== "shutting_down") {
        transitionedToShuttingDown = true;
        deleting = this.store.teams.update(team.id, { status: "shutting_down", updatedAt: timestamp });
        this.store.events.append({
          runId: team.runId,
          entityType: "team",
          entityId: team.id,
          eventType: "team.shutting_down",
          payload: { reason: reason ?? "team.delete" }
        });
      }

      const liveWorkers = this.store.workers
        .list({ teamId: team.id })
        .filter((worker) => worker.state !== "stopped" && worker.state !== "failed");
      if (transitionedToShuttingDown) {
        for (const worker of liveWorkers) {
          const message = this.store.messages.create({
            id: createStableId("msg"),
            runId: team.runId,
            teamId: team.id,
            fromKind: "system",
            fromId: "daemon",
            fromWorkerId: null,
            toKind: "worker",
            toId: worker.id,
            threadId: null,
            replyToMessageId: null,
            messageType: "shutdown_request",
            priority: 100,
            subject: null,
            body: reason ?? "team delete requested",
            artifactRefs: [],
            metadata: { teamId: team.id },
            deliveredAt: null,
            readAt: null,
            createdAt: timestamp
          });
          this.store.events.append({
            runId: team.runId,
            entityType: "message",
            entityId: message.id,
            eventType: "message.sent",
            actorKind: "system",
            actorId: "daemon",
            payload: { toKind: message.toKind, toId: message.toId, messageType: message.messageType }
          });
        }
      }

      if (liveWorkers.length > 0) {
        return deleting;
      }

      const deleted = this.store.teams.update(deleting.id, { status: "deleted", updatedAt: timestamp });
      this.store.events.append({
        runId: team.runId,
        entityType: "team",
        entityId: team.id,
        eventType: "team.deleted",
        payload: { status: deleted.status, reason: reason ?? null }
      });
      return deleted;
    });
  }
}
