import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ValidationArtifactRef, ValidationMetricResult } from "../../packages/codexkit-core/src/index.ts";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  runCookWorkflow,
  runFinalizeSyncBack,
  runPlanWorkflow,
  runResumeWorkflow,
  RuntimeController,
  WorkerRuntime
} from "../../packages/codexkit-daemon/src/index.ts";
import { runReconciliationPass } from "../../packages/codexkit-daemon/src/runtime-kernel.ts";
import { createDurableNoteArtifact, writePhase9EvidenceBundle } from "./helpers/phase9-evidence.ts";
import { createFakeClock, createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];
const RELIABILITY_WORK_ITEM_LABELS = [
  "work-item-1",
  "work-item-2",
  "work-item-3",
  "work-item-4",
  "work-item-5",
  "work-item-6",
  "work-item-7",
  "work-item-8",
  "work-item-9",
  "work-item-10"
] as const;
const RELIABILITY_PARALLEL_WORKER_COUNT = 2;
const RELIABILITY_LEASE_MS = 13;
const RELIABILITY_MAX_ATTEMPTS = 4;
const RELIABILITY_ATTEMPT_BACKOFF_MS = 3;

function command(script: string): string[] {
  return [process.execPath, "-e", script];
}

function metricArtifactRef(label: string, refPath: string): ValidationArtifactRef {
  return {
    label,
    path: refPath,
    durability: "durable"
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reliabilityAttemptWorkMs(input: { taskIndex: number; attempt: number; activeClaims: number }): number {
  const baseline = 11 + ((input.taskIndex + input.attempt + input.activeClaims) % 4);
  const recoveryBackoff = Math.max(0, input.attempt - 1) * RELIABILITY_ATTEMPT_BACKOFF_MS;
  return Math.max(6, baseline - recoveryBackoff);
}

async function executeReliabilityScenario(input: {
  context: ReturnType<typeof openRuntimeContext>;
  parallel: boolean;
  name: string;
}): Promise<{
  taskCount: number;
  workerCount: number;
  peakActiveClaims: number;
  completedTasks: number;
  failedOrRetried: number;
  retriedTasks: number;
  retryEvents: number;
  workloadShape: string[];
  elapsedMs: number;
}> {
  const run = input.context.runService.createRun({ workflow: "team", prompt: input.name });
  const tasks = RELIABILITY_WORK_ITEM_LABELS.map((label) =>
    input.context.taskService.createTask({
      runId: run.id,
      role: "developer",
      subject: `${input.name}-${label}`
    })
  );
  const workerCount = input.parallel ? RELIABILITY_PARALLEL_WORKER_COUNT : 1;
  const workers = Array.from({ length: workerCount }, (_, index) =>
    input.context.workerService.registerWorker({
      runId: run.id,
      role: "developer",
      displayName: `${input.name}-worker-${String(index + 1)}`
    })
  );
  const startedAt = Date.now();
  let peakActiveClaims = 0;
  let nextTaskIndex = 0;

  const executeWorkItem = async (index: number, workerId: string): Promise<void> => {
    const task = tasks[index]!;
    for (let attempt = 1; attempt <= RELIABILITY_MAX_ATTEMPTS; attempt += 1) {
      if (input.context.taskService.getTask(task.id).status === "completed") {
        return;
      }
      const claim = input.context.claimService.createClaim({
        taskId: task.id,
        workerId,
        leaseMs: RELIABILITY_LEASE_MS
      });
      const activeClaims = input.context.claimService.listClaims({ runId: run.id, status: "active" }).length;
      peakActiveClaims = Math.max(peakActiveClaims, activeClaims);
      await sleep(reliabilityAttemptWorkMs({ taskIndex: index, attempt, activeClaims }));
      runReconciliationPass(input.context);
      const claimStatus = input.context.claimService
        .listClaims({ taskId: task.id })
        .find((entry) => entry.id === claim.id)
        ?.status;
      if (claimStatus !== "active") {
        continue;
      }
      input.context.claimService.releaseClaim(claim.id, "released");
      input.context.taskService.updateTask(task.id, { status: "completed" });
      return;
    }
    if (input.context.taskService.getTask(task.id).status !== "completed") {
      input.context.taskService.updateTask(task.id, {
        status: "failed",
        appendNote: "reliability workload exhausted max attempts"
      });
    }
  };

  const runWorker = async (workerId: string): Promise<void> => {
    while (nextTaskIndex < tasks.length) {
      const assignedTaskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      await executeWorkItem(assignedTaskIndex, workerId);
    }
  };

  if (input.parallel) {
    await Promise.all(workers.map((worker) => runWorker(worker.id)));
  } else {
    await runWorker(workers[0]!.id);
  }
  runReconciliationPass(input.context);

  const taskSnapshots = tasks.map((task) => input.context.taskService.getTask(task.id));
  const failedTasks = taskSnapshots.filter((task) => task.status === "failed").length;
  const completedTasks = taskSnapshots.filter((task) => task.status === "completed").length;
  const retryClaims = input.context.claimService
    .listClaims({ runId: run.id })
    .filter((claim) => claim.status === "expired" || claim.status === "superseded").length;
  const retryEvents = retryClaims;
  const retriedTasks = new Set(
    input.context.claimService
      .listClaims({ runId: run.id })
      .filter((claim) => claim.status === "expired" || claim.status === "superseded")
      .map((claim) => claim.taskId)
  ).size;
  return {
    taskCount: tasks.length,
    workerCount,
    peakActiveClaims,
    completedTasks,
    failedOrRetried: failedTasks + retriedTasks,
    retriedTasks,
    retryEvents,
    workloadShape: [
      `labels=${RELIABILITY_WORK_ITEM_LABELS.join(",")}`,
      `leaseMs=${String(RELIABILITY_LEASE_MS)}`,
      `maxAttempts=${String(RELIABILITY_MAX_ATTEMPTS)}`,
      "dynamicWorkMs=11+((taskIndex+attempt+activeClaims)%4)-recoveryBackoff"
    ],
    elapsedMs: Date.now() - startedAt
  };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 9 chaos and recovery suite", () => {
  test("publishes validation-chaos evidence with crash/reclaim/resume checks", { timeout: 180_000 }, async () => {
    const artifactRefs: Array<{ label: string; path: string }> = [];

    const crashFixture = await createGitRuntimeFixture("codexkit-phase9-chaos-crash");
    cleanups.push(() => crashFixture.cleanup());
    const crashContext = openRuntimeContext(loadRuntimeConfig(crashFixture.rootDir));
    cleanups.push(() => crashContext.close());
    const runtime = new WorkerRuntime(crashContext, { heartbeatMs: 25, gracefulTimeoutMs: 200, claimLeaseMs: 200 });
    cleanups.push(() => runtime.shutdownAll());
    const crashRun = crashContext.runService.createRun({ workflow: "cook" });

    const crashBeforeTask = crashContext.taskService.createTask({ runId: crashRun.id, role: "developer", subject: "crash before completion" });
    const crashBefore = runtime.spawnWorker({
      runId: crashRun.id,
      taskId: crashBeforeTask.id,
      role: "developer",
      displayName: "Chaos crash before",
      prompt: "exit before completion",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: [] },
      command: command("process.exit(2)")
    });
    const crashBeforeResult = await runtime.waitForWorker(crashBefore.workerId);
    const crashBeforePass = crashBeforeResult?.state === "failed"
      && crashContext.claimService.listClaims({ taskId: crashBeforeTask.id }).some((claim) => claim.status === "expired");
    if (crashBeforeResult?.artifactDir && existsSync(crashBeforeResult.artifactDir)) {
      artifactRefs.push({ label: "chaos-crash-before-artifact-dir", path: crashBeforeResult.artifactDir });
    }

    const crashAfterTask = crashContext.taskService.createTask({ runId: crashRun.id, role: "developer", subject: "crash after publish" });
    const crashAfter = runtime.spawnWorker({
      runId: crashRun.id,
      taskId: crashAfterTask.id,
      role: "developer",
      displayName: "Chaos crash after",
      prompt: "write then crash",
      context: {},
      ownedPaths: { ownedWrite: ["allowed"], sharedWrite: [], artifactWrite: [] },
      command: command("const fs=require('fs');fs.mkdirSync('allowed',{recursive:true});fs.writeFileSync('allowed/chaos.txt','ok');process.exit(2);")
    });
    const crashAfterResult = await runtime.waitForWorker(crashAfter.workerId);
    const crashAfterArtifacts = crashContext.artifactService.listArtifacts({ workerId: crashAfter.workerId });
    const crashAfterPass = crashAfterResult?.state === "failed"
      && crashAfterArtifacts.length > 0
      && crashContext.claimService.listClaims({ taskId: crashAfterTask.id }).some((claim) => claim.status === "expired");

    const splitTask = crashContext.taskService.createTask({ runId: crashRun.id, role: "developer", subject: "artifact publish split case" });
    const splitWorker = crashContext.workerService.registerWorker({ runId: crashRun.id, role: "developer", displayName: "Split Worker" });
    const splitClaim = crashContext.claimService.createClaim({ taskId: splitTask.id, workerId: splitWorker.id, leaseMs: 10_000 });
    const splitArtifactPath = path.join(crashFixture.rootDir, "split-artifact-history.log");
    writeFileSync(splitArtifactPath, "artifact publish before task update\n", "utf8");
    const splitArtifact = crashContext.artifactService.publishArtifact({
      runId: crashRun.id,
      taskId: splitTask.id,
      workerId: splitWorker.id,
      artifactKind: "trace",
      path: splitArtifactPath,
      summary: "artifact-publish/task-update split seam"
    });
    crashContext.workerService.updateWorker(splitWorker.id, {
      state: "failed",
      stoppedAt: new Date().toISOString()
    });
    runReconciliationPass(crashContext);
    const splitClaimExpired = crashContext.claimService
      .listClaims({ taskId: splitTask.id })
      .some((claim) => claim.id === splitClaim.id && claim.status === "expired");
    const splitResume = runResumeWorkflow(crashContext, { runId: crashRun.id });
    const splitArtifactTraceable = crashContext.artifactService.readArtifact({ artifactId: splitArtifact.id }).path === splitArtifactPath
      && crashContext.artifactService.readArtifact({ runId: crashRun.id, path: splitArtifactPath }).id === splitArtifact.id;
    const splitPublishedEvent = crashContext.eventService
      .listEntityEvents("artifact", splitArtifact.id, 50)
      .find((event) => event.eventType === "artifact.published");
    const splitReclaimEvent = crashContext.eventService
      .listEntityEvents("worker", splitWorker.id, 50)
      .find((event) => event.eventType === "worker.reclaim.queued");
    const splitCasePass = splitClaimExpired
      && splitArtifactTraceable
      && Boolean(splitPublishedEvent)
      && Boolean(splitReclaimEvent)
      && Number(splitPublishedEvent?.id ?? 0) < Number(splitReclaimEvent?.id ?? 0);
    artifactRefs.push({ label: "chaos-split-artifact", path: splitArtifactPath });

    const teamTask = crashContext.taskService.createTask({ runId: crashRun.id, role: "developer", subject: "replace teammate" });
    const workerA = crashContext.workerService.registerWorker({ runId: crashRun.id, role: "developer", displayName: "Teammate A" });
    const claimA = crashContext.claimService.createClaim({ taskId: teamTask.id, workerId: workerA.id, leaseMs: 5_000 });
    crashContext.workerService.updateWorker(workerA.id, { state: "failed", stoppedAt: new Date().toISOString() });
    runReconciliationPass(crashContext);
    const workerB = crashContext.workerService.registerWorker({ runId: crashRun.id, role: "developer", displayName: "Teammate B" });
    const claimB = crashContext.claimService.createClaim({ taskId: teamTask.id, workerId: workerB.id, leaseMs: 5_000 });
    const teammateReplacementPass = crashContext.claimService.listClaims({ taskId: teamTask.id, status: "active" }).some((claim) => claim.id === claimB.id)
      && crashContext.claimService.listClaims({ taskId: teamTask.id }).some((claim) => claim.id === claimA.id && claim.status === "expired");

    const finalizeFixture = await createGitRuntimeFixture("codexkit-phase9-chaos-finalize-interrupt");
    cleanups.push(() => finalizeFixture.cleanup());
    const finalizeContext = openRuntimeContext(loadRuntimeConfig(finalizeFixture.rootDir));
    const finalizePlan = runPlanWorkflow(finalizeContext, { task: "phase9 interrupted finalize", mode: "hard" });
    const finalizeCook = runCookWorkflow(finalizeContext, { planPath: finalizePlan.planPath, mode: "auto" });
    const syncOnly = runFinalizeSyncBack(finalizeContext, {
      runId: finalizeCook.runId,
      workflow: "cook",
      planPathHint: finalizePlan.planPath
    });
    const finalizePlanB = runPlanWorkflow(finalizeContext, { task: "phase9 interrupted finalize continuation", mode: "hard" });
    const finalizeCookB = runCookWorkflow(finalizeContext, { planPath: finalizePlanB.planPath, mode: "auto" });
    finalizeContext.close();
    const finalizeController = new RuntimeController(finalizeFixture.rootDir);
    cleanups.push(() => finalizeController.close());
    const resumedFinalize = finalizeController.finalize({
      runId: finalizeCookB.runId,
      planPathHint: finalizePlanB.planPath
    });
    const interruptedFinalizePass = syncOnly.status === "synced"
      && resumedFinalize.checkpointIds.includes("finalize-git")
      && existsSync(resumedFinalize.finalizeReportPath);
    artifactRefs.push({ label: "chaos-interrupted-finalize-report", path: resumedFinalize.finalizeReportPath });

    const fakeFixture = await createGitRuntimeFixture("codexkit-phase9-chaos-resume");
    cleanups.push(() => fakeFixture.cleanup());
    const fakeClock = createFakeClock();
    const fakeContext = openRuntimeContext(loadRuntimeConfig(fakeFixture.rootDir), fakeClock.clock);
    cleanups.push(() => fakeContext.close());
    const reclaimRun = fakeContext.runService.createRun({ workflow: "cook" });
    const reclaimTask = fakeContext.taskService.createTask({ runId: reclaimRun.id, role: "tester", subject: "reclaim candidate" });
    const reclaimWorker = fakeContext.workerService.registerWorker({ runId: reclaimRun.id, role: "tester", displayName: "Reclaim Worker" });
    fakeContext.claimService.createClaim({ taskId: reclaimTask.id, workerId: reclaimWorker.id, leaseMs: 50 });
    fakeClock.advanceMs(5_000);
    const resumeWithReclaim = runResumeWorkflow(fakeContext, { runId: reclaimRun.id });
    const reclaimBlocked = resumeWithReclaim.diagnostics.find((item) => item.code === "RESUME_RECLAIM_BLOCKED");
    const reclaimPass = resumeWithReclaim.reclaimCandidates.length > 0 && Boolean(reclaimBlocked) && typeof resumeWithReclaim.continuationCommand === "string";

    const approvalRun = fakeContext.runService.createRun({ workflow: "cook" });
    const pendingApproval = fakeContext.approvalService.requestApproval({
      runId: approvalRun.id,
      checkpoint: "post-plan",
      question: "Continue?",
      options: [{ code: "approve", label: "Approve" }]
    });
    const resumeWithApproval = runResumeWorkflow(fakeContext, { runId: approvalRun.id });
    const approvalResumePass = resumeWithApproval.pendingApprovals.some((approval) => approval.id === pendingApproval.id)
      && typeof resumeWithApproval.continuationCommand === "string"
      && resumeWithApproval.continuationCommand.includes("cdx approval respond");
    artifactRefs.push({ label: "chaos-resume-report", path: resumeWithReclaim.resumeReportPath });

    const restartFixture = await createGitRuntimeFixture("codexkit-phase9-chaos-restart");
    cleanups.push(() => restartFixture.cleanup());
    const beforeRestart = new RuntimeController(restartFixture.rootDir);
    const restartRun = beforeRestart.createRun({ workflow: "cook", prompt: "restart continuity" });
    beforeRestart.createTask({ runId: restartRun.id, role: "developer", subject: "active run continuity" });
    beforeRestart.close();
    const afterRestart = new RuntimeController(restartFixture.rootDir);
    cleanups.push(() => afterRestart.close());
    const restartResume = afterRestart.resume({ runId: restartRun.id });
    const restartPass = restartResume.recoveredRunId === restartRun.id;

    const benchmarkFixture = await createGitRuntimeFixture("codexkit-phase9-chaos-reliability");
    cleanups.push(() => benchmarkFixture.cleanup());
    const benchmarkContext = openRuntimeContext(loadRuntimeConfig(benchmarkFixture.rootDir));
    cleanups.push(() => benchmarkContext.close());
    const sequential = await executeReliabilityScenario({
      context: benchmarkContext,
      parallel: false,
      name: "sequential-reliability"
    });
    const parallel = await executeReliabilityScenario({
      context: benchmarkContext,
      parallel: true,
      name: "parallel-reliability"
    });
    const sequentialRate = sequential.failedOrRetried / sequential.taskCount;
    const parallelRate = parallel.failedOrRetried / parallel.taskCount;
    const workloadComparable = sequential.workloadShape.join(",") === parallel.workloadShape.join(",");
    const nonZeroReliabilitySignal = sequential.retriedTasks > 0 && parallel.retriedTasks > 0;
    const completedComparable = sequential.completedTasks === sequential.taskCount && parallel.completedTasks === parallel.taskCount;
    const nfr74Pass = workloadComparable
      && nonZeroReliabilitySignal
      && completedComparable
      && parallelRate <= sequentialRate + 0.1;
    const reliabilityArtifact = createDurableNoteArtifact({
      suiteId: "validation-chaos",
      label: "chaos-parallel-reliability-benchmark",
      markdown: [
        "# Parallel Reliability Benchmark",
        "",
        `- Comparable work-item labels: ${RELIABILITY_WORK_ITEM_LABELS.join(", ")}`,
        `- Workload shape: ${sequential.workloadShape.join(", ")}`,
        `- Reliability signal source: runtime lease-expiry/supersede under comparable load (no scripted retry budgets)`,
        `- Sequential worker count: ${sequential.workerCount}`,
        `- Parallel worker count: ${parallel.workerCount}`,
        `- Sequential peak active claims: ${sequential.peakActiveClaims}`,
        `- Parallel peak active claims: ${parallel.peakActiveClaims}`,
        `- Sequential elapsed ms: ${sequential.elapsedMs}`,
        `- Parallel elapsed ms: ${parallel.elapsedMs}`,
        `- Sequential completed tasks: ${sequential.completedTasks}/${sequential.taskCount}`,
        `- Parallel completed tasks: ${parallel.completedTasks}/${parallel.taskCount}`,
        `- Sequential retried tasks: ${sequential.retriedTasks}`,
        `- Parallel retried tasks: ${parallel.retriedTasks}`,
        `- Sequential retry events: ${sequential.retryEvents}`,
        `- Parallel retry events: ${parallel.retryEvents}`,
        `- Workload comparable: ${workloadComparable}`,
        `- Non-zero retry signal observed in both runs: ${nonZeroReliabilitySignal}`,
        `- Sequential failed/retried rate: ${sequentialRate.toFixed(4)}`,
        `- Parallel failed/retried rate: ${parallelRate.toFixed(4)}`,
        `- Allowed delta: 0.1000`,
        `- Observed delta: ${(parallelRate - sequentialRate).toFixed(4)}`,
        `- Result: ${nfr74Pass ? "pass" : "fail"}`,
        ""
      ].join("\n")
    });
    artifactRefs.push({ label: "chaos-parallel-reliability-benchmark", path: reliabilityArtifact.path });

    const restartArtifact = createDurableNoteArtifact({
      suiteId: "validation-chaos",
      label: "chaos-restart-continuity",
      markdown: `# Restart Continuity\n\n- recovered run id matches original: ${restartPass}\n`
    });
    const reclaimArtifact = createDurableNoteArtifact({
      suiteId: "validation-chaos",
      label: "chaos-reclaim-operator-state",
      markdown: `# Reclaim Recovery State\n\n- reclaim candidates surfaced: ${resumeWithReclaim.reclaimCandidates.length}\n- typed blocker present: ${Boolean(reclaimBlocked)}\n- continuation command: ${resumeWithReclaim.continuationCommand ?? "none"}\n`
    });
    const crashArtifact = createDurableNoteArtifact({
      suiteId: "validation-chaos",
      label: "chaos-crash-ledger-artifact-history",
      markdown: `# Crash Artifact History\n\n- crash-before pass: ${crashBeforePass}\n- crash-after pass: ${crashAfterPass}\n- publish/task split pass: ${splitCasePass}\n`
    });
    const approvalArtifact = createDurableNoteArtifact({
      suiteId: "validation-chaos",
      label: "chaos-approval-resume-state",
      markdown: `# Approval Resume State\n\n- pending approval detected: ${approvalResumePass}\n`
    });

    const metricResults: ValidationMetricResult[] = [
      {
        metricId: "NFR-1.1",
        mappedNfrIds: ["NFR-1.1"],
        required: true,
        status: restartPass ? "pass" : "fail",
        fixtureRefs: ["interrupted-run"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [restartArtifact],
        evidence: ["resume after controller restart recovers active run id"]
      },
      {
        metricId: "NFR-1.4",
        mappedNfrIds: ["NFR-1.4"],
        required: true,
        status: reclaimPass ? "pass" : "fail",
        fixtureRefs: ["interrupted-run"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [reclaimArtifact],
        evidence: ["lease-expired reclaim candidate surfaced on first resume action"]
      },
      {
        metricId: "NFR-3.7",
        mappedNfrIds: ["NFR-3.7"],
        required: true,
        status: reclaimPass ? "pass" : "fail",
        fixtureRefs: ["interrupted-run"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [reclaimArtifact],
        evidence: ["resume emitted one concrete continuation command for reclaim-blocked state"]
      },
      {
        metricId: "NFR-5.4",
        mappedNfrIds: ["NFR-5.4"],
        required: true,
        status: crashBeforePass && crashAfterPass && splitCasePass ? "pass" : "fail",
        fixtureRefs: ["interrupted-run", "retained-failed-worker"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [crashArtifact, metricArtifactRef("chaos-split-artifact", splitArtifactPath)],
        evidence: ["worker crash, artifact-publish/task-update split, and artifact-history/ledger assertions retained recoverable state"]
      },
      {
        metricId: "NFR-5.5",
        mappedNfrIds: ["NFR-5.5"],
        required: true,
        status: reclaimPass ? "pass" : "fail",
        fixtureRefs: ["interrupted-run"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [reclaimArtifact],
        evidence: ["resume reclaim blocker diagnostic included code/cause/next-step continuation command"]
      },
      {
        metricId: "NFR-6.4",
        mappedNfrIds: ["NFR-6.4"],
        required: true,
        status: approvalResumePass ? "pass" : "fail",
        fixtureRefs: ["interrupted-run"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [approvalArtifact],
        evidence: ["resume surfaced unresolved pending approvals and explicit approval continuation command"]
      },
      {
        metricId: "NFR-7.4",
        mappedNfrIds: ["NFR-7.4"],
        required: true,
        status: nfr74Pass ? "pass" : "fail",
        fixtureRefs: ["parallelizable-repo"],
        hostManifestRefs: ["bundle://host-manifest/current"],
        artifactRefs: [reliabilityArtifact],
        evidence: ["parallel benchmark failed/retried-task rate stayed within +10% of the sequential baseline"]
      }
    ];

    const blockers: string[] = [];
    if (!teammateReplacementPass) {
      blockers.push("stuck teammate replacement path failed to reassign ownership deterministically");
    }
    if (!interruptedFinalizePass) {
      blockers.push("interrupted finalize recovery path did not reach finalize-git checkpoint");
    }
    if (metricResults.some((metric) => metric.required && metric.status !== "pass")) {
      blockers.push("one or more required chaos/recovery metrics are non-pass");
    }

    const evidence = writePhase9EvidenceBundle({
      suiteId: "validation-chaos",
      fixtureIds: ["interrupted-run", "retained-failed-worker", "git-clean", "parallelizable-repo"],
      metricResults,
      artifactRefs,
      blockers
    });

    expect(existsSync(evidence.path)).toBe(true);
    expect(teammateReplacementPass).toBe(true);
    expect(interruptedFinalizePass).toBe(true);
  });
});
