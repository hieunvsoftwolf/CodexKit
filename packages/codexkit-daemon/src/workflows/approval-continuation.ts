import type { ApprovalRecord } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resumeCookWorkflowFromApproval, type CookWorkflowResult } from "./cook-workflow.ts";
import { resumeDebugWorkflowFromApproval, type DebugWorkflowResult } from "./debug-workflow.ts";
import { resumeFixWorkflowFromApproval, type FixWorkflowResult } from "./fix-workflow.ts";
import { resumeReviewWorkflowFromApproval, type ReviewWorkflowResult } from "./review-workflow.ts";
import { resumeTestWorkflowFromApproval, type TestWorkflowResult } from "./test-workflow.ts";

export type WorkflowContinuationResult = CookWorkflowResult | ReviewWorkflowResult | TestWorkflowResult | DebugWorkflowResult | FixWorkflowResult;

export function resumeWorkflowFromApproval(
  context: RuntimeContext,
  approval: ApprovalRecord
): WorkflowContinuationResult | null {
  const run = context.runService.getRun(approval.runId);
  if (run.workflow === "cook") {
    return resumeCookWorkflowFromApproval(context, approval);
  }
  if (run.workflow === "review") {
    return resumeReviewWorkflowFromApproval(context, approval);
  }
  if (run.workflow === "test") {
    return resumeTestWorkflowFromApproval(context, approval);
  }
  if (run.workflow === "debug") {
    return resumeDebugWorkflowFromApproval(context, approval);
  }
  if (run.workflow === "fix") {
    return resumeFixWorkflowFromApproval(context, approval);
  }
  return null;
}
