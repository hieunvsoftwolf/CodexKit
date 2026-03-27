import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ValidationEvidenceBundle, ValidationSuiteId } from "../../packages/codexkit-core/src/index.ts";
import {
  loadRuntimeConfig,
  openRuntimeContext,
  publishPhase9ValidationEvidence,
  resolvePhase9ReportPath,
  runPlanWorkflow,
  summarizeValidationMetricResults
} from "../../packages/codexkit-daemon/src/index.ts";
import { createRuntimeFixture, createValidationHostManifest } from "./helpers/runtime-fixture.ts";
import { createDurableNoteArtifact, resolvePhase9CandidateIdentity } from "./helpers/phase9-evidence.ts";

const cleanups: Array<() => Promise<void> | void> = [];
const PHASE9_CONTRACT_TEST_TIMEOUT_MS = 20_000;

function buildEvidenceBundle(suiteId: ValidationSuiteId): ValidationEvidenceBundle {
  const generatedAt = new Date().toISOString();
  const identity = resolvePhase9CandidateIdentity();
  const contractArtifactRef = createDurableNoteArtifact({
    suiteId,
    label: `${suiteId}-contract-check`,
    markdown: `# ${suiteId}\n\nPhase 9 contract evidence publish-path assertion.\n`
  });
  const metricResults = [
    {
      metricId: "NFR-5.2",
      mappedNfrIds: ["NFR-5.2"],
      required: true,
      status: "pass" as const,
      fixtureRefs: ["git-clean"],
      hostManifestRefs: ["bundle://host-manifest/current"],
      artifactRefs: [contractArtifactRef],
      evidence: ["phase9 contract publish path validated"]
    },
    {
      metricId: "NFR-8.4",
      mappedNfrIds: ["NFR-8.4"],
      required: true,
      status: "blocked" as const,
      fixtureRefs: ["git-clean"],
      hostManifestRefs: ["bundle://host-manifest/current"],
      artifactRefs: [contractArtifactRef],
      evidence: ["host matrix suite not attached in this contract-only fixture"],
      notes: "expected in phase9 release synthesis"
    }
  ];
  return {
    schemaVersion: "phase9-validation-evidence-v2",
    baseSha: identity.baseSha,
    candidateSha: identity.candidateSha,
    generatedAt,
    freshUntil: new Date(Date.parse(generatedAt) + 7 * 24 * 60 * 60 * 1000).toISOString(),
    freshnessRule: "NFR-8.4-host-matrix-results-must-be-younger-than-7-days",
    suiteId,
    fixtureIds: ["git-clean"],
    metricResults,
    hostManifest: createValidationHostManifest(),
    artifactRefs: [contractArtifactRef],
    summary: summarizeValidationMetricResults(metricResults),
    blockers: []
  };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 9 shared validation contract", () => {
  test("resolves phase9 report placement to run artifacts or plan reports deterministically", { timeout: PHASE9_CONTRACT_TEST_TIMEOUT_MS }, async () => {
    const fixture = await createRuntimeFixture("codexkit-phase9-contract-paths");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());

    const runNoPlan = context.runService.createRun({ workflow: "test" });
    const runScopePath = resolvePhase9ReportPath(context, runNoPlan, "validation-golden");
    expect(runScopePath.scope).toBe("run");
    expect(path.basename(runScopePath.absolutePath)).toBe("validation-golden-evidence.json");
    expect(runScopePath.absolutePath).toContain(path.join(".codexkit", "runtime", "artifacts", runNoPlan.id));

    const plan = runPlanWorkflow(context, { task: "phase9 contract placement", mode: "hard" });
    const planRun = context.runService.getRun(plan.runId);
    const planScopePath = resolvePhase9ReportPath(context, planRun, "release-readiness", {
      planPathHint: plan.planPath
    });
    expect(planScopePath.scope).toBe("plan");
    expect(path.basename(planScopePath.absolutePath)).toBe("release-readiness-report.md");
    expect(path.dirname(planScopePath.absolutePath)).toBe(path.join(path.dirname(plan.planPath), "reports"));
  });

  test("publishes schema-valid phase9 evidence and rejects invalid host manifest shapes", { timeout: PHASE9_CONTRACT_TEST_TIMEOUT_MS }, async () => {
    const fixture = await createRuntimeFixture("codexkit-phase9-contract-schema");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    cleanups.push(() => context.close());
    const run = context.runService.createRun({ workflow: "test" });

    const published = publishPhase9ValidationEvidence(context, {
      runId: run.id,
      suiteId: "validation-golden",
      bundle: buildEvidenceBundle("validation-golden"),
      summary: "phase9 contract schema fixture"
    });
    expect(existsSync(published.artifactPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(published.artifactPath, "utf8")) as ValidationEvidenceBundle;
    expect(parsed.suiteId).toBe("validation-golden");
    expect(parsed.metricResults.every((metric) => metric.mappedNfrIds.length > 0)).toBe(true);
    expect(parsed.summary).toEqual(summarizeValidationMetricResults(parsed.metricResults));

    const invalid = buildEvidenceBundle("validation-chaos");
    invalid.hostManifest.codexCliVersion = "";
    expect(() =>
      publishPhase9ValidationEvidence(context, {
        runId: run.id,
        suiteId: "validation-chaos",
        bundle: invalid,
        summary: "invalid schema fixture"
      })
    ).toThrow(/validation evidence bundle is invalid/);
  });

  test("anchors helper provenance to current fifth-remediation wave-2 control snapshot", { timeout: PHASE9_CONTRACT_TEST_TIMEOUT_MS }, () => {
    const helperPath = path.join(process.cwd(), "tests", "runtime", "helpers", "phase9-evidence.ts");
    const helperSource = readFileSync(helperPath, "utf8");
    expect(helperSource).toContain("control-state-phase-9-fifth-remediation-wave-2-ready-after-sa.md");
  });
});
