# Phase 2 Remediation Session C Review Report

## Metadata
- Date: 2026-03-15
- Role/modal used: code-reviewer / Default
- Model used: GPT-5 / high
- Skill route: `security-best-practices`
- Branch reviewed: `phase2-s1-implement`

## Executive Summary

S1 closes the visible root-escape and protected-path enforcement gaps, the dirty-root overlay happy path, the default `context.json` launch propagation, and the requested negative coverage for `.git` and `.codexkit/runtime`. It does not fully close untracked patch completeness, stale/restart reclaim completeness, or the `NFR-7.1` and `NFR-7.2` evidence bar.

## CRITICAL

- None.

## IMPORTANT

### F-001 Untracked overlay deletions still disappear from `patch.diff`

- Severity: IMPORTANT
- Location:
  - `packages/codexkit-daemon/src/runner/artifact-capture.ts:85`
  - `packages/codexkit-daemon/src/runner/artifact-capture.ts:90`
  - `packages/codexkit-daemon/src/runner/artifact-capture.ts:94`
- Evidence:
  - `captureLaunchState()` correctly remembers pre-launch overlay files, and `changedFiles` still includes a deleted overlay file.
  - `buildPatch()` only emits untracked sections for paths still returned by `git ls-files --others --exclude-standard`.
  - If an overlay-sourced untracked file is deleted by the worker, it is no longer in the untracked list, gets routed into the tracked diff path, and produces no patch content.
- Reproduction:
  - I ran an ad hoc runtime repro using the current candidate code with a dirty-root untracked `notes.md`.
  - The worker deleted `notes.md`.
  - Result: `changed-files.json` contained `["notes.md"]`, but `patch.diff` was blank.
- Impact:
  - The claimed untracked patch completeness fix is still incomplete.
  - Reviewers lose durable diff evidence for one valid worker mutation shape: deletion of an overlay-replayed untracked file.
- Why this blocks closure:
  - The review objective explicitly called out untracked patch completeness.
  - This hole means the artifact contract is still lossy for a supported dirty-root path.

### F-002 Stale/restart reclaim logic still ignores pid liveness and launcher reconciliation

- Severity: IMPORTANT
- Location:
  - `packages/codexkit-core/src/services/worker-service.ts:108`
  - `packages/codexkit-daemon/src/runtime-kernel.ts:31`
  - `tests/runtime/runtime-core.integration.test.ts:92`
- Evidence:
  - `markStaleWorkers()` marks workers stale only from `lastHeartbeatAt` timeout.
  - `runReconciliationPass()` has no pid-exists check, no orphaned-child discovery after daemon restart, and no launcher-state reconciliation path.
  - The new reclaim test covers only the lease-not-expired stale timeout case, not the spec cases for missing pid, orphaned live child after restart, or unreconcilable launcher state.
- Spec mismatch:
  - `docs/worker-execution-and-isolation-spec.md:417` requires forced shutdown when the daemon restarts and finds an orphaned child still running.
  - `docs/worker-execution-and-isolation-spec.md:429` defines stale workers as including missing pid and launcher-state mismatch, not only missed heartbeats.
  - `docs/worker-execution-and-isolation-spec.md:446` requires reclaim to capture available evidence before requeue/release.
- Impact:
  - The "stale/restart reclaim completeness" blocker is not actually closed.
  - A restarted daemon has no implemented path to reconcile or kill an orphaned worker process before reclaiming the task.

### F-003 The `NFR-7.1` benchmark under-measures launch latency

- Severity: IMPORTANT
- Location:
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts:39`
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts:73`
  - `tests/runtime/runtime-worker-latency.integration.test.ts:61`
  - `tests/runtime/runtime-worker-latency.integration.test.ts:73`
  - `.tmp/nfr-7.1-launch-latency.json`
- Evidence:
  - `spawnedAt` is recorded immediately before `spawn(...)`.
  - Worktree creation, dirty-root overlay replay, launch-bundle writing, isolation-baseline capture, and launch-state capture all happen before `spawnedAt`.
  - The benchmark records `Date.now() - launched.spawnedAt`, so the expensive pre-spawn substrate work is excluded from the measured window.
- Spec mismatch:
  - `docs/non-functional-requirements.md:111` defines `NFR-7.1` as launch latency from approved spawn to first worker progress signal.
  - The current evidence measures only late-stage child startup to first output, not the end-to-end launch path the metric is meant to gate.
- Impact:
  - The JSON file exists and contains low numbers, but it is not valid evidence that `NFR-7.1` passed.

### F-004 The `NFR-7.2` benchmark bypasses dispatch entirely

- Severity: IMPORTANT
- Location:
  - `tests/runtime/runtime-worker-latency.integration.test.ts:96`
  - `tests/runtime/runtime-worker-latency.integration.test.ts:108`
  - `.tmp/nfr-7.2-dispatch-latency.json`
- Evidence:
  - After dependency clearance and reconciliation, the test itself calls `context.claimService.createClaim(...)`.
  - No scheduler or dispatcher path assigns the claim.
  - The sample therefore measures local test code plus direct repository writes, not ready-task dispatch latency.
- Spec mismatch:
  - `docs/non-functional-requirements.md:112` defines `NFR-7.2` as ready-task dispatch latency from dependency clearance to claim assignment on a warm daemon.
  - The current suite never exercises automatic dispatch.
- Impact:
  - The current `.tmp/nfr-7.2-dispatch-latency.json` file is not evidence that scheduler latency meets the requirement.

## MODERATE

- None.

## Verified Closures

- Root-escape and protected-path enforcement look materially improved and are covered by direct negative tests for root checkout, `.git`, and `.codexkit/runtime`.
- Supported dirty-root overlay replay now works for tracked plus untracked text happy paths and rejects unsupported binary dirty-root fixtures before launch.
- Default launch command now includes `--context-file <context.json>`.
- Runtime tests passed locally: `npm run test:runtime`
- Typecheck passed locally: `npm run typecheck`

## Commands Run

- `sed -n '1,220p' README.md`
- `sed -n '1,240p' docs/verification-policy.md`
- `sed -n '1,240p' docs/worker-execution-and-isolation-spec.md`
- `sed -n '1,240p' docs/non-functional-requirements.md`
- `sed -n '1,240p' docs/project-roadmap.md`
- `sed -n '1,220p' plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-wave-1-b0-spec-test-design.md`
- `sed -n '1,260p' plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-remediation-session-a-implementation-summary.md`
- `npm run test:runtime`
- `npm run typecheck`
- `TMPDIR=.tmp node --experimental-strip-types --input-type=module -e "<ad hoc overlay deletion repro>"`

## Unresolved Questions

- The prompt referenced prior artifacts `phase-2-wave-1-b-test-report.md`, `phase-2-wave-1-c-review-report.md`, and `phase-2-wave-1-d-verdict.md`, but those files were not present in this candidate tree. I proceeded from the current repo, Phase 2 docs, and the available handoff artifacts only.
