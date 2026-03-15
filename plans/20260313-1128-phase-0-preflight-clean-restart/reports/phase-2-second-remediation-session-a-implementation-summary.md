# Phase 2 Second Remediation Session A Implementation Summary

## Metadata
- Date: 2026-03-15
- Role/modal used: debugger / Default
- Skill route: `security-best-practices`
- Branch: `phase2-s1-implement`
- Pinned `BASE_SHA`: `50b28fae3df63701189843b1b324d6a64fab991d`

## Scope
Implemented required fixes on candidate tree without changing phase docs or acceptance criteria:
- F-001 patch completeness for overlay-replayed untracked deletion
- F-002 restart-aware reclaim with pid liveness + orphan/launcher reconciliation + evidence
- F-003 NFR-7.1 benchmark window correction to approved-spawn -> first progress on real launch path
- F-004 NFR-7.2 benchmark path correction to dependency-clear -> scheduler dispatch claim assignment
- runtime verification stability hardening for child/stream cleanup

## Implemented Changes

### F-001: patch.diff now includes overlay-replayed untracked deletions
- Updated launch-state capture to persist per-path metadata (`checksum`, `untracked`, optional text content) so deleted overlay-untracked files still produce diff evidence.
- Added deletion patch synthesis for files that were launch-untracked and removed by worker.
- Preserved tracked + current-untracked patch generation.
- Files:
  - `packages/codexkit-daemon/src/runner/artifact-capture.ts`
  - `packages/codexkit-daemon/src/runner/worker-runtime-types.ts`
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- Test coverage:
  - `tests/runtime/runtime-worker-runtime.integration.test.ts`
  - Added case: `includes deletion patch when worker removes overlay-replayed untracked file`

### F-002: restart-aware reclaim with pid/orphan/launcher reconciliation + evidence
- Added reconciliation pass logic for active workers:
  - `pid-missing`
  - `pid-not-live`
  - `launcher-state-mismatch`
  - `orphaned-child-after-restart` (with forced kill attempt)
- Added durable reclaim evidence payload persisted into worker metadata and `worker.reclaim.reconciled` events.
- Reclaim flow now queues reclaim events, releases inactive claims, clears task ownership via existing claim release behavior, and recomputes run/task state.
- Files:
  - `packages/codexkit-daemon/src/runtime-kernel.ts`
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
- Test coverage:
  - `tests/runtime/runtime-core.integration.test.ts`
  - Added cases:
    - `reclaims running workers when recorded pid is not live`
    - `kills orphaned child after restart mismatch and reclaims ownership`
    - `reclaims launcher-state mismatches even when pid is still live`

### F-003: NFR-7.1 benchmark now measures approved-spawn -> first progress
- Benchmark timer start moved to immediately before `runtime.spawnWorker(...)` call.
- Window now includes pre-spawn substrate work in real launch path (worktree/overlay/launch bundle/isolation baseline/launch state).
- Files:
  - `tests/runtime/runtime-worker-latency.integration.test.ts`
  - `packages/codexkit-daemon/src/runner/worktree-manager.ts` (reduced avoidable git round-trips to keep launch path cost realistic but not inflated by redundant commands)

### F-004: NFR-7.2 benchmark now uses real dispatch path
- Added scheduler dispatch path in reconciliation (`dispatchReadyTasks`) instead of direct benchmark-side claim creation.
- Benchmark now measures dependency-clear timestamp to claim assigned by reconciliation path.
- Removed direct `createClaim` from benchmark measurement path.
- Files:
  - `packages/codexkit-daemon/src/runtime-kernel.ts`
  - `tests/runtime/runtime-worker-latency.integration.test.ts`

### Runtime verification stability hardening
- Added `WorkerRuntime.shutdownAll()` for deterministic cleanup in tests.
- Added fallback wait after forced SIGKILL in shutdown path.
- Track and close worker stdout/stderr streams during finalize to reduce open-handle leakage risk.
- Added stronger cleanup registration in runtime integration tests that spawn workers.
- Files:
  - `packages/codexkit-daemon/src/runner/worker-runtime.ts`
  - `tests/runtime/runtime-worker-runtime.integration.test.ts`
  - `tests/runtime/runtime-worker-isolation.integration.test.ts`
  - `tests/runtime/runtime-worker-latency.integration.test.ts`

## Verification
Required commands executed in required order:
1. `npm run test:runtime` -> pass (`7` files, `30` tests)
2. `npm run typecheck` -> pass
3. `npm run build` -> pass
4. `npm test` -> pass (`10` files, `40` tests)

Latest latency evidence artifacts:
- `.tmp/nfr-7.1-launch-latency.json`
  - `git-clean` p95: `4872ms`
  - `git-dirty-text` p95: `4457ms`
- `.tmp/nfr-7.2-dispatch-latency.json`
  - p95: `139ms`

## Notes
- `security-best-practices` skill applied to runtime-side secure defaults:
  - fail-closed reclaim behavior
  - explicit launcher-state validation
  - pid liveness checks before reclaim
  - durable evidence emission for failure/reclaim state
- No phase docs or acceptance criteria were modified.

## Unresolved Questions
- Required read-set file `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-2-second-remediation-reroute-after-s3-block.md` is not present in this candidate tree.
