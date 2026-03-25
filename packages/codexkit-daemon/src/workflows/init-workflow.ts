import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";
import {
  PHASE8_ARTIFACT_FILE_NAMES,
  PHASE8_CHECKPOINT_IDS,
  type PackagingActionPlan,
  type PackagingBlockedAction,
  type PackagingRepoClass
} from "./packaging-contracts.ts";
import { publishMigrationAssistantReport } from "./migration-assistant.ts";
import { buildPhase8ManagedTemplates } from "./phase8-managed-content.ts";
import {
  buildPackagingActionPlan,
  applyManagedTemplateWrites,
  buildManagedTemplatePayloadFingerprints,
  type ManagedTemplatePayloadFingerprint
} from "./phase8-packaging-plan.ts";
import { createReleaseManifestFromTemplates, writePhase8InstallMetadata } from "./phase8-install-state.ts";
import { runSharedRepoScan } from "./repo-scan-engine.ts";

export interface InitWorkflowInput {
  apply?: boolean;
  initGit?: boolean;
  approveGitInit?: boolean;
  approveProtected?: boolean;
  approveManagedOverwrite?: boolean;
}

export interface InitWorkflowResult extends WorkflowBaseResult {
  workflow: "init";
  repoClass: PackagingRepoClass;
  installOnly: boolean;
  applyRequested: boolean;
  applyExecuted: boolean;
  writtenPaths: string[];
  initializedGit: boolean;
  actionPlan: PackagingActionPlan;
  blockedActions: PackagingBlockedAction[];
  migrationAssistantReportPath: string;
  migrationAssistantReportArtifactId: string;
  initReportPath: string;
  initReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

const INIT_PREVIEW_STATE_KEY = "phase8.preview-state.init";

interface InitPreviewState {
  fingerprint: string;
  runId: string;
  recordedAt: string;
}

function toJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function parseInitPreviewState(raw: string | null): InitPreviewState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<InitPreviewState>;
    if (
      typeof parsed.fingerprint === "string"
      && typeof parsed.runId === "string"
      && typeof parsed.recordedAt === "string"
    ) {
      return {
        fingerprint: parsed.fingerprint,
        runId: parsed.runId,
        recordedAt: parsed.recordedAt
      };
    }
  } catch {
    return null;
  }
  return null;
}

function readInitPreviewState(context: RuntimeContext): InitPreviewState | null {
  return parseInitPreviewState(context.store.settings.get(INIT_PREVIEW_STATE_KEY));
}

function writeInitPreviewState(context: RuntimeContext, state: InitPreviewState): void {
  context.store.settings.set(INIT_PREVIEW_STATE_KEY, JSON.stringify(state));
}

function buildInitCommand(input: InitWorkflowInput, includeApply: boolean): string {
  const tokens = ["cdx init"];
  if (includeApply) {
    tokens.push("--apply");
  }
  if (input.initGit === true) {
    tokens.push("--init-git");
  }
  if (input.approveGitInit === true) {
    tokens.push("--approve-git-init");
  }
  if (input.approveProtected === true) {
    tokens.push("--approve-protected");
  }
  if (input.approveManagedOverwrite === true) {
    tokens.push("--approve-managed-overwrite");
  }
  return tokens.join(" ");
}

function buildInitPreviewFingerprint(input: {
  repoClass: PackagingRepoClass;
  hasGitRepo: boolean;
  hasInitialCommit: boolean;
  actionPlan: PackagingActionPlan;
  blockedActions: PackagingBlockedAction[];
  payloadFingerprints: ManagedTemplatePayloadFingerprint[];
  initGitRequested: boolean;
  approveGitInit: boolean;
  approveProtected: boolean;
  approveManagedOverwrite: boolean;
}): string {
  return JSON.stringify({
    repoClass: input.repoClass,
    hasGitRepo: input.hasGitRepo,
    hasInitialCommit: input.hasInitialCommit,
    initGitRequested: input.initGitRequested,
    approvals: {
      gitInit: input.approveGitInit,
      protected: input.approveProtected,
      managedOverwrite: input.approveManagedOverwrite
    },
    actionPlan: {
      plannedWrites: input.actionPlan.plannedWrites.map((item) => ({
        path: item.path,
        disposition: item.disposition,
        reason: item.reason,
        approvalGates: item.approvalGates
      })),
      preservedFiles: input.actionPlan.preservedFiles.map((item) => ({ path: item.path, reason: item.reason })),
      conflicts: input.actionPlan.conflicts.map((item) => ({ path: item.path, reason: item.reason })),
      manualReview: input.actionPlan.manualReview.map((item) => ({ path: item.path, reason: item.reason }))
    },
    blockedActions: input.blockedActions.map((item) => ({
      code: item.code,
      path: item.path ?? null,
      gate: item.gate ?? null,
      cause: item.cause,
      nextStep: item.nextStep
    })),
    payloadFingerprints: input.payloadFingerprints
  });
}

function ensureImportRegistry(rootDir: string): void {
  const registryPath = path.join(rootDir, ".codexkit", "manifests", "import-registry.json");
  if (existsSync(registryPath)) {
    return;
  }
  mkdirSync(path.dirname(registryPath), { recursive: true });
  writeFileSync(
    registryPath,
    toJson({
      schemaVersion: 1,
      importedAt: new Date().toISOString(),
      sourceRoot: ".",
      sourceKit: {
        ckConfigFound: false,
        metadataFound: false,
        ckConfig: null,
        metadata: null
      },
      summary: {
        roles: 0,
        coreWorkflows: 0,
        helperWorkflows: 0,
        policies: 0,
        legacySkipped: 0,
        unsupportedSkipped: 0,
        quarantined: 0,
        templatesDeferred: 0
      },
      entries: [],
      skipped: [],
      conflicts: [],
      warnings: ["import registry initialized by cdx init"]
    }),
    "utf8"
  );
}

function renderActionList(items: string[]): string[] {
  if (items.length === 0) {
    return ["- none"];
  }
  return items.map((item) => `- ${item}`);
}

function renderInitReport(input: {
  repoClass: PackagingRepoClass;
  applyRequested: boolean;
  applyExecuted: boolean;
  installOnly: boolean;
  initializedGit: boolean;
  actionPlan: PackagingActionPlan;
  writtenPaths: string[];
  diagnostics: WorkflowCommandDiagnostics[];
}): string {
  const lines = [
    "# Init Report",
    "",
    `- Repo class: ${input.repoClass}`,
    `- Apply requested: ${input.applyRequested ? "yes" : "no"}`,
    `- Apply executed: ${input.applyExecuted ? "yes" : "no"}`,
    `- Install-only state: ${input.installOnly ? "yes" : "no"}`,
    `- git init executed: ${input.initializedGit ? "yes" : "no"}`,
    "",
    "## Planned Writes",
    ...renderActionList(input.actionPlan.plannedWrites.map((item) => `${item.path} | ${item.disposition} | ${item.reason}`)),
    "",
    "## Preserved Files",
    ...renderActionList(input.actionPlan.preservedFiles.map((item) => `${item.path} | ${item.reason}`)),
    "",
    "## Conflicts",
    ...renderActionList(input.actionPlan.conflicts.map((item) => `${item.path} | ${item.reason}`)),
    "",
    "## Blocked Actions",
    ...renderActionList(input.actionPlan.blockedActions.map((item) => `${item.code} | ${item.path ?? "(global)"} | ${item.nextStep}`)),
    "",
    "## Applied Changes",
    ...renderActionList(input.writtenPaths),
    "",
    "## Diagnostics",
    ...renderActionList(input.diagnostics.map((diag) => `${diag.code} | ${diag.cause} | ${diag.nextStep}`)),
    "",
    "## Next Steps",
    ...(input.installOnly
      ? ["- Create the first commit before worker-backed workflows.", "- Run cdx doctor."]
      : ["- Run cdx doctor.", "- Run cdx resume or cdx cook <absolute-plan-path> as needed."]),
    "",
    "## Unresolved Questions",
    "- none",
    ""
  ];
  return lines.join("\n");
}

function hasBlockingAction(blockedActions: PackagingBlockedAction[]): boolean {
  return blockedActions.length > 0;
}

function hasInitialCommit(rootDir: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: rootDir, stdio: ["ignore", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}

export function runInitWorkflow(context: RuntimeContext, input: InitWorkflowInput = {}): InitWorkflowResult {
  const applyRequested = input.apply === true;
  const run = context.runService.createRun({
    workflow: "init",
    mode: "interactive",
    prompt: "cdx init"
  });
  const scan = runSharedRepoScan(context.config.paths.rootDir);
  const diagnostics: WorkflowCommandDiagnostics[] = [...scan.diagnostics];
  const checkpointIds: WorkflowCheckpointId[] = [];
  const migrationAssistant = publishMigrationAssistantReport({
    context,
    runId: run.id,
    checkpoint: "package-scan",
    scan,
    workflowName: "init"
  });
  context.runService.recordWorkflowCheckpoint(run.id, "package-scan", {
    artifactPath: migrationAssistant.artifactPath,
    artifactId: migrationAssistant.artifactId
  });
  checkpointIds.push("package-scan");

  const templates = buildPhase8ManagedTemplates(context.config.paths.rootDir);
  const planned = buildPackagingActionPlan(context.config.paths.rootDir, templates, {
    approveProtected: input.approveProtected === true,
    approveManagedOverwrite: input.approveManagedOverwrite === true
  });
  const blockedActions = [...planned.plan.blockedActions];
  const priorPreviewState = readInitPreviewState(context);
  let initializedGit = false;
  if (input.initGit === true && !scan.hasGitRepo && input.approveGitInit !== true) {
    blockedActions.push({
      code: "APPROVAL_REQUIRED_GIT_INIT",
      cause: "git init requested but explicit approval is missing.",
      nextStep: "Rerun with --approve-git-init to allow git init.",
      gate: "git-init"
    });
  }
  const previewFingerprint = buildInitPreviewFingerprint({
    repoClass: scan.repoClass,
    hasGitRepo: scan.hasGitRepo,
    hasInitialCommit: scan.hasInitialCommit,
    actionPlan: planned.plan,
    blockedActions,
    payloadFingerprints: buildManagedTemplatePayloadFingerprints(planned.writableTemplates),
    initGitRequested: input.initGit === true,
    approveGitInit: input.approveGitInit === true,
    approveProtected: input.approveProtected === true,
    approveManagedOverwrite: input.approveManagedOverwrite === true
  });

  if (applyRequested && (!priorPreviewState || priorPreviewState.fingerprint !== previewFingerprint)) {
    blockedActions.push({
      code: "INIT_APPLY_REQUIRES_PREVIEW",
      cause: "Apply requires a matching preview from a prior command invocation.",
      nextStep: `Run ${buildInitCommand(input, false)}, review init-report.md, then rerun ${buildInitCommand(input, true)}.`
    });
  }

  let applyExecuted = false;
  let writtenPaths: string[] = [];
  if (applyRequested && !hasBlockingAction(blockedActions)) {
    if (input.initGit === true && !scan.hasGitRepo) {
      execFileSync("git", ["init"], { cwd: context.config.paths.rootDir, stdio: ["ignore", "pipe", "pipe"] });
      initializedGit = true;
    }
    writtenPaths = applyManagedTemplateWrites(context.config.paths.rootDir, planned.writableTemplates);
    ensureImportRegistry(context.config.paths.rootDir);
    const releaseManifest = createReleaseManifestFromTemplates(templates);
    const installOnly = !hasInitialCommit(context.config.paths.rootDir);
    writePhase8InstallMetadata({
      rootDir: context.config.paths.rootDir,
      repoClass: scan.repoClass,
      installOnly,
      releaseManifest,
      managedFiles: planned.managedFiles
    });
    applyExecuted = true;
  } else if (applyRequested) {
    diagnostics.push({
      code: "INIT_APPLY_BLOCKED",
      cause: "Apply was requested but blocked actions remain.",
      nextStep: "Resolve blocked actions from init-report.md and rerun cdx init --apply."
    });
  } else {
    diagnostics.push({
      code: "INIT_PREVIEW_ONLY",
      cause: "Init ran in preview-only mode.",
      nextStep: "Review init-report.md, then rerun with --apply when ready."
    });
  }

  const installOnly = !hasInitialCommit(context.config.paths.rootDir);
  const initReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "package-preview",
    fileName: PHASE8_ARTIFACT_FILE_NAMES.init,
    summary: "init workflow report",
    markdown: renderInitReport({
      repoClass: scan.repoClass,
      applyRequested,
      applyExecuted,
      installOnly,
      initializedGit,
      actionPlan: { ...planned.plan, blockedActions },
      writtenPaths,
      diagnostics
    }),
    metadata: {
      workflow: "init",
      applyRequested,
      applyExecuted
    }
  });

  context.runService.recordWorkflowCheckpoint(run.id, "package-preview", {
    artifactPath: initReport.artifactPath,
    artifactId: initReport.artifactId
  });
  checkpointIds.push("package-preview");

  writeInitPreviewState(context, {
    fingerprint: previewFingerprint,
    runId: run.id,
    recordedAt: context.clock.now().toISOString()
  });

  if (applyRequested) {
    context.runService.recordWorkflowCheckpoint(run.id, "package-apply", {
      artifactPath: initReport.artifactPath,
      artifactId: initReport.artifactId,
      ...(applyExecuted ? {} : { noFile: true })
    });
    checkpointIds.push("package-apply");
  }

  return {
    runId: run.id,
    workflow: "init",
    checkpointIds,
    repoClass: scan.repoClass,
    installOnly,
    applyRequested,
    applyExecuted,
    writtenPaths,
    initializedGit,
    actionPlan: { ...planned.plan, blockedActions },
    blockedActions,
    migrationAssistantReportPath: migrationAssistant.artifactPath,
    migrationAssistantReportArtifactId: migrationAssistant.artifactId,
    initReportPath: initReport.artifactPath,
    initReportArtifactId: initReport.artifactId,
    diagnostics
  };
}

export function initCheckpointIds(): WorkflowCheckpointId[] {
  return [...PHASE8_CHECKPOINT_IDS.init];
}
