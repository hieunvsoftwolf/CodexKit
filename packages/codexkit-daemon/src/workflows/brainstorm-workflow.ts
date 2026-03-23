import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RunMode } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resolveReportPath } from "./artifact-paths.ts";
import type { WorkflowBaseResult, WorkflowHandoffBundle, WorkflowHandoffPolicy, WorkflowHandoffRecord } from "./contracts.ts";
import { applyHandoffPolicy, resolveHandoffPolicy } from "./handoff-policy.ts";

function renderDecisionReport(input: { topic: string; constraints: string[]; mode: RunMode }): string {
  const constraints = input.constraints.length > 0 ? input.constraints : ["No explicit constraints provided"];
  return [
    "# Decision Report",
    "",
    "## Problem Statement and Constraints",
    `- Topic: ${input.topic}`,
    ...constraints.map((constraint) => `- ${constraint}`),
    "",
    "## Evaluated Approaches",
    "- Conservative path: ship minimal workflow contract scaffolding first",
    "- Balanced path: deliver contract + vertical path in one wave",
    "- Aggressive path: implement all follow-up subcommands now (deferred)",
    "",
    "## Chosen Recommendation",
    "- Balanced path",
    "- Rationale: delivers runnable parity surface without overreaching deferred slices",
    "",
    "## Implementation Considerations and Risks",
    "- Keep checkpoint ids exact to avoid resume drift",
    "- Keep handoff approval inheritance explicit-only",
    "- Keep suggested plans isolated from active plan pointers",
    "",
    "## Success Criteria",
    "- Decision report is durable and linked to the run",
    "- Optional handoff is explicit and traceable",
    "",
    "## Next Step Recommendation",
    input.mode === "auto" ? "- Continue directly with cdx plan" : "- Review then continue with cdx plan as needed",
    ""
  ].join("\n");
}

export interface BrainstormWorkflowInput {
  topic: string;
  constraints?: string[];
  mode?: RunMode;
  handoffToPlan?: boolean;
  handoffTask?: string;
  handoffPolicy?: WorkflowHandoffPolicy;
}

export interface BrainstormWorkflowResult extends WorkflowBaseResult {
  workflow: "brainstorm";
  decisionReportPath: string;
  decisionArtifactId: string;
  handoff?: WorkflowHandoffRecord;
}

function buildHandoffBundle(input: {
  topic: string;
  handoffTask: string;
  constraints: string[];
  decisionArtifactId: string;
  decisionReportPath: string;
  handoffApprovalId: string;
  downstreamRunId: string;
}): WorkflowHandoffBundle {
  return {
    goal: input.handoffTask,
    constraints: input.constraints.length > 0 ? input.constraints : ["No explicit constraints provided"],
    acceptedDecisions: [
      `Use balanced implementation path for '${input.topic}'`,
      "Keep checkpoint ids stable and handoff policy explicit-only"
    ],
    evidenceRefs: [input.decisionArtifactId, path.resolve(input.decisionReportPath), `approval:${input.handoffApprovalId}`],
    unresolvedQuestionsOrBlockers: ["None"],
    nextAction: `Continue with plan run ${input.downstreamRunId}`
  };
}

export function runBrainstormWorkflow(context: RuntimeContext, input: BrainstormWorkflowInput): BrainstormWorkflowResult {
  const run = context.runService.createRun({
    workflow: "brainstorm",
    mode: input.mode ?? "interactive",
    prompt: input.topic
  });
  context.runService.recordWorkflowCheckpoint(run.id, "brainstorm-discovery", { noFile: true });

  const reportPath = resolveReportPath(context, run, "decision-report.md");
  mkdirSync(path.dirname(reportPath.absolutePath), { recursive: true });
  const decisionReport = renderDecisionReport({
    topic: input.topic,
    constraints: input.constraints ?? [],
    mode: run.mode
  });
  writeFileSync(reportPath.absolutePath, decisionReport, "utf8");
  const decisionArtifact = context.artifactService.publishArtifact({
    runId: run.id,
    artifactKind: "report",
    path: reportPath.absolutePath,
    summary: "brainstorm decision report",
    metadata: { checkpoint: "brainstorm-decision", scope: reportPath.scope }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "brainstorm-decision", {
    artifactPath: decisionArtifact.path,
    artifactId: decisionArtifact.id
  });

  const handoffApproval = context.approvalService.requestApproval({
    runId: run.id,
    checkpoint: "brainstorm-handoff",
    question: "Continue to cdx plan with this brainstorm decision?",
    options: [
      { code: "continue", label: "Continue to plan" },
      { code: "abort", label: "Stop here" }
    ]
  });

  let handoff: WorkflowHandoffRecord | undefined;
  if (input.handoffToPlan) {
    context.approvalService.respondApproval(handoffApproval.id, "approved", "Continue to plan", { responseCode: "continue" });
    const policy = resolveHandoffPolicy(run.id, input.handoffPolicy, context.runService, context.approvalService);
    const downstream = context.runService.createRun({
      workflow: "plan",
      mode: policy.mode,
      parentRunId: run.id,
      prompt: input.handoffTask ?? input.topic,
      metadata: {
        handoff: {
          fromRunId: run.id,
          decisionArtifactId: decisionArtifact.id,
          handoffApprovalId: handoffApproval.id,
          explicitPolicyOnly: true
        }
      }
    });
    const bundle = buildHandoffBundle({
      topic: input.topic,
      handoffTask: input.handoffTask ?? input.topic,
      constraints: input.constraints ?? [],
      decisionArtifactId: decisionArtifact.id,
      decisionReportPath: reportPath.absolutePath,
      handoffApprovalId: handoffApproval.id,
      downstreamRunId: downstream.id
    });
    context.runService.updateRunMetadata(downstream.id, {
      handoff: {
        fromRunId: run.id,
        decisionArtifactId: decisionArtifact.id,
        handoffApprovalId: handoffApproval.id,
        explicitPolicyOnly: true,
        bundle
      }
    });
    applyHandoffPolicy(downstream.id, policy, context.approvalService, "brainstorm.handoff.explicit");
    handoff = {
      fromRunId: run.id,
      toRunId: downstream.id,
      workflow: "plan",
      policy: {
        mode: policy.mode,
        approvalPolicy: policy.approvalPolicy,
        explicitOnly: true
      },
      artifactIds: [decisionArtifact.id],
      bundle
    };
    context.runService.recordWorkflowCheckpoint(run.id, "brainstorm-handoff", { response: "approved", noFile: true });
  } else {
    context.approvalService.respondApproval(handoffApproval.id, "aborted", "Stop after brainstorm", { responseCode: "abort" });
    context.runService.recordWorkflowCheckpoint(run.id, "brainstorm-handoff", { response: "aborted", noFile: true });
  }

  return {
    runId: run.id,
    workflow: "brainstorm",
    checkpointIds: ["brainstorm-discovery", "brainstorm-decision", "brainstorm-handoff"],
    decisionReportPath: reportPath.absolutePath,
    decisionArtifactId: decisionArtifact.id,
    ...(handoff ? { handoff } : {})
  };
}
