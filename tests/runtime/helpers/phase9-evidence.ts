import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ValidationArtifactRef,
  ValidationEvidenceBundle,
  ValidationMetricResult,
  ValidationSuiteId
} from "../../../packages/codexkit-core/src/index.ts";
import {
  PHASE9_VALIDATION_EVIDENCE_FILE_NAMES,
  summarizeValidationMetricResults
} from "../../../packages/codexkit-daemon/src/index.ts";
import { createValidationHostManifest } from "./runtime-fixture.ts";

const PHASE9_CONTROL_STATE_REPORT = path.join(
  "plans",
  "20260313-1128-phase-0-preflight-clean-restart",
  "reports",
  "control-state-phase-9-fifth-remediation-wave-2-ready-after-sa.md"
);
const DEFAULT_FRESHNESS_DAYS = 7;
const DEFAULT_HOST_MANIFEST_REF = "bundle://host-manifest/current";
const PHASE9_VOLATILE_PATH_EXCLUDES = [".tmp/**"];
let frozenCandidateIdentity: { baseSha: string; candidateSha: string } | null = null;

function repoRoot(): string {
  return process.cwd();
}

function gitOutput(args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot(),
    encoding: "utf8"
  }).trim();
}

function withStablePathspec(args: string[]): string[] {
  return [
    ...args,
    "--",
    ".",
    ...PHASE9_VOLATILE_PATH_EXCLUDES.map((pattern) => `:(exclude)${pattern}`)
  ];
}

function gitText(args: string[]): string {
  return execFileSync("git", withStablePathspec(args), {
    cwd: repoRoot(),
    encoding: "utf8"
  }).trimEnd();
}

function readPinnedBaseSha(): string {
  const controlStatePath = path.join(repoRoot(), PHASE9_CONTROL_STATE_REPORT);
  if (existsSync(controlStatePath)) {
    const markdown = readFileSync(controlStatePath, "utf8");
    const matched = markdown.match(/Pinned BASE_SHA\*\*:\s*`([0-9a-f]{40})`/i);
    if (matched?.[1]) {
      return matched[1];
    }
  }
  return gitOutput(["rev-parse", "HEAD"]);
}

function computeCandidateSha(headSha: string): string {
  const status = gitText(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.trim().length === 0) {
    return headSha;
  }
  const stagedDiff = gitText(["diff", "--staged", "--binary"]);
  const workingDiff = gitText(["diff", "--binary"]);
  const untracked = gitText(["ls-files", "--others", "--exclude-standard"]);
  const digest = createHash("sha256")
    .update(status)
    .update(stagedDiff)
    .update(workingDiff)
    .update(untracked)
    .digest("hex")
    .slice(0, 16);
  return `${headSha}-dirty-${digest}`;
}

function toFreshUntil(generatedAt: string, days: number): string {
  const millis = Date.parse(generatedAt) + days * 24 * 60 * 60 * 1000;
  return new Date(millis).toISOString();
}

function slug(text: string): string {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return normalized.length > 0 ? normalized : "artifact";
}

function phase9DurableArtifactDir(suiteId: ValidationSuiteId): string {
  return path.join(repoRoot(), ".tmp", "phase9-durable-artifacts", suiteId);
}

function phase9DurableArtifactPath(input: { suiteId: ValidationSuiteId; label: string; ext: string; sourceFingerprint: string }): string {
  return path.join(
    phase9DurableArtifactDir(input.suiteId),
    `${slug(input.label)}-${input.sourceFingerprint}${input.ext}`
  );
}

function dedupeArtifactRefs(refs: ValidationArtifactRef[]): ValidationArtifactRef[] {
  const seen = new Set<string>();
  const deduped: ValidationArtifactRef[] = [];
  for (const ref of refs) {
    const key = `${ref.artifactId ?? ""}:${path.resolve(ref.path)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(ref);
  }
  return deduped;
}

function toDurableArtifactRef(suiteId: ValidationSuiteId, ref: Omit<ValidationArtifactRef, "durability">): ValidationArtifactRef {
  const sourcePath = path.resolve(ref.path);
  const sourceExists = existsSync(sourcePath);
  const sourceStat = sourceExists ? statSync(sourcePath) : null;
  const sourceFingerprint = createHash("sha1")
    .update(sourcePath)
    .update(sourceStat ? `${sourceStat.size}:${sourceStat.mtimeMs}` : "missing")
    .digest("hex")
    .slice(0, 12);
  const ext = sourceStat?.isFile() ? (path.extname(sourcePath) || ".txt") : ".txt";
  const targetPath = phase9DurableArtifactPath({
    suiteId,
    label: ref.label,
    ext,
    sourceFingerprint
  });
  mkdirSync(path.dirname(targetPath), { recursive: true });
  if (sourceStat?.isFile()) {
    copyFileSync(sourcePath, targetPath);
  } else if (sourceStat?.isDirectory()) {
    const entries = readdirSync(sourcePath);
    writeFileSync(
      targetPath,
      [
        `Directory artifact snapshot for ${sourcePath}`,
        "",
        ...entries.map((entry) => `- ${entry}`),
        ""
      ].join("\n"),
      "utf8"
    );
  } else {
    writeFileSync(targetPath, `Missing source artifact path: ${sourcePath}\n`, "utf8");
  }
  return {
    ...ref,
    path: targetPath,
    durability: "durable"
  };
}

function defaultMetricRefs(input: {
  metric: ValidationMetricResult;
  fixtureIds: string[];
  rootArtifactRefs: ValidationArtifactRef[];
}): ValidationMetricResult {
  const normalizedFixtureRefs = input.metric.fixtureRefs.length > 0 ? input.metric.fixtureRefs : input.fixtureIds;
  const normalizedHostRefs = input.metric.hostManifestRefs.length > 0 ? input.metric.hostManifestRefs : [DEFAULT_HOST_MANIFEST_REF];
  const metricArtifactRefs = input.metric.artifactRefs.length > 0 ? input.metric.artifactRefs : input.rootArtifactRefs;
  return {
    ...input.metric,
    fixtureRefs: [...normalizedFixtureRefs],
    hostManifestRefs: [...normalizedHostRefs],
    artifactRefs: dedupeArtifactRefs(metricArtifactRefs)
  };
}

export function resolvePhase9CandidateIdentity(): { baseSha: string; candidateSha: string } {
  if (frozenCandidateIdentity) {
    return frozenCandidateIdentity;
  }
  const headSha = gitOutput(["rev-parse", "HEAD"]);
  frozenCandidateIdentity = {
    baseSha: readPinnedBaseSha(),
    candidateSha: computeCandidateSha(headSha)
  };
  return frozenCandidateIdentity;
}

export function createDurableNoteArtifact(input: {
  suiteId: ValidationSuiteId;
  label: string;
  markdown: string;
  checkpointId?: ValidationArtifactRef["checkpointId"];
}): ValidationArtifactRef {
  const digest = createHash("sha1").update(input.markdown).digest("hex").slice(0, 12);
  const notePath = phase9DurableArtifactPath({
    suiteId: input.suiteId,
    label: input.label,
    ext: ".md",
    sourceFingerprint: digest
  });
  mkdirSync(path.dirname(notePath), { recursive: true });
  writeFileSync(notePath, `${input.markdown.endsWith("\n") ? input.markdown : `${input.markdown}\n`}`, "utf8");
  return {
    label: input.label,
    path: notePath,
    durability: "durable",
    ...(input.checkpointId ? { checkpointId: input.checkpointId } : {})
  };
}

function phase9EvidencePath(suiteId: ValidationSuiteId): string {
  return path.join(repoRoot(), ".tmp", PHASE9_VALIDATION_EVIDENCE_FILE_NAMES[suiteId]);
}

export function writePhase9EvidenceBundle(input: {
  suiteId: ValidationSuiteId;
  fixtureIds: string[];
  metricResults: ValidationMetricResult[];
  artifactRefs?: Array<Omit<ValidationArtifactRef, "durability">>;
  blockers?: string[];
  freshnessDays?: number;
}): ValidationEvidenceBundle & { path: string } {
  const generatedAt = new Date().toISOString();
  const identity = resolvePhase9CandidateIdentity();
  const rootArtifactRefs = dedupeArtifactRefs(
    (input.artifactRefs ?? []).map((ref) => toDurableArtifactRef(input.suiteId, ref))
  );
  const normalizedMetricResults = input.metricResults.map((metric) =>
    defaultMetricRefs({
      metric: {
        ...metric,
        artifactRefs: dedupeArtifactRefs(metric.artifactRefs.map((ref) => toDurableArtifactRef(input.suiteId, ref)))
      },
      fixtureIds: input.fixtureIds,
      rootArtifactRefs
    })
  );
  const allArtifactRefs = dedupeArtifactRefs([
    ...rootArtifactRefs,
    ...normalizedMetricResults.flatMap((metric) => metric.artifactRefs)
  ]);
  const effectiveArtifactRefs = allArtifactRefs.length > 0
    ? allArtifactRefs
    : [createDurableNoteArtifact({
      suiteId: input.suiteId,
      label: `${input.suiteId}-no-artifacts`,
      markdown: `# ${input.suiteId}\n\nNo external artifact refs were provided; durable note artifact created.\n`
    })];

  const bundle: ValidationEvidenceBundle = {
    schemaVersion: "phase9-validation-evidence-v2",
    baseSha: identity.baseSha,
    candidateSha: identity.candidateSha,
    generatedAt,
    freshUntil: toFreshUntil(generatedAt, input.freshnessDays ?? DEFAULT_FRESHNESS_DAYS),
    freshnessRule: "NFR-8.4-host-matrix-results-must-be-younger-than-7-days",
    suiteId: input.suiteId,
    fixtureIds: input.fixtureIds,
    metricResults: normalizedMetricResults,
    hostManifest: createValidationHostManifest(repoRoot()),
    artifactRefs: effectiveArtifactRefs,
    summary: summarizeValidationMetricResults(normalizedMetricResults),
    blockers: input.blockers ?? []
  };
  const outputPath = phase9EvidencePath(input.suiteId);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  return { ...bundle, path: outputPath };
}

export function readPhase9EvidenceBundle(suiteId: ValidationSuiteId): ValidationEvidenceBundle | null {
  const evidencePath = phase9EvidencePath(suiteId);
  if (!existsSync(evidencePath)) {
    return null;
  }
  return JSON.parse(readFileSync(evidencePath, "utf8")) as ValidationEvidenceBundle;
}

export function phase9EvidenceFilePath(suiteId: ValidationSuiteId): string {
  return phase9EvidencePath(suiteId);
}
