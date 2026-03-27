import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ValidationEvidenceBundle, ValidationMetricStatus } from "../../packages/codexkit-core/src/index.ts";
import { validateValidationEvidenceBundle } from "../../packages/codexkit-daemon/src/index.ts";
import { readPhase9EvidenceBundle, resolvePhase9CandidateIdentity } from "./helpers/phase9-evidence.ts";

interface MetricRow {
  metricId: string;
  status: ValidationMetricStatus;
  fixtureRefs: string[];
  hostManifestRefs: string[];
  artifactRefs: string[];
  freshness: string;
  notes: string[];
}

interface BundleAcceptance {
  suiteId: string;
  accepted: boolean;
  reason: string;
  freshness: string;
}

function parseMetricIdsFromNfrDoc(): string[] {
  const nfrDoc = readFileSync(path.join(process.cwd(), "docs", "non-functional-requirements.md"), "utf8");
  const ids = Array.from(new Set((nfrDoc.match(/`NFR-\d+\.\d+`/g) ?? []).map((entry) => entry.replace(/`/g, ""))));
  return ids.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function defaultMetricRow(metricId: string): MetricRow {
  return {
    metricId,
    status: "blocked",
    fixtureRefs: [],
    hostManifestRefs: [],
    artifactRefs: [],
    freshness: "blocked: no accepted evidence",
    notes: ["no accepted evidence for metric"]
  };
}

function statusRank(status: ValidationMetricStatus): number {
  if (status === "fail") {
    return 3;
  }
  if (status === "pass") {
    return 2;
  }
  return 1;
}

function mergeRow(base: MetricRow, incoming: MetricRow): MetricRow {
  const incomingWins = statusRank(incoming.status) >= statusRank(base.status);
  const status = incomingWins ? incoming.status : base.status;
  const incomingLooksAccepted = incoming.artifactRefs.length > 0
    && !incoming.freshness.startsWith("rejected")
    && !incoming.freshness.startsWith("missing")
    && !incoming.freshness.startsWith("stale");
  const filteredBaseNotes = base.notes.length === 1
    && base.notes[0] === "no accepted evidence for metric"
    && incomingLooksAccepted
    ? []
    : base.notes;
  return {
    metricId: base.metricId,
    status,
    fixtureRefs: Array.from(new Set([...base.fixtureRefs, ...incoming.fixtureRefs])),
    hostManifestRefs: Array.from(new Set([...base.hostManifestRefs, ...incoming.hostManifestRefs])),
    artifactRefs: Array.from(new Set([...base.artifactRefs, ...incoming.artifactRefs])),
    freshness: incomingWins ? incoming.freshness : base.freshness,
    notes: Array.from(new Set([...filteredBaseNotes, ...incoming.notes]))
  };
}

function evaluateBundleAcceptance(bundle: ValidationEvidenceBundle | null, identity: { baseSha: string; candidateSha: string }): BundleAcceptance {
  if (!bundle) {
    return {
      suiteId: "missing",
      accepted: false,
      reason: "evidence artifact missing",
      freshness: "missing"
    };
  }
  const schemaErrors = validateValidationEvidenceBundle(bundle);
  if (schemaErrors.length > 0) {
    return {
      suiteId: bundle.suiteId,
      accepted: false,
      reason: `schema invalid: ${schemaErrors.join("; ")}`,
      freshness: "rejected"
    };
  }
  if (bundle.baseSha !== identity.baseSha || bundle.candidateSha !== identity.candidateSha) {
    return {
      suiteId: bundle.suiteId,
      accepted: false,
      reason: `foreign candidate/base evidence (expected ${identity.baseSha}/${identity.candidateSha})`,
      freshness: "rejected"
    };
  }
  const now = Date.now();
  const freshUntil = Date.parse(bundle.freshUntil);
  if (!Number.isFinite(freshUntil) || freshUntil < now) {
    return {
      suiteId: bundle.suiteId,
      accepted: false,
      reason: `stale evidence (freshUntil=${bundle.freshUntil})`,
      freshness: "stale"
    };
  }
  return {
    suiteId: bundle.suiteId,
    accepted: true,
    reason: "accepted",
    freshness: `fresh until ${bundle.freshUntil}`
  };
}

function rowsFromAcceptedBundle(bundle: ValidationEvidenceBundle, freshness: string): MetricRow[] {
  return bundle.metricResults.map((metric) => ({
    metricId: metric.metricId,
    status: metric.status,
    fixtureRefs: metric.fixtureRefs,
    hostManifestRefs: metric.hostManifestRefs,
    artifactRefs: metric.artifactRefs.map((ref) => `${ref.label}:${ref.path}`),
    freshness,
    notes: metric.notes ? [metric.notes] : []
  }));
}

describe("phase 9 release readiness synthesis", () => {
  test("writes release-readiness-report.md with frozen B0 metric row shape and honest rejected-evidence handling", () => {
    const metricIds = parseMetricIdsFromNfrDoc();
    const identity = resolvePhase9CandidateIdentity();
    const rows = new Map<string, MetricRow>(metricIds.map((metricId) => [metricId, defaultMetricRow(metricId)]));

    const acceptedBundles: BundleAcceptance[] = [];
    const phase9Bundles = [
      readPhase9EvidenceBundle("validation-golden"),
      readPhase9EvidenceBundle("validation-chaos"),
      readPhase9EvidenceBundle("validation-migration")
    ];

    for (const bundle of phase9Bundles) {
      const acceptance = evaluateBundleAcceptance(bundle, identity);
      acceptedBundles.push(acceptance);
      if (!bundle) {
        continue;
      }
      if (!acceptance.accepted) {
        for (const metric of bundle.metricResults) {
          rows.set(metric.metricId, mergeRow(rows.get(metric.metricId) ?? defaultMetricRow(metric.metricId), {
            metricId: metric.metricId,
            status: "blocked",
            fixtureRefs: metric.fixtureRefs,
            hostManifestRefs: metric.hostManifestRefs,
            artifactRefs: metric.artifactRefs.map((ref) => `${ref.label}:${ref.path}`),
            freshness: acceptance.freshness,
            notes: [`rejected ${bundle.suiteId} evidence: ${acceptance.reason}`]
          }));
        }
        continue;
      }
      for (const row of rowsFromAcceptedBundle(bundle, acceptance.freshness)) {
        rows.set(row.metricId, mergeRow(rows.get(row.metricId) ?? defaultMetricRow(row.metricId), row));
      }
    }

    const phase5EvidencePath = path.join(process.cwd(), ".tmp", "phase-5-wave2-nfr-evidence.json");
    if (existsSync(phase5EvidencePath)) {
      const phase5Evidence = JSON.parse(readFileSync(phase5EvidencePath, "utf8")) as {
        commitSha?: string;
        results?: Record<string, { pass?: boolean }>;
      };
      for (const [metricId] of Object.entries(phase5Evidence.results ?? {})) {
        rows.set(metricId, mergeRow(rows.get(metricId) ?? defaultMetricRow(metricId), {
          metricId,
          status: "blocked",
          fixtureRefs: [],
          hostManifestRefs: [],
          artifactRefs: [phase5EvidencePath],
          freshness: "rejected",
          notes: [`rejected reused evidence from foreign candidate commit ${phase5Evidence.commitSha ?? "unknown"}`]
        }));
      }
      acceptedBundles.push({
        suiteId: "phase-5-wave2-nfr-evidence",
        accepted: false,
        reason: "schema/candidate provenance incompatible with Phase 9 frozen contract",
        freshness: "rejected"
      });
    }

    const nfr81Row = rows.get("NFR-8.1") ?? defaultMetricRow("NFR-8.1");
    const acceptedFreshBundles = acceptedBundles.filter((entry) => entry.accepted);
    const nfr84Status: ValidationMetricStatus = nfr81Row.status === "pass"
      ? (acceptedFreshBundles.length > 0 ? "pass" : "blocked")
      : "fail";
    rows.set("NFR-8.4", mergeRow(rows.get("NFR-8.4") ?? defaultMetricRow("NFR-8.4"), {
      metricId: "NFR-8.4",
      status: nfr84Status,
      fixtureRefs: nfr81Row.fixtureRefs,
      hostManifestRefs: nfr81Row.hostManifestRefs,
      artifactRefs: nfr81Row.artifactRefs,
      freshness: nfr81Row.freshness,
      notes: [
        nfr84Status === "pass"
          ? "host matrix evidence is fresh and accepted"
          : "host matrix evidence is missing, stale, blocked, or rejected"
      ]
    }));

    const metricRows = metricIds.map((metricId) => rows.get(metricId) ?? defaultMetricRow(metricId));
    const blockerLines = metricRows
      .filter((row) => row.status !== "pass")
      .map((row) => `${row.metricId} is ${row.status}`);
    const rejectedEvidenceLines = acceptedBundles
      .filter((entry) => !entry.accepted)
      .map((entry) => `${entry.suiteId}: ${entry.reason}`);
    const openBlockers = [...blockerLines, ...rejectedEvidenceLines];
    const releasePass = openBlockers.length === 0;
    const migrationBundle = phase9Bundles.find((bundle) => bundle?.suiteId === "validation-migration") ?? null;
    const migrationReady = Boolean(migrationBundle) && migrationBundle!.summary.requiredNonPass === 0;

    const reportPath = path.join(
      process.cwd(),
      "plans",
      "20260313-1128-phase-0-preflight-clean-restart",
      "reports",
      "release-readiness-report.md"
    );
    mkdirSync(path.dirname(reportPath), { recursive: true });
    const markdown = [
      "# Release Readiness Report",
      "",
      `- Generated At: ${new Date().toISOString()}`,
      `- base_sha: ${identity.baseSha}`,
      `- candidate_sha: ${identity.candidateSha}`,
      `- Release Verdict: ${releasePass ? "pass" : "fail"}`,
      "",
      "## Suite Summary",
      ...acceptedBundles.map((entry) => `- ${entry.suiteId}: ${entry.accepted ? "accepted" : "rejected"} (${entry.reason})`),
      "",
      "## NFR Pass Fail Table",
      "| Metric | Status | Fixture Refs | Host Manifest Refs | Evidence Refs | Freshness | Notes |",
      "|---|---|---|---|---|---|---|",
      ...metricRows.map((row) =>
        `| ${row.metricId} | ${row.status} | ${row.fixtureRefs.join("<br/>") || "none"} | ${row.hostManifestRefs.join("<br/>") || "none"} | ${row.artifactRefs.join("<br/>") || "none"} | ${row.freshness} | ${row.notes.join("<br/>") || "none"} |`
      ),
      "",
      "## Open Blockers",
      ...(openBlockers.length > 0 ? openBlockers.map((line) => `- ${line}`) : ["- none"]),
      "",
      "## Waived Issues",
      "- none",
      "",
      "## Migration Readiness Verdict",
      `- ${migrationReady ? "ready" : "not ready"}`,
      "",
      "## Host Compatibility",
      `- NFR-8.1 status: ${nfr81Row.status}`,
      `- NFR-8.4 status: ${rows.get("NFR-8.4")?.status ?? "blocked"}`,
      `- Freshness rule: NFR-8.4 host matrix evidence must remain within fresh_until`,
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n");
    writeFileSync(reportPath, markdown, "utf8");

    const snapshotPath = path.join(process.cwd(), ".tmp", "phase-9-release-readiness-metrics.json");
    mkdirSync(path.dirname(snapshotPath), { recursive: true });
    writeFileSync(
      snapshotPath,
      `${JSON.stringify({ generatedAt: new Date().toISOString(), baseSha: identity.baseSha, candidateSha: identity.candidateSha, metricRows, openBlockers, releasePass, migrationReady, acceptedBundles }, null, 2)}\n`,
      "utf8"
    );

    expect(existsSync(reportPath)).toBe(true);
    const content = readFileSync(reportPath, "utf8");
    expect(content).toContain("| Metric | Status | Fixture Refs | Host Manifest Refs | Evidence Refs | Freshness | Notes |");
    expect(content).toContain("| NFR-1.1 |");
    expect(content).toContain("| NFR-8.4 |");
  });
});
