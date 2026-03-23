import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  resolveHandoffPolicy,
  runBrainstormWorkflow,
  runCookWorkflow,
  runPlanWorkflow,
  hydratePlanTasks
} from "../../packages/codexkit-daemon/src/index.ts";
import { runApprovalPolicySettingKey } from "../../packages/codexkit-core/src/index.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 5 wave 1 workflow runtime", () => {
  test("handoff policy keeps approval inheritance explicit-only", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-policy");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const sourceRun = context.runService.createRun({ workflow: "brainstorm", mode: "auto" });
    context.approvalService.applyRunApprovalPolicy(sourceRun.id, "auto", "test.auto.policy");

    const defaultHandoff = resolveHandoffPolicy(sourceRun.id, undefined, context.runService, context.approvalService);
    const explicitHandoff = resolveHandoffPolicy(
      sourceRun.id,
      { mode: "interactive", inheritAutoApproval: true },
      context.runService,
      context.approvalService
    );

    expect(defaultHandoff.approvalPolicy).toBe("manual");
    expect(explicitHandoff.approvalPolicy).toBe("auto");
    expect(context.store.settings.get(runApprovalPolicySettingKey(sourceRun.id))).toBe("auto");
  });

  test("plan workflow creates plan artifacts, exact checkpoints, and isolates suggested hint", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-plan");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const first = runPlanWorkflow(context, { task: "Implement onboarding flow", mode: "hard" });
    const second = runPlanWorkflow(context, { task: "Implement billing flow", mode: "parallel" });
    expect(first.checkpointIds).toEqual(["plan-context", "plan-draft", "plan-hydration"]);
    expect(existsSync(first.planPath)).toBe(true);
    expect(first.phasePaths).toHaveLength(3);
    const planText = readFileSync(first.planPath, "utf8");
    expect(planText).toContain("title:");
    expect(planText).toContain("description:");
    expect(planText).toContain("status:");
    expect(planText).toContain('status: "pending"');
    expect(planText).toContain("priority:");
    expect(planText).toContain("effort:");
    expect(planText).toContain("branch:");
    expect(planText).toContain("created:");
    for (const phasePath of first.phasePaths) {
      const phaseText = readFileSync(phasePath, "utf8");
      expect(phaseText).toContain("## Overview");
      expect(phaseText).toContain("## Requirements");
      expect(phaseText).toContain("## Related Code Files");
      expect(phaseText).toContain("## Implementation Steps");
      expect(phaseText).toContain("## Todo Checklist");
      expect(phaseText).toContain("## Success Criteria");
      expect(phaseText).toContain("## Risk Notes");
    }
    expect(first.hydration.hydrationRan).toBe(true);
    expect(first.hydration.createdTaskIds.length).toBeGreaterThanOrEqual(3);

    const secondRun = context.runService.getRun(second.runId);
    const workflowState = (secondRun.metadata.workflow ?? {}) as {
      suggestedPlanPath?: string;
      activePlanPath?: string;
    };
    if (workflowState.suggestedPlanPath) {
      expect(second.planPath).not.toBe(workflowState.suggestedPlanPath);
    }
    expect(context.store.settings.get("workflow.plan.active.path")).toBe(second.planPath);
  });

  test("brainstorm publishes required decision-report shape and explicit-only handoff metadata", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-brainstorm");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const brainstorm = runBrainstormWorkflow(context, {
      topic: "Define wave 2 parity boundaries",
      constraints: ["Keep Wave 1 deferred behavior explicit"],
      mode: "auto",
      handoffToPlan: true,
      handoffTask: "Plan wave 2 parity boundaries"
    });

    expect(brainstorm.checkpointIds).toEqual(["brainstorm-discovery", "brainstorm-decision", "brainstorm-handoff"]);
    expect(existsSync(brainstorm.decisionReportPath)).toBe(true);
    const report = readFileSync(brainstorm.decisionReportPath, "utf8");
    expect(report).toContain("## Problem Statement and Constraints");
    expect(report).toContain("## Evaluated Approaches");
    expect(report).toContain("## Chosen Recommendation");
    expect(report).toContain("## Implementation Considerations and Risks");
    expect(report).toContain("## Success Criteria");
    expect(report).toContain("## Next Step Recommendation");

    const handoff = brainstorm.handoff;
    expect(handoff).toBeDefined();
    const downstreamRunId = handoff?.toRunId;
    expect(typeof downstreamRunId).toBe("string");
    const handoffApprovals = context.approvalService.listApprovals({ runId: brainstorm.runId });
    const handoffApproval = handoffApprovals.find((approval) => approval.checkpoint === "brainstorm-handoff");
    expect(handoffApproval).toBeDefined();
    expect(handoffApproval?.status).toBe("approved");
    expect(handoffApproval?.responseCode).toBe("continue");
    if (!downstreamRunId) {
      return;
    }
    const downstreamRun = context.runService.getRun(downstreamRunId);
    const handoffMetadata = (downstreamRun.metadata.handoff ?? {}) as {
      explicitPolicyOnly?: boolean;
      decisionArtifactId?: string;
      handoffApprovalId?: string;
      bundle?: {
        goal: string;
        constraints: string[];
        acceptedDecisions: string[];
        evidenceRefs: string[];
        unresolvedQuestionsOrBlockers: string[];
        nextAction: string;
      };
    };
    expect(handoffMetadata.explicitPolicyOnly).toBe(true);
    expect(handoffMetadata.decisionArtifactId).toBe(brainstorm.decisionArtifactId);
    expect(handoffMetadata.handoffApprovalId).toBe(handoffApproval?.id);
    expect(handoffMetadata.bundle?.goal).toBe("Plan wave 2 parity boundaries");
    expect(handoffMetadata.bundle?.constraints).toEqual(["Keep Wave 1 deferred behavior explicit"]);
    expect(handoffMetadata.bundle?.acceptedDecisions.length).toBeGreaterThan(0);
    expect(handoffMetadata.bundle?.evidenceRefs).toContain(brainstorm.decisionArtifactId);
    expect(handoffMetadata.bundle?.evidenceRefs.some((ref) => ref === `approval:${handoffApproval?.id}`)).toBe(true);
    expect(handoffMetadata.bundle?.unresolvedQuestionsOrBlockers).toEqual(["None"]);
    expect(handoffMetadata.bundle?.nextAction).toContain(downstreamRunId);
    expect(context.approvalService.getRunApprovalPolicy(downstreamRunId)).toBe("manual");
  });

  test("hydration engine dedupes tasks and skips checked checklist items", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-hydration");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Hydration dedupe test", mode: "hard" });
    const secondPass = hydratePlanTasks(context, { runId: plan.runId, planPath: plan.planPath });
    expect(secondPass.createdTaskIds).toHaveLength(0);
    expect(secondPass.reusedTaskIds.length).toBeGreaterThanOrEqual(3);

    const firstPhasePath = plan.phasePaths[0]!;
    const updated = readFileSync(firstPhasePath, "utf8").replace("- [ ] Collect baseline context [critical]", "- [x] Collect baseline context [critical]");
    writeFileSync(firstPhasePath, updated, "utf8");
    const runB = context.runService.createRun({ workflow: "plan" });
    const checkedResult = hydratePlanTasks(context, { runId: runB.id, planPath: plan.planPath });
    expect(checkedResult.createdChildTaskIds.length).toBeLessThan(plan.hydration.createdChildTaskIds.length);
  });

  test("cook code mode reuses existing plan tasks and reaches implementation with post-implementation gate pending", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-cook");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Cook pickup test", mode: "hard" });
    const cook = runCookWorkflow(context, { planPath: plan.planPath });
    expect(cook.mode).toBe("code");
    expect(cook.checkpointIds).toEqual(["cook-mode", "implementation"]);
    expect(cook.completedThroughPostImplementation).toBe(false);
    expect(cook.pendingApproval?.checkpoint).toBe("post-implementation");
    expect(cook.diagnostics.some((entry) => entry.code === "COOK_IMPLEMENTATION_READY")).toBe(true);
    expect(cook.reusedTaskIds.length).toBeGreaterThanOrEqual(3);
    expect(cook.hydration).toBeUndefined();
  });

  test("cook code mode triggers hydration when reusable phase-task set is incomplete", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-cook-partial-reuse");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Cook partial reuse recovery", mode: "hard" });
    const phaseTaskIds = [...plan.hydration.createdTaskIds];
    expect(phaseTaskIds.length).toBeGreaterThanOrEqual(3);
    for (const phaseTaskId of phaseTaskIds.slice(1)) {
      context.taskService.updateTask(phaseTaskId, { status: "completed" });
    }

    const cook = runCookWorkflow(context, { planPath: plan.planPath });
    expect(cook.reusedTaskIds).toEqual([phaseTaskIds[0]]);
    expect(cook.reusedTaskIds.some((taskId) => plan.hydration.createdChildTaskIds.includes(taskId))).toBe(false);
    expect(cook.hydration).toBeDefined();
    expect(cook.hydration?.hydrationRan).toBe(true);
    expect(cook.hydration?.createdTaskIds.length).toBeGreaterThanOrEqual(3);
    expect(cook.pendingApproval?.checkpoint).toBe("post-implementation");
  });
});
