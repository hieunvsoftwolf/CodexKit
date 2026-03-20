export type CompatToolName =
  | "task.create"
  | "task.list"
  | "task.get"
  | "task.update"
  | "team.create"
  | "team.delete"
  | "worker.spawn"
  | "message.send"
  | "message.pull"
  | "approval.request"
  | "approval.respond"
  | "artifact.publish"
  | "artifact.read";

export interface CompatToolRequest {
  kind: "request";
  name: CompatToolName;
  payload: Record<string, unknown>;
}

export interface CompatToolResult {
  kind: "result";
  name: CompatToolName;
  payload: Record<string, unknown>;
}

export interface CompatCaller {
  kind: "system" | "user" | "worker";
  runId?: string;
  workerId?: string;
}
