import { existsSync } from "node:fs";
import path from "node:path";
import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";
import {
  PHASE8_ARTIFACT_FILE_NAMES,
  type PackagingActionPlan,
  type PackagingBlockedAction,
  type PackagingRepoClass
} from "./packaging-contracts.ts";
import { publishMigrationAssistantReport } from "./migration-assistant.ts";
import { buildPhase8ManagedTemplates } from "./phase8-managed-content.ts";
import {
  applyManagedTemplateWrites,
  buildPackagingActionPlan,
  buildManagedTemplatePayloadFingerprints,
  type ManagedTemplatePayloadFingerprint
} from "./phase8-packaging-plan.ts";
import { createReleaseManifestFromTemplates, readInstallState, writePhase8InstallMetadata } from "./phase8-install-state.ts";
import { runSharedRepoScan } from "./repo-scan-engine.ts";

export interface UpdateWorkflowInput {
  apply?: boolean;
  approveProtected?: boolean;
  approveManagedOverwrite?: boolean;
}

export interface UpdateWorkflowResult extends WorkflowBaseResult {
  workflow: "update";
  repoClass: PackagingRepoClass;
  applyRequested: boolean;
  applyExecuted: boolean;
  installOnly: boolean;
  writtenPaths: string[];
  actionPlan: PackagingActionPlan;
  blockedActions: PackagingBlockedAction[];
  updateReportPath: string;
  updateReportArtifactId: string;
  migrationAssistantReportPath: string;
  migrationAssistantReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

const UPDATE_PREVIEW_STATE_KEY = "phase8.preview-state.update";

interface UpdatePreviewState {
  fingerprint: string;
  runId: string;
  recordedAt: string;
}

function parseUpdatePreviewState(raw: string | null): UpdatePreviewState | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UpdatePreviewState>;
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

function readUpdatePreviewState(context: RuntimeContext): UpdatePreviewState | null {
  return parseUpdatePreviewState(context.store.settings.get(UPDATE_PREVIEW_STATE_KEY));
}

function writeUpdatePreviewState(context: RuntimeContext, state: UpdatePreviewState): void {
  context.store.settings.set(UPDATE_PREVIEW_STATE_KEY, JSON.stringify(state));
}

function buildUpdateCommand(input: UpdateWorkflowInput, includeApply: boolean): string {
  const tokens = ["cdx update"];
  if (includeApply) {
    tokens.push("--apply");
  }
  if (input.approveProtected === true) {
    tokens.push("--approve-protected");
  }
  if (input.approveManagedOverwrite === true) {
    tokens.push("--approve-managed-overwrite");
  }
  return tokens.join(" ");
}

function buildUpdatePreviewFingerprint(input: {
  repoClass: PackagingRepoClass;
  installOnly: boolean;
  hasInstallState: boolean;
  importRegistryPresent: boolean;
  actionPlan: PackagingActionPlan;
  blockedActions: PackagingBlockedAction[];
  payloadFingerprints: ManagedTemplatePayloadFingerprint[];
  approveProtected: boolean;
  approveManagedOverwrite: boolean;
}): string {
  return JSON.stringify({
    repoClass: input.repoClass,
    installOnly: input.installOnly,
    hasInstallState: input.hasInstallState,
    importRegistryPresent: input.importRegistryPresent,
    approvals: {
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

function renderList(items: string[]): string[] {
  if (items.length === 0) {
    return ["- none"];
  }
  return items.map((item) => `- ${item}`);
}

function renderUpdateReport(input: {
  repoClass: PackagingRepoClass;
  applyRequested: boolean;
  applyExecuted: boolean;
  installOnly: boolean;
  actionPlan: PackagingActionPlan;
  writtenPaths: string[];
  diagnostics: WorkflowCommandDiagnostics[];
}): string {
  return [
    "# Update Report",
    "",
    `- Repo class: ${input.repoClass}`,
    `- Apply requested: ${input.applyRequested ? "yes" : "no"}`,
    `- Apply executed: ${input.applyExecuted ? "yes" : "no"}`,
    `- Install-only state: ${input.installOnly ? "yes" : "no"}`,
    "",
    "## Managed File Changes",
    ...renderList(input.actionPlan.plannedWrites.map((item) => `${item.path} | ${item.disposition} | ${item.reason}`)),
    "",
    "## Preserved Files",
    ...renderList(input.actionPlan.preservedFiles.map((item) => `${item.path} | ${item.reason}`)),
    "",
    "## Conflicts",
    ...renderList(input.actionPlan.conflicts.map((item) => `${item.path} | ${item.reason}`)),
    "",
    "## Blocked Actions",
    ...renderList(input.actionPlan.blockedActions.map((item) => `${item.code} | ${item.path ?? "(global)"} | ${item.nextStep}`)),
    "",
    "## Applied Changes",
    ...renderList(input.writtenPaths),
    "",
    "## Manual Merge Actions",
    ...renderList(
      input.actionPlan.conflicts.length === 0
        ? []
        : input.actionPlan.conflicts.map((item) => `Review ${item.path} manually; auto-merge is intentionally disabled.`)
    ),
    "",
    "## Diagnostics",
    ...renderList(input.diagnostics.map((item) => `${item.code} | ${item.cause} | ${item.nextStep}`)),
    "",
    "## Unresolved Questions",
    "- none",
    ""
  ].join("\n");
}

export function runUpdateWorkflow(context: RuntimeContext, input: UpdateWorkflowInput = {}): UpdateWorkflowResult {
  const run = context.runService.createRun({
    workflow: "update",
    mode: "interactive",
    prompt: "cdx update"
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  const scan = runSharedRepoScan(context.config.paths.rootDir);
  const installState = readInstallState(context.config.paths.rootDir);
  const priorPreviewState = readUpdatePreviewState(context);
  const migrationAssistant = publishMigrationAssistantReport({
    context,
    runId: run.id,
    checkpoint: "update-scan",
    scan,
    workflowName: "update"
  });
  context.runService.recordWorkflowCheckpoint(run.id, "update-scan", {
    artifactPath: migrationAssistant.artifactPath,
    artifactId: migrationAssistant.artifactId
  });
  checkpointIds.push("update-scan");

  if (!installState) {
    diagnostics.push({
      code: "UPDATE_NOT_INSTALLED",
      cause: "CodexKit install-state metadata was not found.",
      nextStep: "Run cdx init first, then rerun cdx update."
    });
  }
  if (!existsSync(path.join(context.config.paths.rootDir, ".codexkit", "manifests", "import-registry.json"))) {
    diagnostics.push({
      code: "UPDATE_IMPORT_REGISTRY_MISSING",
      cause: "Managed import registry is missing or stale.",
      nextStep: "Run cdx init --apply to regenerate managed metadata."
    });
  }

  const templates = buildPhase8ManagedTemplates(context.config.paths.rootDir);
  const planned = buildPackagingActionPlan(context.config.paths.rootDir, templates, {
    approveProtected: input.approveProtected === true,
    approveManagedOverwrite: input.approveManagedOverwrite === true
  });
  const blockedActions = [...planned.plan.blockedActions];
  if (!installState) {
    blockedActions.push({
      code: "UPDATE_BLOCKED_NO_INSTALL_STATE",
      cause: "Update apply is blocked until install-state metadata exists.",
      nextStep: "Run cdx init --apply to create install-state metadata."
    });
  }
  const previewFingerprint = buildUpdatePreviewFingerprint({
    repoClass: scan.repoClass,
    installOnly: scan.installOnly,
    hasInstallState: Boolean(installState),
    importRegistryPresent: existsSync(path.join(context.config.paths.rootDir, ".codexkit", "manifests", "import-registry.json")),
    actionPlan: planned.plan,
    blockedActions,
    payloadFingerprints: buildManagedTemplatePayloadFingerprints(planned.writableTemplates),
    approveProtected: input.approveProtected === true,
    approveManagedOverwrite: input.approveManagedOverwrite === true
  });

  const applyRequested = input.apply === true;
  if (applyRequested && (!priorPreviewState || priorPreviewState.fingerprint !== previewFingerprint)) {
    blockedActions.push({
      code: "UPDATE_APPLY_REQUIRES_PREVIEW",
      cause: "Apply requires a matching preview from a prior command invocation.",
      nextStep: `Run ${buildUpdateCommand(input, false)}, review update-report.md, then rerun ${buildUpdateCommand(input, true)}.`
    });
  }
  let applyExecuted = false;
  let writtenPaths: string[] = [];
  if (applyRequested && blockedActions.length === 0) {
    writtenPaths = applyManagedTemplateWrites(context.config.paths.rootDir, planned.writableTemplates);
    const releaseManifest = createReleaseManifestFromTemplates(templates);
    writePhase8InstallMetadata({
      rootDir: context.config.paths.rootDir,
      repoClass: scan.repoClass,
      installOnly: scan.installOnly,
      releaseManifest,
      managedFiles: planned.managedFiles,
      ...(installState?.installedAt ? { installedAt: installState.installedAt } : {})
    });
    applyExecuted = true;
  } else if (applyRequested) {
    diagnostics.push({
      code: "UPDATE_APPLY_BLOCKED",
      cause: "Update apply was requested but blocked actions remain.",
      nextStep: "Review update-report.md and rerun cdx update --apply when blockers are cleared."
    });
  } else {
    diagnostics.push({
      code: "UPDATE_PREVIEW_ONLY",
      cause: "Update ran in preview-only mode.",
      nextStep: "Review update-report.md and rerun cdx update --apply when ready."
    });
  }

  const updateReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "update-preview",
    fileName: PHASE8_ARTIFACT_FILE_NAMES.update,
    summary: "update workflow report",
    markdown: renderUpdateReport({
      repoClass: scan.repoClass,
      applyRequested,
      applyExecuted,
      installOnly: scan.installOnly,
      actionPlan: { ...planned.plan, blockedActions },
      writtenPaths,
      diagnostics: [...scan.diagnostics, ...diagnostics]
    }),
    metadata: {
      workflow: "update",
      applyRequested,
      applyExecuted
    }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "update-preview", {
    artifactPath: updateReport.artifactPath,
    artifactId: updateReport.artifactId
  });
  checkpointIds.push("update-preview");

  writeUpdatePreviewState(context, {
    fingerprint: previewFingerprint,
    runId: run.id,
    recordedAt: context.clock.now().toISOString()
  });

  return {
    runId: run.id,
    workflow: "update",
    checkpointIds,
    repoClass: scan.repoClass,
    applyRequested,
    applyExecuted,
    installOnly: scan.installOnly,
    writtenPaths,
    actionPlan: { ...planned.plan, blockedActions },
    blockedActions,
    updateReportPath: updateReport.artifactPath,
    updateReportArtifactId: updateReport.artifactId,
    migrationAssistantReportPath: migrationAssistant.artifactPath,
    migrationAssistantReportArtifactId: migrationAssistant.artifactId,
    diagnostics: [...scan.diagnostics, ...diagnostics]
  };
}
