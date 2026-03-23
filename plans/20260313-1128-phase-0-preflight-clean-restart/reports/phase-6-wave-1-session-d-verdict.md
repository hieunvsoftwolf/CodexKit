# Phase 6 Wave 1 Session D Verdict

**Date**: 2026-03-23
**Phase**: Phase 6 Workflow Parity Extended
**Session**: D lead verdict
**Status**: blocked
**Role/Modal Used**: lead verdict / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `cfdac9eecc918672082ab4d460b8236e2aea9566`

## Decision

Fail the current Phase 6 Wave 1 candidate.

Wave 1 scope for this verdict is only:
- `P6-S0`
- `P6-S1`
- `P6-S2`
- `P6-S3`
- `P6-S4`

Deferred and not used as fail reasons by themselves:
- `P6-S5` `fix`
- `P6-S6` team runtime foundation
- `P6-S7` `cdx team`
- `P6-S8` Phase 6 closeout evidence

The fail is not based on missing Wave 2 work. It is based on in-scope Wave 1 contract misses that both independent verification and current repo inspection support.

## Weighting Used

Weighted in this order:
1. current candidate repo tree
2. frozen Phase 6 Wave 1 docs and planner scope
3. Session B tester artifact
4. Session C reviewer artifact
5. live targeted rerun on current tree

That weighting keeps the verdict tied to the current candidate while still treating tester and reviewer as primary independent evidence.

## Verification Considered

Reports considered:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-verdict-ready-after-s4-s5.md`

Live command rerun against current candidate:

```bash
TMPDIR=.tmp npx vitest run --no-file-parallelism \
  tests/runtime/runtime-workflow-phase6-cli.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-review.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-test.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-debug.integration.test.ts
```

Observed on current tree:
- pass: `tests/runtime/runtime-workflow-phase6-cli.integration.test.ts`
- fail: `tests/runtime/runtime-workflow-phase6-review.integration.test.ts`
- fail: `tests/runtime/runtime-workflow-phase6-test.integration.test.ts`
- fail: `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- reproduced failures: `4`
  - clean codebase review did not emit `no findings`
  - bare `cdx review` returned `WF_REVIEW_OPERATION_REQUIRED`
  - default `cdx test <context>` returned empty diagnostics in blocked/degraded scenario
  - `cdx debug ...` left `result.route` empty instead of `database`

## Verdict Mapping By Wave 1 Contract

### 1. `cdx review` remains canned, not repo-driven

Verdict: blocker for this wave.

Why it blocks Wave 1:
- `P6-S2` owns the review vertical and the final `review-report.md` findings contract.
- Phase 6 spec section `5.5` requires explicit `no findings` when the repo is clean.
- The current implementation fabricates findings from `buildFindings(...)` based on scope/context rather than repo state, so a clean codebase review still emits seeded `CRITICAL` / `IMPORTANT` / `MODERATE` findings.
- Session B reproduced this on the frozen B0 review contract. Current rerun reproduced it again.

Relevant contracts:
- `docs/workflow-extended-and-release-spec.md` section `5.5`
- Phase 6 outcome: `cdx review` produces severity-ordered findings with evidence and recommendations
- `NFR-5.2` terminal workflow artifact must reflect the actual run outcome, not synthetic success/failure shape

Evidence:
- `packages/codexkit-daemon/src/workflows/review-workflow.ts:46`
- `packages/codexkit-daemon/src/workflows/review-workflow.ts:190`
- `tests/runtime/runtime-workflow-phase6-review.integration.test.ts:24`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`

### 2. Bare `cdx review` chooser contract is broken

Verdict: blocker for this wave.

Why it blocks Wave 1:
- this sits inside `P6-S1` public CLI surface and `P6-S2` run-start scope resolution, both in scope for Wave 1
- spec section `5.2` requires a chooser when `cdx review` is invoked with no explicit operation
- current CLI hard-fails with `WF_REVIEW_OPERATION_REQUIRED` before any chooser or approval/pending state exists
- Session B reproduced the failure on the frozen B0 test. Current rerun reproduced it again.

Relevant contracts:
- `docs/workflow-extended-and-release-spec.md` section `5.2`
- `NFR-3.2` zero unnecessary operation prompts when the workflow should handle disambiguation through its own chooser path
- `NFR-5.2` because the terminal path is the wrong workflow outcome for an in-scope supported command

Evidence:
- `packages/codexkit-cli/src/workflow-command-handler.ts:161`
- `tests/runtime/runtime-workflow-phase6-review.integration.test.ts:50`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`

### 3. `cdx test` is synthesized, not evidence-driven, and default blocked/degraded diagnostics are missing

Verdict: blocker for this wave.

Why it blocks Wave 1:
- `P6-S3` owns preflight-first execution, delegated test execution, blocked/degraded behavior, and `test-report.md`
- Phase 6 build-on invariants require no success claim without fresh verification evidence
- current implementation derives failures from request text via `buildFailedTests(...)`, publishes synthetic totals/duration, and for the default no-prerequisite path returns no typed diagnostic at all
- Session B reproduced the default-path diagnostic gap. Review confirmed the deeper issue that the workflow is not actually executing preflight/test evidence.

Relevant contracts:
- `docs/workflow-extended-and-release-spec.md` sections `3`, `6.1`, `6.4`, `6.5`, `6.6`
- `NFR-3.3` typed blocking diagnostic with cause and concrete next step
- `NFR-5.2` durable terminal artifact or typed failure diagnostic must correspond to real execution state

Evidence:
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:38`
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:124`
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:188`
- `tests/runtime/runtime-workflow-phase6-test.integration.test.ts:22`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`

### 4. Bare `cdx test` chooser contract is also broken

Verdict: blocker for this wave.

Why it blocks Wave 1:
- this is pure `P6-S1` public command-surface scope and is explicitly required by spec section `6.2`
- current CLI hard-fails with `WF_TEST_OPERATION_REQUIRED` instead of routing into the required chooser between default and `ui`
- Session C surfaced it directly; current tree inspection confirms it
- even though B0 did not freeze this exact path, it is still an in-scope public-command contract miss in the candidate repo tree

Relevant contracts:
- `docs/workflow-extended-and-release-spec.md` section `6.2`
- `NFR-3.2`

Evidence:
- `packages/codexkit-cli/src/workflow-command-handler.ts:201`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`

### 5. Debug route is classified internally but not surfaced on the stable result contract

Verdict: blocker for this wave.

Why it blocks Wave 1:
- `P6-S4` owns branch dispatch and the publishable debug output surface
- the workflow computes branches and stores metadata, but the result contract returned to CLI does not expose a stable primary `route` field
- the frozen B0 debug contract requires `result.route === "database"` for the database scenario; Session B reproduced the failure and current rerun reproduced it again

Relevant contracts:
- `docs/workflow-extended-and-release-spec.md` section `8.3`
- planner slice `P6-S4`
- `NFR-5.2` durable terminal output must make the selected path inspectable enough for downstream handoff and verification

Evidence:
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts:146`
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts:229`
- `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts:23`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`

### 6. Generic non-cook approval continuation is still stubbed

Verdict: blocker for this wave.

Why it blocks Wave 1:
- `P6-S0` explicitly owns generic approval continuation plumbing for non-cook workflows
- Session A claimed this as implemented, but the repo tree still dispatches review/test/debug continuation into stub functions returning `null`
- this was not the reason the four frozen B0 tests failed, but it is still an in-scope Wave 1 contract miss and part of the shared runtime slice Wave 1 claimed to land
- once chooser/approval paths are restored for review/test, this gap becomes immediately user-visible

Relevant contracts:
- planner slice `P6-S0`
- `docs/workflow-extended-and-release-spec.md` section `3.2` plus shared Phase 6 workflow continuation expectations
- `NFR-6.1` and `NFR-6.4` directionally, because blocked/approval-pending continuation must remain durable and resumable

Evidence:
- `packages/codexkit-daemon/src/workflows/approval-continuation.ts:10`
- `packages/codexkit-daemon/src/workflows/review-workflow.ts:243`
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:250`
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts:242`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-c-review-report.md`

## What Still Passes In Wave 1

These remain accepted and were not used as fail reasons:
- unambiguous `review`, `test`, and `debug` command shapes enter the owning workflows without generic CLI usage failure
- invalid Phase 6 command shapes still return typed `CLI_USAGE` diagnostics
- `cdx test ui ...` degraded path emits a typed diagnostic when browser prerequisites are absent
- `cdx debug` records the expected checkpoint chain and publishes a durable `debug-report.md`
- Session A stayed inside the declared Wave 1 scope boundary; deferred `fix`, team runtime, `cdx team`, and Phase 6 closeout evidence were not required for this verdict

## Minimum Remediation Set

1. Replace canned review output with repo-driven review behavior so clean `cdx review codebase` can emit explicit `no findings` and non-clean runs derive findings from real repo evidence.
2. Implement the bare `cdx review` chooser path required by spec, including a resumable pending decision state before any review checkpoints start.
3. Replace synthesized `cdx test` outcome generation with real preflight/test execution evidence, and emit typed blocked/degraded diagnostics for the default no-prerequisite path.
4. Implement the bare `cdx test` chooser path required by spec instead of `WF_TEST_OPERATION_REQUIRED`.
5. Surface a stable primary debug route field in the public result contract, while keeping branch metadata/report artifacts intact.
6. Finish the generic non-cook approval continuation path for the Wave 1 workflows that now need chooser or approval-driven continuation.
7. Keep or extend verification so the existing four frozen B0 failures plus the bare `cdx test` chooser and non-cook continuation path are directly asserted.

## Next Routing Target

Next routing target: Phase 6 remediation Session A.

Required remediation scope:
- patch `P6-S0` generic approval continuation so review/test/debug resumptions are real, not stubs
- patch `P6-S1` chooser behavior for bare `cdx review` and bare `cdx test`
- patch `P6-S2` review execution so findings are repo-driven and clean codebase review can emit `no findings`
- patch `P6-S3` test execution so results and diagnostics come from real preflight/test evidence
- patch `P6-S4` result surface so debug route is stable and inspectable as `result.route`
- add/update verification for the remediation deltas without expanding into deferred Wave 2 scope

After remediation:
- rerun Session B against the frozen Wave 1 scope plus remediation-owned verification additions
- rerun Session C review on the remediated candidate
- return to Session D for a new verdict

## Next Runnable Wave

No new Phase 6 wave is runnable from this candidate.

Wave 2 remains blocked because Wave 1 is not accepted. The next runnable path is the Wave 1 remediation loop, not a move into `fix`, team runtime, `cdx team`, or Phase 6 closeout evidence.

## Unresolved Questions

- none
