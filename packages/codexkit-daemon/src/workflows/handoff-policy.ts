import type { RunMode } from "../../../codexkit-core/src/index.ts";
import type { ApprovalService } from "../../../codexkit-core/src/services/approval-service.ts";
import type { RunService } from "../../../codexkit-core/src/services/run-service.ts";
import type { WorkflowHandoffPolicy } from "./contracts.ts";

export interface ResolvedHandoffPolicy {
  mode: RunMode;
  approvalPolicy: "manual" | "auto";
}

export function resolveHandoffPolicy(
  sourceRunId: string,
  policy: WorkflowHandoffPolicy | undefined,
  runService: RunService,
  approvalService: ApprovalService
): ResolvedHandoffPolicy {
  const sourceRun = runService.getRun(sourceRunId);
  const sourceApprovalPolicy = approvalService.getRunApprovalPolicy(sourceRunId);
  const mode = policy?.mode ?? "interactive";
  const approvalPolicy = policy?.inheritAutoApproval === true && sourceApprovalPolicy === "auto" ? "auto" : "manual";

  return {
    mode,
    approvalPolicy: sourceRun.mode === "auto" && policy?.inheritAutoApproval !== true ? "manual" : approvalPolicy
  };
}

export function applyHandoffPolicy(
  runId: string,
  policy: ResolvedHandoffPolicy,
  approvalService: ApprovalService,
  sourceApprovalId = "handoff.explicit.policy"
): void {
  if (policy.approvalPolicy !== "auto") {
    return;
  }
  approvalService.applyRunApprovalPolicy(runId, "auto", sourceApprovalId);
}
