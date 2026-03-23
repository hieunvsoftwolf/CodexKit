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
