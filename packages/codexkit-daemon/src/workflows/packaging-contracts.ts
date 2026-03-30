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

export interface Phase10PublicPackageBinContract {
  packageName: "@codexkit/cli";
  binName: "cdx";
}

export const PHASE10_PUBLIC_PACKAGE_BIN_CONTRACT: Phase10PublicPackageBinContract = {
  packageName: "@codexkit/cli",
  binName: "cdx"
};

export const PHASE10_PUBLIC_NPM_PACKAGE_NAME = PHASE10_PUBLIC_PACKAGE_BIN_CONTRACT.packageName;
export const PHASE10_PUBLIC_CLI_BIN_NAME = PHASE10_PUBLIC_PACKAGE_BIN_CONTRACT.binName;
export const PHASE10_RUNNER_ENV_OVERRIDE = "CODEXKIT_RUNNER" as const;
export const PHASE10_DEFAULT_RUNNER_COMMAND = ["codex", "exec"] as const;
export const PHASE10_RUNNER_CONFIG_PATH = ".codexkit/config.toml" as const;
export const PHASE10_RUNNER_CONFIG_KEY = "runner.command" as const;

export type Phase10RunnerSource = "env-override" | "config-file" | "default";

export const PHASE10_RUNNER_RESOLUTION_ORDER: Phase10RunnerSource[] = [
  "env-override",
  "config-file",
  "default"
];

export interface Phase10PublicCommandContract {
  installNpx: string;
  installGlobal: string;
  initNpx: string;
  doctorNpx: string;
  initGlobal: string;
  doctorGlobal: string;
}

export const PHASE10_PUBLIC_COMMAND_CONTRACT: Phase10PublicCommandContract = {
  installNpx: `npx ${PHASE10_PUBLIC_NPM_PACKAGE_NAME} init`,
  installGlobal: `npm install -g ${PHASE10_PUBLIC_NPM_PACKAGE_NAME}`,
  initNpx: `npx ${PHASE10_PUBLIC_NPM_PACKAGE_NAME} init`,
  doctorNpx: `npx ${PHASE10_PUBLIC_NPM_PACKAGE_NAME} doctor`,
  initGlobal: `${PHASE10_PUBLIC_CLI_BIN_NAME} init`,
  doctorGlobal: `${PHASE10_PUBLIC_CLI_BIN_NAME} doctor`
};

export type Phase10PublicSmokeCaseId =
  | "fresh-repo"
  | "git-backed-repo"
  | "install-only-repo"
  | "wrapped-runner";

export interface Phase10PublicSmokeCase {
  id: Phase10PublicSmokeCaseId;
  title: string;
  minimumChecks: string[];
}

export const PHASE10_PUBLIC_BETA_SMOKE_MATRIX: Phase10PublicSmokeCase[] = [
  {
    id: "fresh-repo",
    title: "fresh repo install and first-run safety",
    minimumChecks: [
      "install package through npm artifact entrypoint",
      "run init preview and apply",
      "verify install-only gate when first commit is missing",
      "run doctor for typed health output"
    ]
  },
  {
    id: "git-backed-repo",
    title: "git-backed repo quickstart smoke path",
    minimumChecks: [
      "install package through npm artifact entrypoint",
      "run init",
      "run doctor",
      "execute brainstorm -> plan -> cook minimum flow"
    ]
  },
  {
    id: "install-only-repo",
    title: "install-only repo worker workflow block contract",
    minimumChecks: [
      "prove worker-backed workflows stay blocked before first commit",
      "verify one explicit next-step command in diagnostics"
    ]
  },
  {
    id: "wrapped-runner",
    title: "wrapped runner contract",
    minimumChecks: [
      "configure wrapper command through env or .codexkit/config.toml",
      "run doctor and confirm active runner source reporting contract",
      "prove worker launch resolves through wrapper command"
    ]
  }
];

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
