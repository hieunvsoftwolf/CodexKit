import type { RunMode, WorkflowCheckpointId, WorkflowCheckpointResponse } from "../../../codexkit-core/src/index.ts";

export type WorkflowName = "brainstorm" | "plan" | "cook" | "review" | "test" | "debug" | "fix" | "team";

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

export type FinalizeArtifactFileName =
  | "unresolved-mapping-report.md"
  | "docs-impact-report.md"
  | "git-handoff-report.md"
  | "finalize-report.md";

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
