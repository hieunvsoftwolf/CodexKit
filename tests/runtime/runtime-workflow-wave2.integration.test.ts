import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  RuntimeController,
  runCookWorkflow,
  runPlanArchiveWorkflow,
  runPlanRedTeamWorkflow,
  runPlanValidateWorkflow,
  runPlanWorkflow
} from "../../packages/codexkit-daemon/src/index.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function extractH2Section(markdown: string, heading: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const headingLine = `## ${heading}`;
  const headingIndex = lines.findIndex((line) => line.trim() === headingLine);
  if (headingIndex === -1) {
    return "";
  }
  let sectionEnd = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith("## ")) {
      sectionEnd = index;
      break;
    }
  }
  return lines.slice(headingIndex + 1, sectionEnd).join("\n");
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 5 wave 2 workflow runtime", () => {
  test("blocked validate/red-team keep archived plans immutable", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-wave2-plan-subcommands");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Wave 2 subcommand contract", mode: "hard" });
    const validate = runPlanValidateWorkflow(context, { planPath: plan.planPath });
    expect(validate.status).toBe("valid");
    expect(validate.handoffCommand).toBe(`cdx cook --auto ${shellQuote(plan.planPath)}`);
    const afterValidate = readFileSync(plan.planPath, "utf8");
    expect(afterValidate).toContain("## Validation Log");
    expect(readFileSync(plan.phasePaths[0]!, "utf8")).toContain("## Validation Notes");

    const redTeam = runPlanRedTeamWorkflow(context, { planPath: plan.planPath });
    expect(redTeam.status).toBe("revise");
    expect(redTeam.recommendedNextCommand).toBe(`cdx plan validate ${shellQuote(plan.planPath)}`);
    const afterRedTeam = readFileSync(plan.planPath, "utf8");
    expect(afterRedTeam).toContain("## Red Team Review");
    expect(readFileSync(plan.phasePaths[0]!, "utf8")).toContain("## Red Team Notes");

    const archive = runPlanArchiveWorkflow(context, { planPath: plan.planPath });
    expect(archive.status).toBe("valid");
    expect(typeof archive.archiveSummaryPath).toBe("string");
    expect(existsSync(String(archive.archiveSummaryPath))).toBe(true);
    const afterArchive = readFileSync(plan.planPath, "utf8");
    const phaseAfterArchive = readFileSync(plan.phasePaths[0]!, "utf8");
    expect(afterArchive).toContain('status: "archived"');

    const blockedValidate = runPlanValidateWorkflow(context, { planPath: plan.planPath });
    expect(blockedValidate.status).toBe("blocked");
    expect(blockedValidate.diagnostics.some((entry) => entry.code === "PLAN_VALIDATE_BLOCKED_ARCHIVED")).toBe(true);
    expect(typeof blockedValidate.failureDiagnosticPath).toBe("string");
    expect(typeof blockedValidate.failureDiagnosticArtifactId).toBe("string");
    expect(existsSync(String(blockedValidate.failureDiagnosticPath))).toBe(true);
    const blockedValidateDiagnostic = readFileSync(String(blockedValidate.failureDiagnosticPath), "utf8");
    expect(blockedValidateDiagnostic).toContain("Diagnostic Code: PLAN_VALIDATE_BLOCKED_ARCHIVED");
    const blockedValidateArtifacts = context.artifactService.listArtifacts({ runId: blockedValidate.runId });
    expect(blockedValidateArtifacts.some((artifact) => artifact.id === blockedValidate.failureDiagnosticArtifactId)).toBe(true);
    expect(blockedValidateArtifacts.some((artifact) => artifact.path === blockedValidate.failureDiagnosticPath)).toBe(true);
    const blockedRedTeam = runPlanRedTeamWorkflow(context, { planPath: plan.planPath });
    expect(blockedRedTeam.status).toBe("blocked");
    expect(blockedRedTeam.diagnostics.some((entry) => entry.code === "PLAN_RED_TEAM_BLOCKED_ARCHIVED")).toBe(true);
    expect(typeof blockedRedTeam.failureDiagnosticPath).toBe("string");
    expect(typeof blockedRedTeam.failureDiagnosticArtifactId).toBe("string");
    expect(existsSync(String(blockedRedTeam.failureDiagnosticPath))).toBe(true);
    const blockedRedTeamDiagnostic = readFileSync(String(blockedRedTeam.failureDiagnosticPath), "utf8");
    expect(blockedRedTeamDiagnostic).toContain("Diagnostic Code: PLAN_RED_TEAM_BLOCKED_ARCHIVED");
    const blockedRedTeamArtifacts = context.artifactService.listArtifacts({ runId: blockedRedTeam.runId });
    expect(blockedRedTeamArtifacts.some((artifact) => artifact.id === blockedRedTeam.failureDiagnosticArtifactId)).toBe(true);
    expect(blockedRedTeamArtifacts.some((artifact) => artifact.path === blockedRedTeam.failureDiagnosticPath)).toBe(true);

    const afterBlockedPlan = readFileSync(plan.planPath, "utf8");
    const afterBlockedPhase = readFileSync(plan.phasePaths[0]!, "utf8");
    expect(afterBlockedPlan).toBe(afterArchive);
    expect(afterBlockedPhase).toBe(phaseAfterArchive);
  });

  test("repeated validate/red-team runs append durable inline history", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-wave2-plan-history");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Wave 2 durable history", mode: "hard" });
    runPlanValidateWorkflow(context, { planPath: plan.planPath });
    runPlanValidateWorkflow(context, { planPath: plan.planPath });
    runPlanRedTeamWorkflow(context, { planPath: plan.planPath });
    runPlanRedTeamWorkflow(context, { planPath: plan.planPath });

    const planMarkdown = readFileSync(plan.planPath, "utf8");
    const validationLog = extractH2Section(planMarkdown, "Validation Log");
    const redTeamLog = extractH2Section(planMarkdown, "Red Team Review");
    expect((validationLog.match(/- Timestamp:/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((redTeamLog.match(/- Timestamp:/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const firstPhase = readFileSync(plan.phasePaths[0]!, "utf8");
    const validationNotes = extractH2Section(firstPhase, "Validation Notes");
    const redTeamNotes = extractH2Section(firstPhase, "Red Team Notes");
    expect((validationNotes.match(/Confirm execution owners/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((redTeamNotes.match(/failure-containment checks/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("cook auto mode reaches post-implementation and publishes required summaries", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-wave2-cook-auto");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Wave 2 cook auto mode", mode: "hard" });
    const cook = runCookWorkflow(context, { planPath: plan.planPath, mode: "auto" });
    expect(cook.mode).toBe("auto");
    expect(cook.completedThroughPostImplementation).toBe(true);
    expect(cook.checkpointIds).toEqual(["cook-mode", "post-research", "post-plan", "implementation", "post-implementation"]);
    expect(cook.pendingApproval).toBeUndefined();
    expect(cook.researchSummaryPath && existsSync(cook.researchSummaryPath)).toBe(true);
    expect(cook.planSummaryPath && existsSync(cook.planSummaryPath)).toBe(true);
    expect(cook.implementationSummaryPath && existsSync(cook.implementationSummaryPath)).toBe(true);
  });

  test("cook parallel mode pauses at post-research and code mode preserves reuse/hydration behavior", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-wave2-cook-gates");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const plan = runPlanWorkflow(context, { task: "Wave 2 gate matrix", mode: "hard" });
    const parallelCook = runCookWorkflow(context, { planPath: plan.planPath, mode: "parallel" });
    expect(parallelCook.completedThroughPostImplementation).toBe(false);
    expect(parallelCook.checkpointIds).toEqual(["cook-mode"]);
    expect(parallelCook.pendingApproval?.checkpoint).toBe("post-research");
    expect(parallelCook.researchSummaryPath && existsSync(parallelCook.researchSummaryPath)).toBe(true);

    const phaseTaskIds = [...plan.hydration.createdTaskIds];
    expect(phaseTaskIds.length).toBeGreaterThanOrEqual(3);
    for (const phaseTaskId of phaseTaskIds.slice(1)) {
      context.taskService.updateTask(phaseTaskId, { status: "completed" });
    }
    const codeCook = runCookWorkflow(context, { planPath: plan.planPath });
    expect(codeCook.mode).toBe("code");
    expect(codeCook.reusedTaskIds).toEqual([phaseTaskIds[0]]);
    expect(codeCook.hydration?.hydrationRan).toBe(true);
    expect(codeCook.pendingApproval?.checkpoint).toBe("post-implementation");
  });

  test("non-auto cook approval responses resume workflow progression and checkpoint advancement", async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-wave2-cook-approval-resume");
    cleanups.push(() => fixture.cleanup());
    const controller = new RuntimeController(fixture.rootDir);
    cleanups.push(() => controller.close());

    const plan = controller.plan({ task: "Wave 2 approval resume", mode: "hard" }) as { planPath: string };
    const cook = controller.cook({ planPath: plan.planPath, mode: "parallel" }) as {
      runId: string;
      pendingApproval?: { approvalId: string; checkpoint: string };
    };
    expect(cook.pendingApproval?.checkpoint).toBe("post-research");

    const afterResearch = controller.respondApproval({
      approvalId: String(cook.pendingApproval?.approvalId),
      status: "approved"
    }) as { continuation?: { pendingApproval?: { approvalId: string; checkpoint: string }; checkpointIds: string[] } };
    expect(afterResearch.continuation?.checkpointIds).toContain("post-research");
    expect(afterResearch.continuation?.pendingApproval?.checkpoint).toBe("post-plan");

    const runAfterResearch = controller.showRun(cook.runId) as { run: { metadata: { workflow?: { currentCheckpoint?: string } } } };
    expect(runAfterResearch.run.metadata.workflow?.currentCheckpoint).toBe("post-research");

    const afterPlan = controller.respondApproval({
      approvalId: String(afterResearch.continuation?.pendingApproval?.approvalId),
      status: "approved"
    }) as { continuation?: { pendingApproval?: { approvalId: string; checkpoint: string }; checkpointIds: string[] } };
    expect(afterPlan.continuation?.checkpointIds).toContain("post-plan");
    expect(afterPlan.continuation?.pendingApproval?.checkpoint).toBe("post-implementation");

    const afterImplementation = controller.respondApproval({
      approvalId: String(afterPlan.continuation?.pendingApproval?.approvalId),
      status: "approved"
    }) as { continuation?: { completedThroughPostImplementation?: boolean; checkpointIds: string[] } };
    expect(afterImplementation.continuation?.checkpointIds).toContain("post-implementation");
    expect(afterImplementation.continuation?.completedThroughPostImplementation).toBe(true);

    const runAfterImplementation = controller.showRun(cook.runId) as { run: { metadata: { workflow?: { currentCheckpoint?: string } } } };
    expect(runAfterImplementation.run.metadata.workflow?.currentCheckpoint).toBe("post-implementation");
  });
});
