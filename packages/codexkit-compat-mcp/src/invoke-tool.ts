import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import {
  type ApprovalOption,
  type ArtifactKind,
  type CodexkitError,
  type MessageArtifactRef,
  type MessageType,
  type RecipientKind,
  type TaskRecord
} from "../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../../codexkit-daemon/src/runtime-context.ts";
import { CompatToolError, compatInvariant } from "./errors.ts";
import type { CompatCaller, CompatToolRequest, CompatToolResult } from "./types.ts";

const MESSAGE_TYPES = new Set<MessageType>([
  "message",
  "status",
  "shutdown_request",
  "shutdown_response",
  "approval_request",
  "approval_response",
  "plan_approval_response"
]);
const RECIPIENT_KINDS = new Set<RecipientKind>(["user", "worker", "team"]);
const ARTIFACT_KINDS = new Set<ArtifactKind>([
  "report",
  "patch",
  "test-log",
  "review",
  "plan",
  "summary",
  "screenshot",
  "trace",
  "docs"
]);

function asObject(value: unknown, field: string): Record<string, unknown> {
  compatInvariant(value !== null && typeof value === "object" && !Array.isArray(value), "validation_error", `${field} must be an object`);
  return value as Record<string, unknown>;
}

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  compatInvariant(typeof value === "string" && value.trim().length > 0, "validation_error", `${key} must be a non-empty string`);
  return value.trim();
}

function optionalString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  compatInvariant(typeof value === "string" && value.trim().length > 0, "validation_error", `${key} must be a non-empty string`);
  return value.trim();
}

function optionalBoolean(payload: Record<string, unknown>, key: string): boolean | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  compatInvariant(typeof value === "boolean", "validation_error", `${key} must be a boolean`);
  return value;
}

function optionalInteger(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  compatInvariant(typeof value === "number" && Number.isInteger(value), "validation_error", `${key} must be an integer`);
  return value;
}

function optionalStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (value === undefined || value === null) {
    return [];
  }
  compatInvariant(Array.isArray(value), "validation_error", `${key} must be an array`);
  return value.map((entry, index) => {
    compatInvariant(typeof entry === "string" && entry.trim().length > 0, "validation_error", `${key}[${index}] must be a non-empty string`);
    return entry.trim();
  });
}

function parseApprovalOptions(payload: Record<string, unknown>): ApprovalOption[] {
  const options = payload.options;
  compatInvariant(Array.isArray(options) && options.length > 0, "validation_error", "options must be a non-empty array");
  return options.map((entry, index) => {
    const option = asObject(entry, `options[${index}]`);
    const code = requireString(option, "code");
    const label = requireString(option, "label");
    const description = optionalString(option, "description");
    return { code, label, ...(description ? { description } : {}) };
  });
}

function parseArtifactRefs(payload: Record<string, unknown>): MessageArtifactRef[] {
  const refs = payload.artifactRefs;
  if (refs === undefined || refs === null) {
    return [];
  }
  compatInvariant(Array.isArray(refs), "validation_error", "artifactRefs must be an array");
  return refs.map((entry, index) => {
    const ref = asObject(entry, `artifactRefs[${index}]`);
    const artifactId = requireString(ref, "artifactId");
    const pathValue = optionalString(ref, "path");
    const kindValue = optionalString(ref, "kind");
    if (kindValue) {
      compatInvariant(ARTIFACT_KINDS.has(kindValue as ArtifactKind), "validation_error", `artifactRefs[${index}].kind is invalid`);
    }
    return { artifactId, ...(pathValue ? { path: pathValue } : {}), ...(kindValue ? { kind: kindValue as ArtifactKind } : {}) };
  });
}

function isInside(base: string, candidate: string): boolean {
  const relative = path.relative(base, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function mapTaskSummary(task: TaskRecord): Record<string, unknown> {
  return {
    id: task.id,
    subject: task.subject,
    role: task.role,
    status: task.status,
    priority: task.priority,
    ...(task.ownerWorkerId ? { ownerWorkerId: task.ownerWorkerId } : {}),
    ...(task.teamId ? { teamId: task.teamId } : {}),
    ...(task.planDir ? { planDir: task.planDir } : {}),
    ...(task.phaseFile ? { phaseFile: task.phaseFile } : {})
  };
}

function mapTaskRecord(context: RuntimeContext, task: TaskRecord): Record<string, unknown> {
  const dependsOn = context.store.tasks.getDependencies(task.id).map((dependency) => dependency.dependsOnTaskId);
  return {
    ...mapTaskSummary(task),
    ...(task.activeForm ? { activeForm: task.activeForm } : {}),
    description: task.description,
    ...(task.workflowStep ? { workflowStep: task.workflowStep } : {}),
    ...(task.stepRef ? { stepRef: task.stepRef } : {}),
    ...(task.blockingReason ? { blockingReason: task.blockingReason } : {}),
    dependsOn,
    ownedPaths: task.fileOwnership,
    metadata: task.metadata,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function mapApprovalRecord(approval: ReturnType<RuntimeContext["approvalService"]["getApproval"]>): Record<string, unknown> {
  return {
    id: approval.id,
    checkpoint: approval.checkpoint,
    status: approval.status,
    question: approval.question,
    options: approval.options,
    ...(approval.responseCode ? { responseCode: approval.responseCode } : {}),
    ...(approval.responseText ? { responseText: approval.responseText } : {}),
    createdAt: approval.createdAt,
    ...(approval.resolvedAt ? { resolvedAt: approval.resolvedAt } : {})
  };
}

function mapMessageRecord(message: ReturnType<RuntimeContext["messageService"]["listMessages"]>[number]): Record<string, unknown> {
  return {
    id: message.id,
    ...(message.fromWorkerId ? { fromWorkerId: message.fromWorkerId } : {}),
    toKind: message.toKind,
    toId: message.toId,
    messageType: message.messageType,
    priority: message.priority,
    ...(message.subject ? { subject: message.subject } : {}),
    body: message.body,
    artifactRefs: message.artifactRefs,
    createdAt: message.createdAt
  };
}

function mapArtifactRecord(artifact: ReturnType<RuntimeContext["artifactService"]["readArtifact"]>): Record<string, unknown> {
  return {
    id: artifact.id,
    kind: artifact.artifactKind,
    path: artifact.path,
    summary: artifact.summary,
    ...(artifact.taskId ? { taskId: artifact.taskId } : {}),
    ...(artifact.workerId ? { workerId: artifact.workerId } : {}),
    ...(artifact.mimeType ? { mimeType: artifact.mimeType } : {}),
    metadata: artifact.metadata,
    createdAt: artifact.createdAt
  };
}

function mapResponseCode(code: string): "approved" | "revised" | "rejected" | "aborted" {
  if (code === "approve" || code === "auto_approve_run") {
    return "approved";
  }
  if (code === "revise") {
    return "revised";
  }
  if (code === "reject") {
    return "rejected";
  }
  if (code === "abort") {
    return "aborted";
  }
  throw new CompatToolError("validation_error", `unsupported responseCode '${code}'`);
}

function normalizeOwnedPaths(values: string[]): string[] {
  return values.map((entry) => {
    const normalized = path.posix.normalize(entry.replace(/\\/g, "/").trim().replace(/^\.\/+/, ""));
    compatInvariant(normalized.length > 0 && normalized !== ".", "validation_error", "ownedPaths cannot contain empty paths");
    compatInvariant(!normalized.startsWith("../") && !path.posix.isAbsolute(normalized), "validation_error", "ownedPaths must be repo-relative");
    return normalized;
  });
}

function resolveCallerWorker(context: RuntimeContext, caller: CompatCaller) {
  if (caller.kind !== "worker") {
    return null;
  }
  compatInvariant(Boolean(caller.workerId), "permission_denied", "worker caller must include workerId");
  const worker = context.store.workers.getById(caller.workerId!);
  compatInvariant(worker, "not_found", `worker '${caller.workerId}' not found`);
  if (caller.runId) {
    compatInvariant(worker.runId === caller.runId, "permission_denied", "caller run scope does not match worker run");
  }
  return worker;
}

function assertRunScope(runId: string, caller: CompatCaller, callerWorker: ReturnType<typeof resolveCallerWorker>): void {
  if (caller.kind === "worker") {
    compatInvariant(callerWorker?.runId === runId, "permission_denied", "worker caller cannot access another run");
    return;
  }
  if (caller.kind === "user" && caller.runId) {
    compatInvariant(caller.runId === runId, "permission_denied", "caller run scope does not match payload run");
  }
}

function callerRunScope(caller: CompatCaller, callerWorker: ReturnType<typeof resolveCallerWorker>): string | undefined {
  if (caller.kind === "worker") {
    return callerWorker?.runId;
  }
  if (caller.kind === "user") {
    return caller.runId;
  }
  return undefined;
}

function canonicalizeArtifactPath(context: RuntimeContext, baseDir: string, inputPath: string): { canonicalPath: string; checksum: string } {
  const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath);
  compatInvariant(existsSync(absolute), "not_found", `artifact path '${inputPath}' does not exist`);
  const fileStat = statSync(absolute);
  compatInvariant(fileStat.isFile(), "validation_error", `artifact path '${inputPath}' must reference a file`);
  const canonicalPath = realpathSync(absolute);
  compatInvariant(
    isInside(context.config.paths.rootDir, canonicalPath) || isInside(context.config.paths.artifactsDir, canonicalPath),
    "permission_denied",
    `artifact path '${inputPath}' escapes the runtime roots`
  );
  const checksum = createHash("sha256").update(readFileSync(canonicalPath)).digest("hex");
  return { canonicalPath, checksum };
}

function toCompatError(error: unknown): CompatToolError {
  if (error instanceof CompatToolError) {
    return error;
  }
  const codexError = error as CodexkitError;
  const code = typeof codexError?.code === "string" ? codexError.code : "";
  if (code === "not_supported") {
    return new CompatToolError("not_supported", codexError.message, false, codexError.details);
  }
  if (code.endsWith("_NOT_FOUND")) {
    return new CompatToolError("not_found", codexError.message, false, codexError.details);
  }
  if (code === "APPROVAL_ALREADY_RESOLVED" || code.includes("TERMINAL") || code.includes("TRANSITION") || code.includes("BLOCKED")) {
    return new CompatToolError("state_conflict", codexError.message, false, codexError.details);
  }
  if (
    code.includes("INVALID") ||
    code.includes("REQUIRED") ||
    code.includes("USAGE") ||
    code.includes("ESCAPE") ||
    code.includes("SYMLINK")
  ) {
    return new CompatToolError("validation_error", codexError.message, false, codexError.details);
  }
  if (code.includes("PERMISSION") || code.includes("OWNED_PATH")) {
    return new CompatToolError("permission_denied", codexError.message, false, codexError.details);
  }
  return new CompatToolError("internal_error", codexError?.message ?? String(error), true, codexError?.details);
}

export function invokeCompatTool(context: RuntimeContext, caller: CompatCaller, request: CompatToolRequest): CompatToolResult {
  try {
    compatInvariant(request.kind === "request", "validation_error", "kind must be request");
    const payload = asObject(request.payload, "payload");
    const callerWorker = resolveCallerWorker(context, caller);

    switch (request.name) {
      case "task.create": {
        const runId = requireString(payload, "runId");
        assertRunScope(runId, caller, callerWorker);
        const task = context.taskService.createTask({
          runId,
          ...(optionalString(payload, "teamId") ? { teamId: optionalString(payload, "teamId")! } : {}),
          ...(optionalString(payload, "parentTaskId") ? { parentTaskId: optionalString(payload, "parentTaskId")! } : {}),
          subject: requireString(payload, "subject"),
          description: requireString(payload, "description"),
          role: requireString(payload, "role"),
          ...(optionalString(payload, "activeForm") ? { activeForm: optionalString(payload, "activeForm")! } : {}),
          ...(optionalString(payload, "workflowStep") ? { workflowStep: optionalString(payload, "workflowStep")! } : {}),
          ...(optionalInteger(payload, "priority") !== undefined ? { priority: optionalInteger(payload, "priority")! } : {}),
          ...(optionalString(payload, "planDir") ? { planDir: optionalString(payload, "planDir")! } : {}),
          ...(optionalString(payload, "phaseFile") ? { phaseFile: optionalString(payload, "phaseFile")! } : {}),
          ...(optionalString(payload, "stepRef") ? { stepRef: optionalString(payload, "stepRef")! } : {}),
          dependsOn: optionalStringArray(payload, "dependsOn"),
          fileOwnership: normalizeOwnedPaths(optionalStringArray(payload, "ownedPaths")),
          metadata: payload.metadata && typeof payload.metadata === "object" ? asObject(payload.metadata, "metadata") : {}
        });
        return { kind: "result", name: request.name, payload: { taskId: task.id, status: task.status } };
      }
      case "task.list": {
        const runId = optionalString(payload, "runId") ?? callerWorker?.runId;
        if (runId) {
          assertRunScope(runId, caller, callerWorker);
        }
        const teamId = optionalString(payload, "teamId");
        const role = optionalString(payload, "role");
        const ownerWorkerId = optionalString(payload, "ownerWorkerId");
        const includeCompleted = optionalBoolean(payload, "includeCompleted") ?? true;
        const statusValue = payload.status;
        const statuses = Array.isArray(statusValue)
          ? statusValue.map((entry) => {
              compatInvariant(typeof entry === "string", "validation_error", "status entries must be strings");
              return entry;
            })
          : typeof statusValue === "string"
            ? [statusValue]
            : [];
        let tasks = context.taskService.listTasks(runId ? { runId } : undefined);
        if (teamId) {
          tasks = tasks.filter((task) => task.teamId === teamId);
        }
        if (role) {
          tasks = tasks.filter((task) => task.role === role);
        }
        if (ownerWorkerId) {
          tasks = tasks.filter((task) => task.ownerWorkerId === ownerWorkerId);
        }
        if (statuses.length > 0) {
          tasks = tasks.filter((task) => statuses.includes(task.status));
        }
        if (!includeCompleted) {
          tasks = tasks.filter((task) => task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled");
        }
        return { kind: "result", name: request.name, payload: { tasks: tasks.map(mapTaskSummary) } };
      }
      case "task.get": {
        const task = context.taskService.getTask(requireString(payload, "taskId"));
        assertRunScope(task.runId, caller, callerWorker);
        return { kind: "result", name: request.name, payload: { task: mapTaskRecord(context, task) } };
      }
      case "task.update": {
        const taskId = requireString(payload, "taskId");
        const patch = asObject(payload.patch, "patch");
        const task = context.taskService.getTask(taskId);
        assertRunScope(task.runId, caller, callerWorker);
        if (patch.ownerWorkerId !== undefined) {
          compatInvariant(caller.kind === "system", "permission_denied", "ownerWorkerId patch requires system authority");
          const ownerWorkerId = optionalString(patch, "ownerWorkerId");
          compatInvariant(ownerWorkerId === task.ownerWorkerId, "state_conflict", "ownerWorkerId cannot be changed by task.update");
        }
        const updated = context.taskService.updateTask(taskId, {
          ...(optionalString(patch, "status") ? { status: optionalString(patch, "status") as TaskRecord["status"] } : {}),
          ...(optionalString(patch, "blockingReason") !== undefined ? { blockingReason: optionalString(patch, "blockingReason") ?? null } : {}),
          ...(optionalInteger(patch, "priority") !== undefined ? { priority: optionalInteger(patch, "priority")! } : {}),
          ...(optionalString(patch, "appendNote") ? { appendNote: optionalString(patch, "appendNote")! } : {}),
          ...(patch.metadata && typeof patch.metadata === "object" ? { metadata: asObject(patch.metadata, "metadata") } : {})
        });
        return { kind: "result", name: request.name, payload: { task: mapTaskRecord(context, updated) } };
      }
      case "team.create": {
        const runId = requireString(payload, "runId");
        assertRunScope(runId, caller, callerWorker);
        const team = context.teamService.createTeam({
          runId,
          name: requireString(payload, "name"),
          ...(optionalString(payload, "description") ? { description: optionalString(payload, "description")! } : {}),
          ...(optionalString(payload, "orchestratorRole") ? { orchestratorRole: optionalString(payload, "orchestratorRole")! } : {}),
          ...(payload.metadata && typeof payload.metadata === "object" ? { metadata: asObject(payload.metadata, "metadata") } : {})
        });
        return { kind: "result", name: request.name, payload: { teamId: team.id, status: team.status } };
      }
      case "team.delete": {
        const team = context.teamService.getTeam(requireString(payload, "teamId"));
        assertRunScope(team.runId, caller, callerWorker);
        const deleted = context.teamService.deleteTeam(team.id, optionalString(payload, "reason"));
        return { kind: "result", name: request.name, payload: { teamId: deleted.id, deleted: deleted.status === "deleted" } };
      }
      case "worker.spawn": {
        const runId = requireString(payload, "runId");
        assertRunScope(runId, caller, callerWorker);
        const executionMode = optionalString(payload, "executionMode") ?? "local_worktree";
        compatInvariant(executionMode === "local_worktree", "not_supported", `execution mode '${executionMode}' is not supported in phase 3`);
        const taskId = optionalString(payload, "taskId");
        const requestedTeamId = optionalString(payload, "teamId");
        let effectiveTeamId: string | null = requestedTeamId ?? null;
        if (requestedTeamId) {
          const team = context.teamService.getTeam(requestedTeamId);
          compatInvariant(team.runId === runId, "validation_error", `team '${requestedTeamId}' must belong to run '${runId}'`);
        }
        if (taskId) {
          const task = context.taskService.getTask(taskId);
          compatInvariant(task.runId === runId, "validation_error", `task '${taskId}' must belong to run '${runId}'`);
          if (requestedTeamId) {
            compatInvariant(task.teamId === requestedTeamId, "validation_error", "task team does not match worker team");
          } else {
            effectiveTeamId = task.teamId;
          }
          const existingWorker = context.store.workers.findCompatibleLiveByTask(taskId);
          if (existingWorker) {
            return {
              kind: "result",
              name: request.name,
              payload: {
                workerId: existingWorker.id,
                state: existingWorker.state,
                ...(existingWorker.worktreePath ? { worktreePath: existingWorker.worktreePath } : {})
              }
            };
          }
        }
        if (callerWorker?.teamId) {
          compatInvariant(effectiveTeamId === callerWorker.teamId, "permission_denied", "worker caller can only spawn within its team scope");
        }
        const worker = context.workerService.registerWorker({
          runId,
          teamId: effectiveTeamId,
          role: requireString(payload, "role"),
          displayName: optionalString(payload, "displayName") ?? `${requireString(payload, "role")} worker`,
          executionMode: "local_worktree",
          ownedPaths: normalizeOwnedPaths(optionalStringArray(payload, "ownedPaths")),
          metadata: {
            ...(payload.metadata && typeof payload.metadata === "object" ? asObject(payload.metadata, "metadata") : {}),
            ...(optionalBoolean(payload, "readOnly") ? { readOnly: true } : {})
          }
        });
        if (taskId) {
          context.claimService.createClaim({ taskId, workerId: worker.id, leaseMs: 30_000, note: "worker.spawn" });
        }
        return {
          kind: "result",
          name: request.name,
          payload: { workerId: worker.id, state: worker.state, ...(worker.worktreePath ? { worktreePath: worker.worktreePath } : {}) }
        };
      }
      case "message.send": {
        const runId = requireString(payload, "runId");
        assertRunScope(runId, caller, callerWorker);
        const toKind = requireString(payload, "toKind") as RecipientKind;
        compatInvariant(RECIPIENT_KINDS.has(toKind), "validation_error", `toKind '${toKind}' is invalid`);
        const fromWorkerId = optionalString(payload, "fromWorkerId");
        const messageTypeRaw = optionalString(payload, "messageType");
        const messageType = messageTypeRaw ? (messageTypeRaw as MessageType) : "message";
        compatInvariant(MESSAGE_TYPES.has(messageType), "validation_error", `messageType '${messageType}' is invalid`);
        if (caller.kind === "worker") {
          compatInvariant(!fromWorkerId || fromWorkerId === callerWorker!.id, "permission_denied", "fromWorkerId mismatch for worker caller");
        } else {
          compatInvariant(!fromWorkerId, "permission_denied", "fromWorkerId is restricted to worker callers");
        }
        const message = context.messageService.sendMessage({
          runId,
          fromKind: caller.kind === "worker" ? "worker" : "user",
          fromId: caller.kind === "worker" ? callerWorker!.id : "terminal",
          fromWorkerId: caller.kind === "worker" ? callerWorker!.id : null,
          toKind,
          toId: requireString(payload, "toId"),
          messageType,
          priority: optionalInteger(payload, "priority") ?? 100,
          subject: optionalString(payload, "subject") ?? null,
          body: requireString(payload, "body"),
          artifactRefs: parseArtifactRefs(payload),
          metadata: payload.metadata && typeof payload.metadata === "object" ? asObject(payload.metadata, "metadata") : {}
        });
        return { kind: "result", name: request.name, payload: { messageId: message.id, queued: true } };
      }
      case "message.pull": {
        const recipientKind = requireString(payload, "recipientKind") as RecipientKind;
        compatInvariant(RECIPIENT_KINDS.has(recipientKind), "validation_error", `recipientKind '${recipientKind}' is invalid`);
        const recipientId = requireString(payload, "recipientId");
        if (caller.kind === "worker") {
          if (recipientKind === "worker") {
            compatInvariant(recipientId === callerWorker!.id, "permission_denied", "worker caller can only pull its own mailbox");
          } else if (recipientKind === "team") {
            const team = context.teamService.getTeam(recipientId);
            compatInvariant(team.orchestratorWorkerId === callerWorker!.id, "permission_denied", "only orchestrator can pull team mailbox");
          } else {
            compatInvariant(false, "permission_denied", "worker caller cannot pull user mailbox");
          }
        } else if (caller.kind === "user") {
          compatInvariant(recipientKind === "user", "permission_denied", "user caller can only pull user mailbox");
          if (caller.runId) {
            compatInvariant(caller.runId === recipientId, "permission_denied", "caller run scope does not match user mailbox");
          }
        }
        const messages = context.messageService.pullMessages({
          recipientKind,
          recipientId,
          ...(optionalInteger(payload, "maxItems") !== undefined ? { maxItems: optionalInteger(payload, "maxItems")! } : {}),
          ...(optionalString(payload, "sinceMessageId") ? { sinceMessageId: optionalString(payload, "sinceMessageId")! } : {})
        });
        return { kind: "result", name: request.name, payload: { messages: messages.map(mapMessageRecord) } };
      }
      case "approval.request": {
        const runId = requireString(payload, "runId");
        assertRunScope(runId, caller, callerWorker);
        const requestedByWorkerId = optionalString(payload, "requestedByWorkerId");
        if (caller.kind === "worker") {
          compatInvariant(
            !requestedByWorkerId || requestedByWorkerId === callerWorker!.id,
            "permission_denied",
            "requestedByWorkerId mismatch for worker caller"
          );
        }
        const approval = context.approvalService.requestApproval({
          runId,
          ...(optionalString(payload, "taskId") ? { taskId: optionalString(payload, "taskId")! } : {}),
          ...(caller.kind === "worker"
            ? { requestedByWorkerId: callerWorker!.id }
            : requestedByWorkerId
              ? { requestedByWorkerId }
              : {}),
          checkpoint: requireString(payload, "checkpoint"),
          question: requireString(payload, "question"),
          options: parseApprovalOptions(payload),
          ...(optionalString(payload, "expiresAt") ? { expiresAt: optionalString(payload, "expiresAt")! } : {})
        });
        return { kind: "result", name: request.name, payload: { approval: mapApprovalRecord(approval) } };
      }
      case "approval.respond": {
        compatInvariant(caller.kind !== "worker", "permission_denied", "worker caller cannot respond to approvals");
        const approvalId = requireString(payload, "approvalId");
        const responseCode = requireString(payload, "responseCode");
        const current = context.approvalService.getApproval(approvalId);
        assertRunScope(current.runId, caller, callerWorker);
        const status = mapResponseCode(responseCode);
        const resolved = context.approvalService.respondApproval(approvalId, status, optionalString(payload, "responseText"), {
          autoApproveRun: responseCode === "auto_approve_run",
          responseCode
        });
        return { kind: "result", name: request.name, payload: { approval: mapApprovalRecord(resolved) } };
      }
      case "artifact.publish": {
        const runId = requireString(payload, "runId");
        assertRunScope(runId, caller, callerWorker);
        const kind = requireString(payload, "kind") as ArtifactKind;
        compatInvariant(ARTIFACT_KINDS.has(kind), "validation_error", `artifact kind '${kind}' is invalid`);
        const workerIdPayload = optionalString(payload, "workerId");
        if (caller.kind === "worker") {
          compatInvariant(!workerIdPayload || workerIdPayload === callerWorker!.id, "permission_denied", "workerId mismatch for worker caller");
        }
        const workerId = caller.kind === "worker" ? callerWorker!.id : workerIdPayload;
        const taskId = optionalString(payload, "taskId");
        if (taskId) {
          const task = context.taskService.getTask(taskId);
          compatInvariant(task.runId === runId, "validation_error", `task '${taskId}' must belong to run '${runId}'`);
        }
        if (workerId) {
          const worker = context.workerService.getWorker(workerId);
          compatInvariant(worker.runId === runId, "validation_error", `worker '${workerId}' must belong to run '${runId}'`);
        }
        const summary = optionalString(payload, "summary") ?? "";
        const sourcePath = requireString(payload, "path");
        const baseDir = callerWorker?.cwd ?? context.config.paths.rootDir;
        const { canonicalPath, checksum } = canonicalizeArtifactPath(context, baseDir, sourcePath);
        const existing = context.store.artifacts.getByRunPath(runId, canonicalPath);
        if (existing) {
          if (existing.checksum === checksum) {
            return { kind: "result", name: request.name, payload: { artifactId: existing.id, path: existing.path } };
          }
          throw new CompatToolError("state_conflict", "artifact path already published with a different checksum", false, {
            artifactId: existing.id,
            path: existing.path
          });
        }
        const artifact = context.artifactService.publishArtifact({
          runId,
          ...(taskId ? { taskId } : {}),
          ...(workerId ? { workerId } : {}),
          artifactKind: kind,
          path: canonicalPath,
          checksum,
          summary,
          ...(optionalString(payload, "mimeType") ? { mimeType: optionalString(payload, "mimeType")! } : {}),
          metadata: payload.metadata && typeof payload.metadata === "object" ? asObject(payload.metadata, "metadata") : {}
        });
        return { kind: "result", name: request.name, payload: { artifactId: artifact.id, path: artifact.path } };
      }
      case "artifact.read": {
        const artifactId = optionalString(payload, "artifactId");
        let runId = optionalString(payload, "runId");
        let queryPath = optionalString(payload, "path");
        const scopedRunId = callerRunScope(caller, callerWorker);
        compatInvariant(Boolean(artifactId || (runId && queryPath)), "validation_error", "artifactId or runId+path is required");
        if (runId) {
          assertRunScope(runId, caller, callerWorker);
          if (queryPath) {
            if (!path.isAbsolute(queryPath)) {
              queryPath = path.resolve(context.config.paths.rootDir, queryPath);
            }
            if (existsSync(queryPath)) {
              queryPath = realpathSync(queryPath);
            }
          }
        }
        const artifact = context.artifactService.readArtifact({
          ...(artifactId ? { artifactId } : {}),
          ...(runId ? { runId } : {}),
          ...(queryPath ? { path: queryPath } : {})
        });
        const expectedRunId = runId ?? scopedRunId;
        if (expectedRunId && artifact.runId !== expectedRunId) {
          throw new CompatToolError("not_found", "artifact was not found in caller scope");
        }
        if (!runId) {
          runId = artifact.runId;
          assertRunScope(runId, caller, callerWorker);
        }
        return { kind: "result", name: request.name, payload: { artifact: mapArtifactRecord(artifact) } };
      }
      default:
        throw new CompatToolError("not_supported", `tool '${request.name}' is not supported`);
    }
  } catch (error) {
    throw toCompatError(error);
  }
}
