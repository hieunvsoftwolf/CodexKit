import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { WorkflowCommandDiagnostics } from "./contracts.ts";

export type PackagingRepoClass =
  | "fresh"
  | "install-only-no-initial-commit"
  | "existing-codexkit"
  | "claudekit-style"
  | "unsupported-or-broken";

export type ManagedFileDisposition =
  | "managed"
  | "protected-managed"
  | "preserved"
  | "conflict"
  | "manual-review";

export type PackagingApprovalGate = "git-init" | "protected-path" | "managed-overwrite";

export interface ManagedFilePreviewItem {
  path: string;
  disposition: ManagedFileDisposition;
  exists: boolean;
  changed: boolean;
  protectedPath: boolean;
  reason: string;
  approvalGates: PackagingApprovalGate[];
}

export interface PackagingBlockedAction {
  code: string;
  cause: string;
  nextStep: string;
  gate?: PackagingApprovalGate;
  path?: string;
}

export interface PackagingActionPlan {
  plannedWrites: ManagedFilePreviewItem[];
  preservedFiles: ManagedFilePreviewItem[];
  conflicts: ManagedFilePreviewItem[];
  manualReview: ManagedFilePreviewItem[];
  blockedActions: PackagingBlockedAction[];
  approvalsRequired: PackagingApprovalGate[];
}

export interface SharedRepoScanResult {
  repoClass: PackagingRepoClass;
  hasGitRepo: boolean;
  hasInitialCommit: boolean;
  hasCodexkitRuntime: boolean;
  hasCodexkitInstallState: boolean;
  markers: string[];
  riskyCustomizations: string[];
  requiredActions: string[];
  installOnly: boolean;
  diagnostics: WorkflowCommandDiagnostics[];
}

export interface MigrationAssistantSummary {
  repoClass: PackagingRepoClass;
  markers: string[];
  requiredActions: string[];
  riskyCustomizations: string[];
  recommendedNextCommands: string[];
}

export const PHASE8_ARTIFACT_FILE_NAMES = {
  init: "init-report.md",
  doctor: "doctor-report.md",
  resume: "resume-report.md",
  update: "update-report.md",
  migrationAssistant: "migration-assistant-report.md"
} as const;

export const PHASE8_CHECKPOINT_IDS = {
  init: ["package-scan", "package-preview", "package-apply"] as WorkflowCheckpointId[],
  doctor: ["doctor-scan"] as WorkflowCheckpointId[],
  resume: ["resume-select", "resume-recover"] as WorkflowCheckpointId[],
  update: ["update-scan", "update-preview"] as WorkflowCheckpointId[]
} as const;

export function isProtectedManagedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized === "AGENTS.md"
    || normalized === ".codex"
    || normalized.startsWith(".codex/");
}

export function uniqueApprovalGates(items: ManagedFilePreviewItem[]): PackagingApprovalGate[] {
  return Array.from(new Set(items.flatMap((item) => item.approvalGates)));
}

export function quoteCommandArg(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}
