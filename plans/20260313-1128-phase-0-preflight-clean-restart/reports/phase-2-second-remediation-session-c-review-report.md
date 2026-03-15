# Phase 2 Second Remediation Session C Review Report

## Metadata
- Date: 2026-03-15
- Role/modal used: code-reviewer / Default
- Model used: GPT-5 / high
- Skill route: `security-best-practices`
- Source of truth: current candidate repo tree in `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement` on branch `phase2-s1-implement`

## Executive Summary

Second remediation materially improves the candidate. `F-001` is closed, `F-004` is closed, and the `F-003` methodology gap is closed because the launch benchmark now measures the real approved-spawn to first-progress window. The phase is still not clean: reclaim still violates the spec ordering for orphan shutdown and evidence capture, the real-path `NFR-7.1` benchmark failed in this review run, and `npm run test:runtime` did not terminate cleanly after printing suite results.

## CRITICAL

- None.

## IMPORTANT

### F-002 is only partially fixed: orphan reclaim still releases ownership before kill completion or evidence-capture timeout

- Severity: IMPORTANT
- Location:
  - `packages/codexkit-daemon/src/runtime-kernel.ts:80`
  - `packages/codexkit-daemon/src/runtime-kernel.ts:92`
  - `packages/codexkit-daemon/src/runtime-kernel.ts:153`
  - `packages/codexkit-daemon/src/runtime-kernel.ts:178`
  - `packages/codexkit-core/src/services/claim-service.ts:62`
  - `packages/codexkit-core/src/services/claim-service.ts:75`
  - `tests/runtime/runtime-core.integration.test.ts:161`
  - `tests/runtime/runtime-core.integration.test.ts:204`
- Evidence:
  - `reconcileWorkerRuntimeState()` sends `SIGKILL` and immediately marks the worker `failed`, stores metadata evidence, and returns a reclaim decision.
  - In the same reconciliation pass, `reclaimInactiveWorkerClaims()` releases the active claim, and `dispatchReadyTasks()` can assign ready work before the killed pid is proven dead.
  - The reclaim tests only assert reason tagging and kill-attempt metadata; they do not assert the spec-required ordering of `kill/evidence capture -> reclaim/requeue`.
- Spec mismatch:
  - [docs/worker-execution-and-isolation-spec.md](/Users/hieunv/Claude%20Agent/Claudekit-GPT/docs/worker-execution-and-isolation-spec.md#L421) requires forced shutdown to start reclaim only after evidence capture finishes or times out.
  - [docs/worker-execution-and-isolation-spec.md](/Users/hieunv/Claude%20Agent/Claudekit-GPT/docs/worker-execution-and-isolation-spec.md#L446) requires reclaim flow step 1 to capture available evidence before claim release and task requeue.
- Impact:
  - A restarted daemon can acknowledge an orphaned worker, send `SIGKILL`, and still reopen the task for another worker before the orphan is confirmed gone.
  - That leaves the implementation short of the restart-safe reclaim contract the fix claimed to close.

### Real-path `NFR-7.1` benchmarking is now valid, but it failed in the independent review run

- Severity: IMPORTANT
- Location:
  - `tests/runtime/runtime-worker-latency.integration.test.ts:63`
  - `tests/runtime/runtime-worker-latency.integration.test.ts:75`
  - `tests/runtime/runtime-worker-latency.integration.test.ts:82`
- Evidence:
  - The timer now starts immediately before `runtime.spawnWorker(...)` and stops at the first real stdout progress signal, so the benchmark window matches the Phase 2 contract.
  - On this review run, `npm run test:runtime` failed with:
    - `tests/runtime/runtime-worker-latency.integration.test.ts`
    - `expected 8304 to be less than or equal to 8000`
- Spec reference:
  - [docs/non-functional-requirements.md](/Users/hieunv/Claude%20Agent/Claudekit-GPT/docs/non-functional-requirements.md#L148) defines `NFR-7.1` as `p95 <=8s` from approved spawn to first worker progress signal.
- Impact:
  - `F-003` as a validity bug is closed, but the Phase 2 `NFR-7.1` exit gate is still not satisfied on the reviewer run.
  - The second-remediation summary’s pass claim is therefore not durable enough for Session D.

### Runtime verification still has a process-stability problem: `npm run test:runtime` printed all suites but did not exit

- Severity: IMPORTANT
- Location:
  - `tests/runtime/runtime-daemon.integration.test.ts:104`
  - `tests/runtime/runtime-daemon.integration.test.ts:125`
  - `packages/codexkit-cli/src/index.ts:10`
  - `packages/codexkit-daemon/src/runtime-daemon.ts:18`
- Evidence:
  - After all runtime suites printed their results, the `npm run test:runtime` command remained live for more than 20 seconds and never returned control.
  - An independent process-list check during the hang still showed repo-scoped `daemon start --foreground` processes alive under the candidate tree.
  - The current runtime suite explicitly starts detached daemon processes in `runtime-daemon.integration.test.ts`, and the CLI detach path spawns a long-lived foreground daemon process.
- Impact:
  - The requested “no hang/open-handle regression” outcome is not proven.
  - Runtime verification remains vulnerable to hangs or leaked daemon processes, which weakens both local review confidence and CI suitability.

## MODERATE

- None.

## Verified Closures

- `F-001` appears closed.
  - `packages/codexkit-daemon/src/runner/artifact-capture.ts:125` now synthesizes a deletion patch for overlay-replayed untracked files that disappear before artifact capture.
  - `tests/runtime/runtime-worker-runtime.integration.test.ts:80` passed in the review run and specifically exercised the deleted overlay-untracked-file path.
- `F-004` appears closed.
  - `tests/runtime/runtime-worker-latency.integration.test.ts:108` now measures dependency-clearance to claim assignment through `runReconciliationPass(...)` instead of direct benchmark-side claim creation.
  - The `NFR-7.2` latency test passed in the review run.
- `F-003` as a benchmark-window validity issue appears closed.
  - `tests/runtime/runtime-worker-latency.integration.test.ts:63` starts timing before `spawnWorker(...)`.
  - `tests/runtime/runtime-worker-latency.integration.test.ts:75` waits for first progress on the real worker log path.

## Commands Run

- `sed -n '1,220p' README.md`
- `sed -n '1,240p' docs/verification-policy.md`
- `sed -n '1,260p' docs/worker-execution-and-isolation-spec.md`
- `sed -n '1,240p' docs/non-functional-requirements.md`
- `sed -n '1,240p' docs/project-roadmap.md`
- `sed -n '1,260p' plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-wave-1-b0-spec-test-design.md`
- `sed -n '1,260p' plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-remediation-session-c-review-report.md`
- `sed -n '1,260p' plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-remediation-session-b-test-report.md`
- `sed -n '1,260p' plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-2-second-remediation-session-a-implementation-summary.md`
- `git branch --show-current`
- `git rev-parse HEAD`
- `git status --short`
- `npm run test:runtime`
- `ps -axo pid,ppid,stat,etime,command | rg "vitest run tests/runtime|Claudekit-GPT-phase1-s1-implement|setInterval\\(\\)=>\\{},1000|node .*tests/runtime|worker-runtime"`

## Unresolved Questions

- The review run showed a post-suite hang, but I did not fully root-cause whether the surviving daemon processes are the only reason the Vitest parent never exits.
- The candidate branch is an uncommitted working tree on top of `50b28fae3df63701189843b1b324d6a64fab991d`; Session D should judge against the current tree, not the commit id alone.
