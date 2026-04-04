import os from "node:os";
import path from "node:path";
import type {
  RunMode,
  ValidationArtifactRef,
  ValidationEvidenceBundle,
  ValidationMetricResult,
  ValidationPassFailSummary,
  ValidationSuiteId,
  WorkflowCheckpointId,
  WorkflowCheckpointResponse
} from "../../../codexkit-core/src/index.ts";

export type WorkflowName =
  | "brainstorm"
  | "plan"
  | "cook"
  | "preview"
  | "review"
  | "test"
  | "debug"
  | "fix"
  | "team"
  | "docs"
  | "scout"
  | "init"
  | "doctor"
  | "resume"
  | "update";

export interface WorkflowCheckpointEntry {
  id: WorkflowCheckpointId;
  status: "completed";
  completedAt: string;
  artifactPath?: string;
  artifactId?: string;
  response?: WorkflowCheckpointResponse;
  noFile?: boolean;
}

export interface WorkflowState {
  currentCheckpoint?: WorkflowCheckpointId;
  checkpoints: Partial<Record<WorkflowCheckpointId, WorkflowCheckpointEntry>>;
  activePlanPath?: string;
  suggestedPlanPath?: string;
}

export interface WorkflowHandoffPolicy {
  mode?: RunMode;
  inheritAutoApproval?: boolean;
}

export interface WorkflowHandoffBundle {
  goal: string;
  constraints: string[];
  acceptedDecisions: string[];
  evidenceRefs: string[];
  unresolvedQuestionsOrBlockers: string[];
  nextAction: string;
}

export interface WorkflowHandoffRecord {
  fromRunId: string;
  toRunId: string;
  workflow: "plan" | "cook";
  policy: {
    mode: RunMode;
    approvalPolicy: "manual" | "auto";
    explicitOnly: true;
  };
  artifactIds: string[];
  bundle?: WorkflowHandoffBundle;
}

export interface WorkflowCommandDiagnostics {
  code: string;
  cause: string;
  nextStep: string;
}

export interface WorkflowBaseResult {
  runId: string;
  workflow: WorkflowName;
  checkpointIds: WorkflowCheckpointId[];
}

export type PreviewMode = "explain" | "slides" | "diagram" | "ascii";

export interface PreviewWorkflowInput {
  target?: string;
  mode?: PreviewMode;
  stop?: boolean;
}

export interface PreviewWorkflowResult extends WorkflowBaseResult {
  workflow: "preview";
  mode: PreviewMode;
  target: string;
  stopRequested: boolean;
  previewOutputPath: string;
  previewOutputArtifactId: string;
  previewViewUrl: string;
  previewViewUrlPath: string;
  previewViewUrlArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

export type FinalizeArtifactFileName =
  | "unresolved-mapping-report.md"
  | "docs-impact-report.md"
  | "git-handoff-report.md"
  | "finalize-report.md";

export type Phase9EvidenceFileName =
  | "validation-golden-evidence.json"
  | "validation-chaos-evidence.json"
  | "validation-migration-evidence.json";

export type Phase9ValidationReportFileName =
  | Phase9EvidenceFileName
  | "migration-validation-checklist.md"
  | "release-readiness-report.md";

export const PHASE9_VALIDATION_EVIDENCE_FILE_NAMES: Record<ValidationSuiteId, Phase9EvidenceFileName> = {
  "validation-golden": "validation-golden-evidence.json",
  "validation-chaos": "validation-chaos-evidence.json",
  "validation-migration": "validation-migration-evidence.json"
};

export const PHASE9_VALIDATION_CHECKPOINT_MEANINGS: Record<ValidationSuiteId, string> = {
  "validation-golden": "Golden parity checkpoint and artifact/report-shape validation evidence.",
  "validation-chaos": "Crash/reclaim/resume and recovery determinism evidence.",
  "validation-migration": "Migration checklist and release-safety validation evidence."
};

export const PHASE9_VALIDATION_REPORT_FILE_NAMES = {
  migrationChecklist: "migration-validation-checklist.md",
  releaseReadiness: "release-readiness-report.md"
} as const;

export interface FinalizeArtifactNames {
  unresolvedMapping: "unresolved-mapping-report.md";
  docsImpact: "docs-impact-report.md";
  gitHandoff: "git-handoff-report.md";
  finalize: "finalize-report.md";
}

export interface FinalizeEntryArtifacts {
  implementationSummaryPath?: string;
  testReportPath?: string;
  reviewReportPath?: string;
}

export interface FinalizeEntryContext {
  runId: string;
  workflow: WorkflowName;
  artifacts: FinalizeEntryArtifacts;
}

export interface FinalizeUnresolvedMapping {
  taskId: string;
  subject: string;
  phaseFile: string;
  reason: string;
}

export type FinalizeSyncStatus = "synced" | "no-active-plan";

export interface FinalizeSyncResult {
  status: FinalizeSyncStatus;
  note: string;
  planPath?: string;
  planDir?: string;
  updatedPlanPath?: string;
  updatedPhasePaths: string[];
  checkedBefore: number;
  checkedAfter: number;
  totalChecklistItems: number;
  unresolvedMappings: FinalizeUnresolvedMapping[];
  unresolvedMappingReportPath?: string;
  unresolvedMappingReportArtifactId?: string;
}

export type DocsImpactLevel = "none" | "minor" | "major";
export type DocsImpactAction = "no update needed" | "updated" | "needs separate follow-up";

export interface DocsImpactResult {
  level: DocsImpactLevel;
  action: DocsImpactAction;
  affectedPaths: string[];
  reason: string;
  reportPath: string;
  reportArtifactId: string;
}

export type GitHandoffChoice = "commit" | "do not commit" | "later";

export interface GitHandoffResult {
  changedFiles: string[];
  warnings: string[];
  suggestedCommitMessage: string;
  choices: GitHandoffChoice[];
  reportPath: string;
  reportArtifactId: string;
  autoCommit: false;
}

export interface FinalizeWorkflowInput {
  runId: string;
  workflow: WorkflowName;
  planPathHint?: string;
}

export interface FinalizeWorkflowResult {
  runId: string;
  workflow: WorkflowName;
  checkpointIds: WorkflowCheckpointId[];
  entry: FinalizeEntryContext;
  sync: FinalizeSyncResult;
  docsImpact: DocsImpactResult;
  gitHandoff: GitHandoffResult;
  finalizeReportPath: string;
  finalizeReportArtifactId: string;
  artifactNames: FinalizeArtifactNames;
  noAutoCommit: true;
}

export type PlanMode = "auto" | "fast" | "hard" | "parallel" | "two";

export interface MigrationValidationChecklistRow {
  checklistId: string;
  fixtureId: string;
  requirement: string;
  metricIds: string[];
  status: "pass" | "fail" | "blocked";
  evidenceRefs: string[];
  notes: string;
}

export function phase9SuiteToEvidenceFileName(suiteId: ValidationSuiteId): Phase9EvidenceFileName {
  return PHASE9_VALIDATION_EVIDENCE_FILE_NAMES[suiteId];
}

export function summarizeValidationMetricResults(metricResults: ValidationMetricResult[]): ValidationPassFailSummary {
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let requiredNonPass = 0;
  for (const metric of metricResults) {
    if (metric.status === "pass") {
      passed += 1;
      continue;
    }
    if (metric.status === "fail") {
      failed += 1;
    } else {
      blocked += 1;
    }
    if (metric.required) {
      requiredNonPass += 1;
    }
  }
  return {
    passed,
    failed,
    blocked,
    requiredNonPass
  };
}

function isIsoTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isKnownHostField(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "n/a" && normalized !== "na";
}

function artifactRefKey(ref: ValidationArtifactRef): string {
  if (typeof ref.artifactId === "string" && ref.artifactId.trim().length > 0) {
    return `artifact:${ref.artifactId.trim()}`;
  }
  return `path:${path.resolve(ref.path)}`;
}

function isDurableArtifactRef(ref: ValidationArtifactRef): boolean {
  if (typeof ref.artifactId === "string" && ref.artifactId.trim().length > 0) {
    return true;
  }
  if (typeof ref.path !== "string" || ref.path.trim().length === 0 || !path.isAbsolute(ref.path)) {
    return false;
  }
  const resolved = path.resolve(ref.path);
  const systemTmp = path.resolve(os.tmpdir());
  const durableTmpPrefix = path.resolve(process.cwd(), ".tmp", "phase9-durable-artifacts");
  if (resolved.startsWith(systemTmp) && !resolved.startsWith(durableTmpPrefix)) {
    return false;
  }
  return true;
}

export function validateValidationEvidenceBundle(bundle: ValidationEvidenceBundle): string[] {
  const errors: string[] = [];
  if (bundle.schemaVersion !== "phase9-validation-evidence-v2") {
    errors.push("schemaVersion must be phase9-validation-evidence-v2");
  }
  if (typeof bundle.baseSha !== "string" || bundle.baseSha.trim().length === 0) {
    errors.push("baseSha is required");
  }
  if (typeof bundle.candidateSha !== "string" || bundle.candidateSha.trim().length === 0) {
    errors.push("candidateSha is required");
  }
  if (typeof bundle.generatedAt !== "string" || bundle.generatedAt.trim().length === 0) {
    errors.push("generatedAt is required");
  } else if (!isIsoTimestamp(bundle.generatedAt)) {
    errors.push("generatedAt must be an ISO timestamp");
  }
  if (typeof bundle.freshUntil !== "string" || bundle.freshUntil.trim().length === 0) {
    errors.push("freshUntil is required");
  } else if (!isIsoTimestamp(bundle.freshUntil)) {
    errors.push("freshUntil must be an ISO timestamp");
  }
  if (isIsoTimestamp(bundle.generatedAt) && isIsoTimestamp(bundle.freshUntil) && Date.parse(bundle.freshUntil) < Date.parse(bundle.generatedAt)) {
    errors.push("freshUntil must be >= generatedAt");
  }
  if (typeof bundle.freshnessRule !== "string" || bundle.freshnessRule.trim().length === 0) {
    errors.push("freshnessRule is required");
  }
  if (!Array.isArray(bundle.fixtureIds) || bundle.fixtureIds.length === 0) {
    errors.push("fixtureIds must include at least one fixture id");
  }
  if (!Array.isArray(bundle.metricResults) || bundle.metricResults.length === 0) {
    errors.push("metricResults must include at least one metric result");
  }
  for (const metric of bundle.metricResults) {
    if (typeof metric.metricId !== "string" || metric.metricId.trim().length === 0) {
      errors.push("metricResults[].metricId is required");
    }
    if (!Array.isArray(metric.mappedNfrIds) || metric.mappedNfrIds.length === 0) {
      errors.push(`metric ${metric.metricId || "<unknown>"} must include mappedNfrIds`);
    }
    if (!Array.isArray(metric.fixtureRefs) || metric.fixtureRefs.length === 0) {
      errors.push(`metric ${metric.metricId || "<unknown>"} must include fixtureRefs`);
    } else {
      for (const fixtureRef of metric.fixtureRefs) {
        if (!bundle.fixtureIds.includes(fixtureRef)) {
          errors.push(`metric ${metric.metricId || "<unknown>"} fixtureRef '${fixtureRef}' is not declared in fixtureIds`);
        }
      }
    }
    if (!Array.isArray(metric.hostManifestRefs) || metric.hostManifestRefs.length === 0) {
      errors.push(`metric ${metric.metricId || "<unknown>"} must include hostManifestRefs`);
    }
    if (!Array.isArray(metric.artifactRefs) || metric.artifactRefs.length === 0) {
      errors.push(`metric ${metric.metricId || "<unknown>"} must include artifactRefs`);
    } else {
      for (const ref of metric.artifactRefs) {
        if (!isDurableArtifactRef(ref)) {
          errors.push(`metric ${metric.metricId || "<unknown>"} includes a non-durable artifact ref '${ref.label}'`);
        }
      }
    }
    if (!Array.isArray(metric.evidence) || metric.evidence.length === 0) {
      errors.push(`metric ${metric.metricId || "<unknown>"} must include evidence refs`);
    }
  }
  const host = bundle.hostManifest;
  if (!host || typeof host !== "object") {
    errors.push("hostManifest is required");
  } else {
    const hostFields: Array<keyof typeof host> = [
      "os",
      "cpu",
      "filesystem",
      "nodeVersion",
      "gitVersion",
      "codexCliVersion"
    ];
    for (const field of hostFields) {
      if (typeof host[field] !== "string" || !isKnownHostField(host[field])) {
        errors.push(`hostManifest.${field} is required`);
      }
    }
    if (typeof host.ramBytes !== "number" || !Number.isFinite(host.ramBytes) || host.ramBytes <= 0) {
      errors.push("hostManifest.ramBytes must be a positive number");
    }
  }
  if (!Array.isArray(bundle.artifactRefs) || bundle.artifactRefs.length === 0) {
    errors.push("artifactRefs must be a non-empty array");
  } else {
    for (const ref of bundle.artifactRefs) {
      if (ref.durability !== "durable") {
        errors.push(`artifactRefs '${ref.label}' must set durability=durable`);
      }
      if (!isDurableArtifactRef(ref)) {
        errors.push(`artifactRefs '${ref.label}' must resolve to durable storage`);
      }
    }
  }
  const bundleArtifactKeys = new Set(bundle.artifactRefs.map(artifactRefKey));
  for (const metric of bundle.metricResults) {
    for (const ref of metric.artifactRefs) {
      if (!bundleArtifactKeys.has(artifactRefKey(ref))) {
        errors.push(`metric ${metric.metricId || "<unknown>"} artifact ref '${ref.label}' is not present in bundle artifactRefs`);
      }
    }
  }
  const computed = summarizeValidationMetricResults(bundle.metricResults);
  if (bundle.summary.passed !== computed.passed
    || bundle.summary.failed !== computed.failed
    || bundle.summary.blocked !== computed.blocked
    || bundle.summary.requiredNonPass !== computed.requiredNonPass) {
    errors.push("summary does not match metricResults");
  }
  return errors;
}

export function planModeToRunMode(mode: PlanMode): RunMode {
  if (mode === "fast") {
    return "fast";
  }
  if (mode === "parallel") {
    return "parallel";
  }
  if (mode === "auto") {
    return "auto";
  }
  return "interactive";
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function modeToCookHandoff(mode: PlanMode, absolutePlanPath: string): string {
  const planPath = shellQuote(absolutePlanPath);
  if (mode === "fast") {
    return `cdx cook --auto ${planPath}`;
  }
  if (mode === "parallel") {
    return `cdx cook --parallel ${planPath}`;
  }
  return `cdx cook ${planPath}`;
}

export function isFinalizeArtifactFileName(fileName: string): fileName is FinalizeArtifactFileName {
  return fileName === "unresolved-mapping-report.md"
    || fileName === "docs-impact-report.md"
    || fileName === "git-handoff-report.md"
    || fileName === "finalize-report.md";
}
