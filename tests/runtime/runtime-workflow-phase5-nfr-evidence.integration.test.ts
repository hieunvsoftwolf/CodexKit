import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  runBrainstormWorkflow,
  runCookWorkflow,
  runPlanArchiveWorkflow,
  runPlanRedTeamWorkflow,
  runPlanValidateWorkflow,
  runPlanWorkflow
} from "../../packages/codexkit-daemon/src/index.ts";
import { parseCliFailure } from "./helpers/cli-json.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliFailure(rootDir: string, args: string[]) {
  try {
    runCli(rootDir, args);
    throw new Error("expected command failure");
  } catch (error) {
    return parseCliFailure(error);
  }
}

function countLivePhaseTasksForPlan(context: ReturnType<typeof openRuntimeContext>, planPath: string): number {
  const planDir = path.dirname(planPath);
  return context.store.tasks
    .list()
    .filter(
      (task) => task.planDir === planDir
        && task.parentTaskId === null
        && typeof task.phaseFile === "string"
        && task.phaseFile.trim().length > 0
        && task.status !== "completed"
        && task.status !== "failed"
        && task.status !== "cancelled"
    )
    .length;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 5 workflow-level NFR evidence harness", () => {
  test(
    "produces executable evidence bundle for phase-5-owned workflow NFR contracts",
    { timeout: 30_000 },
    async () => {
    const fixture = await createRuntimeFixture("codexkit-phase5-nfr-evidence");
    cleanups.push(() => fixture.cleanup());
    runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const brainstorm = runBrainstormWorkflow(context, {
      topic: "Wave 2 NFR harness",
      handoffToPlan: true,
      handoffTask: "Plan Wave 2 NFR harness"
    });
    const handoff = brainstorm.handoff!;
    const bundle = handoff.bundle!;
    const nfr12Pass = handoff.policy.approvalPolicy === "manual" && context.approvalService.getRunApprovalPolicy(handoff.toRunId) === "manual";
    const nfr61Pass = Boolean(
      bundle.goal
      && bundle.constraints.length > 0
      && bundle.acceptedDecisions.length > 0
      && bundle.evidenceRefs.length > 0
      && bundle.unresolvedQuestionsOrBlockers.length > 0
      && bundle.nextAction
    );

    const plan = runPlanWorkflow(context, { task: "NFR fixture planning path", mode: "hard" });
    const validate = runPlanValidateWorkflow(context, { planPath: plan.planPath });
    const nfr15Pass = path.isAbsolute(plan.planPath) && String(plan.handoffCommand).includes(plan.planPath);
    const baselineLivePhaseTasks = countLivePhaseTasksForPlan(context, plan.planPath);
    const reentryCookA = runCookWorkflow(context, { planPath: plan.planPath });
    const livePhaseTasksAfterA = countLivePhaseTasksForPlan(context, plan.planPath);
    const reentryCookB = runCookWorkflow(context, { planPath: plan.planPath });
    const livePhaseTasksAfterB = countLivePhaseTasksForPlan(context, plan.planPath);
    const nfr13Pass = baselineLivePhaseTasks > 0
      && reentryCookA.mode === "code"
      && reentryCookB.mode === "code"
      && reentryCookA.hydration === undefined
      && reentryCookB.hydration === undefined
      && livePhaseTasksAfterA === baselineLivePhaseTasks
      && livePhaseTasksAfterB === baselineLivePhaseTasks;

    const cookAuto = runCookWorkflow(context, { planPath: plan.planPath, mode: "auto" });
    const archive = runPlanArchiveWorkflow(context, { planPath: plan.planPath });
    const blockedValidate = runPlanValidateWorkflow(context, { planPath: plan.planPath });
    const blockedValidateArtifacts = context.artifactService.listArtifacts({ runId: blockedValidate.runId });
    const blockedValidateFailureArtifact = blockedValidateArtifacts.find(
      (artifact) => artifact.id === blockedValidate.failureDiagnosticArtifactId
    );
    const blockedValidateFailurePath = blockedValidate.failureDiagnosticPath ?? "";
    const blockedValidateFailureMarkdown = blockedValidateFailurePath
      ? readFileSync(blockedValidateFailurePath, "utf8")
      : "";
    const blockedRedTeam = runPlanRedTeamWorkflow(context, { planPath: plan.planPath });
    const blockedRedTeamArtifacts = context.artifactService.listArtifacts({ runId: blockedRedTeam.runId });
    const blockedRedTeamFailureArtifact = blockedRedTeamArtifacts.find(
      (artifact) => artifact.id === blockedRedTeam.failureDiagnosticArtifactId
    );
    const blockedRedTeamFailurePath = blockedRedTeam.failureDiagnosticPath ?? "";
    const blockedRedTeamFailureMarkdown = blockedRedTeamFailurePath
      ? readFileSync(blockedRedTeamFailurePath, "utf8")
      : "";
    const nfr52Pass = Boolean(
      cookAuto.completedThroughPostImplementation
      && cookAuto.implementationSummaryPath
      && existsSync(cookAuto.implementationSummaryPath)
      && archive.status === "valid"
      && blockedValidate.status === "blocked"
      && blockedValidate.diagnostics.some((entry) => entry.code === "PLAN_VALIDATE_BLOCKED_ARCHIVED")
      && blockedValidateFailurePath.length > 0
      && existsSync(blockedValidateFailurePath)
      && blockedValidateFailureArtifact?.artifactKind === "report"
      && blockedValidateFailureMarkdown.includes("Diagnostic Code: PLAN_VALIDATE_BLOCKED_ARCHIVED")
      && blockedRedTeam.status === "blocked"
      && blockedRedTeam.diagnostics.some((entry) => entry.code === "PLAN_RED_TEAM_BLOCKED_ARCHIVED")
      && blockedRedTeamFailurePath.length > 0
      && existsSync(blockedRedTeamFailurePath)
      && blockedRedTeamFailureArtifact?.artifactKind === "report"
      && blockedRedTeamFailureMarkdown.includes("Diagnostic Code: PLAN_RED_TEAM_BLOCKED_ARCHIVED")
    );

    const fastPlan = runCli(fixture.rootDir, ["plan", "NFR", "prompt", "economy", "--fast"]);
    const fastRun = runCli(fixture.rootDir, ["run", "show", String(fastPlan.runId)]) as { approvals?: unknown[] };
    const validateViaCli = runCli(fixture.rootDir, ["plan", "validate", String(fastPlan.planPath)]);
    const nfr32Pass = fastPlan.workflow === "plan"
      && fastPlan.mode === "fast"
      && Array.isArray(fastRun.approvals)
      && fastRun.approvals.length === 0
      && validateViaCli.subcommand === "validate";
    const diagnosticFailure = runCliFailure(fixture.rootDir, ["plan", "validate"]);
    const details = (diagnosticFailure.details ?? null) as
      | { code?: string; cause?: string; nextStep?: string }
      | null;
    const nfr33Pass = diagnosticFailure.code === "CLI_USAGE"
      && typeof details?.code === "string"
      && typeof details?.cause === "string"
      && typeof details?.nextStep === "string";

    const metrics = {
      "NFR-1.2": {
        pass: nfr12Pass,
        evidence: ["brainstorm->plan handoff policy remains manual unless explicit inherit is requested"]
      },
      "NFR-1.3": {
        pass: nfr13Pass,
        evidence: ["two explicit cdx cook <plan-path> re-entry runs reused existing live phase tasks without triggering hydration or increasing live phase-task count"]
      },
      "NFR-1.5": {
        pass: nfr15Pass && String(validate.handoffCommand).includes("--auto"),
        evidence: ["plan and validate outputs include absolute continuation command with explicit mode"]
      },
      "NFR-3.2": {
        pass: nfr32Pass,
        evidence: ["unambiguous cdx plan --fast and cdx plan validate <plan-path> command shapes executed directly without operation/mode prompts or injected approval gates"]
      },
      "NFR-3.3": {
        pass: nfr33Pass,
        evidence: ["blocking CLI usage error returned typed diagnostic details (code/cause/nextStep)"]
      },
      "NFR-5.2": {
        pass: nfr52Pass,
        evidence: ["terminal success run published implementation-summary.md and blocked archived-plan validate/red-team runs published durable typed failure diagnostic artifacts with codes PLAN_VALIDATE_BLOCKED_ARCHIVED and PLAN_RED_TEAM_BLOCKED_ARCHIVED"]
      },
      "NFR-6.1": {
        pass: nfr61Pass,
        evidence: ["handoff bundle contains goal/constraints/decisions/evidenceRefs/unresolved/nextAction"]
      }
    } as const;

    for (const metric of Object.values(metrics)) {
      expect(metric.pass).toBe(true);
    }

    const commitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
    const gitVersion = execFileSync("git", ["--version"], { cwd: process.cwd(), encoding: "utf8" }).trim();
    const evidenceBundle = {
      generatedAt: new Date().toISOString(),
      commitSha,
      fixtureIds: ["fresh-session-handoff", "git-clean", "active-plan-existing-live-tasks"],
      suite: "tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts",
      hostManifest: {
        os: `${os.platform()} ${os.release()}`,
        cpu: os.cpus()[0]?.model ?? "unknown",
        ramBytes: os.totalmem(),
        filesystem: "unknown",
        nodeVersion: process.version,
        gitVersion,
        codexCliVersion: process.env.CODEX_CLI_VERSION ?? "unknown"
      },
      results: metrics
    };

    mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
    writeFileSync(
      path.join(process.cwd(), ".tmp", "phase-5-wave2-nfr-evidence.json"),
      `${JSON.stringify(evidenceBundle, null, 2)}\n`,
      "utf8"
    );
    }
  );
});
