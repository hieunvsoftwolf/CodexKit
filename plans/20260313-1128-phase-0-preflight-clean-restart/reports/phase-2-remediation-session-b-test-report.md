# Phase 2 Remediation Session B Test Report

## Metadata
- Date: 2026-03-15
- Role/modal used: tester / Default
- Branch under test: `phase2-s1-implement`
- Source of truth used: current candidate repo tree + Phase 2 docs/exit criteria
- Frozen B0 artifact executed first: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-wave-1-b0-spec-test-design.md`

## Required Read Set
Read before verification, in required order:
1. `README.md`
2. `docs/verification-policy.md`
3. `docs/worker-execution-and-isolation-spec.md`
4. `docs/non-functional-requirements.md`
5. `docs/project-roadmap.md`
6. `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-wave-1-b0-spec-test-design.md`
7. `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-remediation-session-a-implementation-summary.md`
8. `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-remediation-session-c-review-report.md`

## Required Command Order + Results
Commands run in exact required order:

1. `npm run test:runtime`
- Executed first unchanged.
- Runtime suites executed, but run was unstable across attempts:
  - one run showed all runtime suites passing in stream output
  - one run showed failure: `tests/runtime/runtime-worker-runtime.integration.test.ts` timeout in test `handles heartbeat, graceful shutdown, crash reclaim evidence, and retention cleanup` (`Test timed out in 30000ms`)
- Vitest process appears to hang after suite output in this environment, so final summary line not always emitted.

2. `npm run typecheck`
- Pass

3. `npm run build`
- Pass

4. `npm test`
- All listed suites in streamed output passed, including runtime + non-runtime suites.
- Same hang symptom after suite output; no final vitest trailer captured.

## Explicit Validation Of Handoff IMPORTANT Findings

### F-001 overlay-untracked deletion diff completeness
- Status: **not fixed**.
- Reproduced directly with ad hoc runtime repro:
  - dirty root had untracked `notes.md`
  - worker deleted `notes.md`
  - artifact result:
    - `changed-files.json` contains `["notes.md"]`
    - `patch.diff` is empty (`patchLength: 0`)
- Confirms deletion of overlay-sourced untracked file still disappears from diff evidence.

### F-002 stale/restart reclaim missing pid/orphaned-child/launcher reconciliation
- Status: **not fixed**.
- Code path still marks stale workers only by heartbeat timeout:
  - `packages/codexkit-core/src/services/worker-service.ts` (`markStaleWorkers`)
- Reconciliation flow still has no pid-liveness/orphan-child reconciliation stage:
  - `packages/codexkit-daemon/src/runtime-kernel.ts`
- Test coverage still only validates stale-timeout reclaim, not missing pid/orphaned child/launcher mismatch cases:
  - `tests/runtime/runtime-core.integration.test.ts`

### F-003 NFR-7.1 benchmark window excludes pre-spawn launch path
- Status: **still valid concern**.
- In runtime path, worktree creation + overlay + launch bundle + isolation baseline + launch-state capture happen before `spawnedAt`:
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- Benchmark sample uses `Date.now() - launched.spawnedAt`, so it excludes pre-spawn orchestration cost:
  - `tests/runtime/runtime-worker-latency.integration.test.ts`
- Evidence file exists but reflects narrower window:
  - `.tmp/nfr-7.1-launch-latency.json` (`git-clean p95=4196ms`, `git-dirty-text p95=1746ms`)

### F-004 NFR-7.2 benchmark bypasses actual scheduler dispatch
- Status: **still valid concern**.
- Benchmark directly calls `context.claimService.createClaim(...)` after dependency clearance:
  - `tests/runtime/runtime-worker-latency.integration.test.ts`
- This bypasses any autonomous dispatcher/scheduler claim path; measured time is not scheduler dispatch latency.
- Evidence file exists but not valid for NFR-7.2 claim:
  - `.tmp/nfr-7.2-dispatch-latency.json` (`p95=49ms`)

## B0 Expectation Mapping Snapshot
- AC-12 (`NFR-7.1`, `NFR-7.2`): evidence files present but methodology gaps remain (F-003/F-004), so not accepted as compliant evidence.
- AC-10 reclaim completeness: stale-timeout reclaim covered, but pid/orphan/launcher reconciliation remains unproven and likely missing (F-002).
- AC-06 patch completeness: still lossy for untracked overlay deletions (F-001).

## Verdict
- Session B status: **blocked**
- Reason:
  - unresolved IMPORTANT findings F-001..F-004 remain valid
  - frozen B0 expectations for reclaim completeness + latency evidence validity not yet satisfied
  - runtime suite stability issue (timeout/hang symptom) adds verification risk

## Commands Run (audit list)
- `npm run test:runtime` (multiple attempts; required first)
- `npm run typecheck`
- `npm run build`
- `npm test`
- `cat .tmp/nfr-7.1-launch-latency.json`
- `cat .tmp/nfr-7.2-dispatch-latency.json`
- `sed -n '1,260p' packages/codexkit-daemon/src/runner/artifact-capture.ts`
- `sed -n '1,260p' packages/codexkit-daemon/src/runtime-kernel.ts`
- `sed -n '1,240p' packages/codexkit-core/src/services/worker-service.ts`
- `sed -n '1,260p' tests/runtime/runtime-worker-latency.integration.test.ts`
- `TMPDIR=.tmp node --experimental-strip-types --input-type=module -e '<overlay deletion repro>'`

## Unresolved Questions
- Why vitest process sometimes hangs after suites complete in this environment; open-handle leak vs child-process cleanup issue?
- Should `NFR-7.1` timer start at approval/dispatch intent inside launcher entrypoint, or at first worktree-manager call, to match spec wording "approved spawn"?
- Is there a planned scheduler service path for `NFR-7.2`, or should the metric wording be narrowed if direct claim creation is intended for Phase 2?
