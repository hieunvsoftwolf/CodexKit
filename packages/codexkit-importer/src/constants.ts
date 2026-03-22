import type { WorkflowOverride } from "./types.ts";

export const DEFAULT_IMPORTED_AT = "1970-01-01T00:00:00.000Z";

export const CLAUDE_TOOL_REWRITES: Array<{ pattern: RegExp; target: string }> = [
  { pattern: /\bAskUserQuestion\b/g, target: "approval.request" },
  { pattern: /\bTaskCreate\b/g, target: "task.create" },
  { pattern: /\bTaskList\b/g, target: "task.list" },
  { pattern: /\bTaskGet\b/g, target: "task.get" },
  { pattern: /\bTaskUpdate\b/g, target: "task.update" },
  { pattern: /\bTeamCreate\b/g, target: "team.create" },
  { pattern: /\bTeamDelete\b/g, target: "team.delete" },
  { pattern: /\bSendMessage\b/g, target: "message.send" },
  { pattern: /\bTask\s*\(/g, target: "worker.spawn" }
];

export const LOCAL_TOOL_CAPABILITIES = new Set([
  "glob",
  "grep",
  "read",
  "edit",
  "multiedit",
  "write",
  "notebookedit",
  "bash",
  "webfetch",
  "websearch",
  "task",
  "todo",
  "skill"
]);

export const ROLE_DEFAULT_ACCESS = new Map<string, string>([
  ["brainstormer", "read-only"],
  ["researcher", "read-only"],
  ["planner", "plans-write"],
  ["code-reviewer", "read-only"],
  ["docs-manager", "docs-write"],
  ["project-manager", "plans-write"],
  ["git-manager", "git-ops"],
  ["tester", "owned-scope"],
  ["fullstack-developer", "owned-scope"],
  ["ui-ux-designer", "owned-scope"]
]);

export const ROLE_STATUS_OVERRIDES = new Map<string, "deferred" | "manual-review">([
  ["code-simplifier", "deferred"],
  ["mcp-manager", "manual-review"]
]);

export const POLICY_APPLICABILITY = new Map<string, string[]>([
  ["development-rules", ["all"]],
  ["primary-workflow", ["implementation-workflows"]],
  ["orchestration-protocol", ["orchestration-workflows"]],
  ["documentation-management", ["docs-workflows"]],
  ["team-coordination-rules", ["team-workflow", "team-roles"]]
]);

export const CORE_WORKFLOW_OVERRIDES = new Map<string, WorkflowOverride>([
  ["brainstorm", { id: "brainstorm", command: "cdx brainstorm" }],
  ["plan", { id: "plan", command: "cdx plan" }],
  ["cook", { id: "cook", command: "cdx cook" }],
  ["fix", { id: "fix", command: "cdx fix" }],
  ["debug", { id: "debug", command: "cdx debug" }],
  ["code-review", { id: "review", command: "cdx review" }],
  ["test", { id: "test", command: "cdx test" }],
  ["team", { id: "team", command: "cdx team" }],
  ["docs", { id: "docs", command: "cdx docs" }],
  ["journal", { id: "journal", command: "cdx journal" }],
  ["preview", { id: "preview", command: "cdx preview" }],
  ["scout", { id: "scout", command: "cdx scout" }]
]);

export const KNOWN_ROLES = [
  "brainstormer",
  "researcher",
  "planner",
  "code-reviewer",
  "docs-manager",
  "project-manager",
  "git-manager",
  "tester",
  "fullstack-developer",
  "ui-ux-designer",
  "debugger",
  "journal-writer",
  "control-agent",
  "mcp-manager",
  "code-simplifier"
];
