# Phase 7 Session D Verdict

**Date**: 2026-03-24
**Phase**: Phase 7 Plan Sync, Docs, and Finalize
**Session**: D lead verdict
**Status**: blocked
**Role/Modal Used**: lead verdict / Default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`

## Decision

Fail the current Phase 7 candidate.

The tester pass stands for the frozen checks it executed. It does not override the reviewer findings because current-tree inspection confirms the highest-impact findings are real Phase 7 contract misses, not style disputes or out-of-scope follow-up. The candidate still violates active-plan targeting, `cdx cook` finalize ordering, sync-back truth sourcing, safe `plan.md` mutation boundaries, and minimum durable finalize evidence.

## Weighting Used

1. current candidate repo tree
2. frozen Phase 7 docs, planner artifact, and control-state snapshot
3. Session B tester report
4. Session C reviewer report

No new Session D test run was needed for verdict. The blocking calls are visible from the current candidate code and the frozen Phase 7 contracts.

## Evidence Considered

Reports:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-7-verdict-ready-after-s4-s5.md`

Primary Phase 7 contract anchors:
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`

Current-tree seams inspected:
- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts`
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts`
- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`

## Verdict Mapping By Contract Impact

### 1. Global active-plan fallback is a release-blocking Phase 7 contract miss

Verdict: blocker.

Why it blocks:
- Phase 7 sync-back must use the active plan for the run or record explicit `no active plan`.
- Current code falls through from the run-bound plan to the workspace-global `workflow.plan.active.path`.
- That lets finalize mutate an unrelated plan when the current run has no bound plan, which is worse than a missing feature because it can corrupt the wrong durable plan state.

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:48-67`
- `packages/codexkit-daemon/src/runtime-controller.ts:126-135`

Frozen contract:
- `docs/workflow-extended-and-release-spec.md:593-600`
- `docs/compatibility-matrix.md:70`

Phase impact:
- breaks the explicit `no active plan` branch
- breaks Phase 7 sync-back safety
- breaks Phase 7 `NFR-5` auditability because the wrong plan can be rewritten without truthful targeting evidence

### 2. `cdx cook` finalize timing is earlier than the frozen contract allows

Verdict: blocker.

Why it blocks:
- Phase 7 says finalize for `cdx cook` runs after successful review.
- Phase 6-9 build-on rules also say there is no success claim without fresh verification evidence.
- Current `cook` auto and approval-resume paths call finalize immediately after `post-implementation`, then return `completedThroughFinalize: true` even when no test or review checkpoint artifacts exist.

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts:624-644`
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts:717-739`
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts:28-41`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts:129-156`

Frozen contract:
- `docs/workflow-extended-and-release-spec.md:59-66`
- `docs/workflow-extended-and-release-spec.md:569-587`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md:123-131`

Phase impact:
- false finalize-complete success claim
- finalize entry lacks the required implementation/test/review evidence set
- tester pass does not clear this because the current tests were shaped around the earlier finalize path

### 3. Sync-back derives completion from coarse phase-task completion instead of task-to-checkbox truth

Verdict: blocker.

Why it blocks:
- Phase 7 exit criteria require completed tasks to sync back to relevant phase files and `plan.md` status/progress to update correctly.
- B0 froze that reconciliation as checkbox-truth-driven, not optimistic stage-driven.
- Current auto cook marks parent phase tasks completed first, and sync-back then uses one completed parent phase task as permission to check every remaining item in that phase.

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts:387-395`
- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:161-170`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts:87-115`

Frozen contract:
- `docs/workflow-extended-and-release-spec.md:593-597`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md:63-84`

Phase impact:
- full-plan sync-back can report `completed` without per-item proof
- `plan.md` progress can become optimistic instead of truthful
- the current Phase 7 test normalizes the bug by asserting that auto cook leaves no unchecked boxes anywhere

### 4. `plan.md` reconciliation rewrites the whole `## Progress` section body

Verdict: blocker.

Why it blocks:
- Phase 7 allowed status/progress reconciliation, not blind overwrite of user-authored progress content.
- Current helper replaces everything between `## Progress` and the next heading with two generated lines.
- That loses per-phase table content or user notes inside the managed section, which the planner report explicitly said to preserve.

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/plan-files.ts:174-202`

Frozen contract:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md:78-88`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md:164-170`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md:77-84`

Phase impact:
- mutation boundary is too broad for finalize-owned sync-back
- durable `plan.md` progress visibility is not preserved safely

### 5. `finalize-report.md` is still contract-incomplete

Verdict: blocker.

Why it blocks:
- `finalize-report.md` is mandatory Phase 7 terminal evidence.
- B0 froze minimum required fields, including active `plan.md` path or explicit `no active plan` and an explicit next action for the operator.
- Current report omits those fields, and current tests do not assert them.

Current-tree evidence:
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts:84-136`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts:75-81`

Frozen contract:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md:128-141`
- `docs/project-roadmap.md:272-277`
- `docs/non-functional-requirements.md:91-98`

Phase impact:
- Phase 7 `NFR-5` terminal evidence is incomplete
- tester pass is not enough because the verification file did not cover the required fields

## Tester Pass Weighting

The Session B pass remains valid for what it checked:
- mandatory artifact presence
- no-auto-commit
- current finalize checkpoint order
- current full-plan completion behavior

It does not clear acceptance because:
- the highest-risk defect is a no-active-plan safety miss that B0 did not exercise directly
- the current tests encode the optimistic phase-complete shortcut and the earlier finalize timing instead of challenging them
- Phase 7 acceptance is contract-based, not test-count-based

## Minimum Remediation Scope

Keep remediation strictly inside Phase 7:

1. Remove workspace-global active-plan fallback from finalize targeting.
   Allowed sources: explicit finalize hint, run-bound `planDir`, or same-run workflow state.
   If none exist, finalize must record `no active plan` and continue with docs/git only.

2. Make `cdx cook` finalize ordering honest to the frozen contract.
   Finalize must not run or claim completion before the run has the required review-stage evidence.
   Update result semantics and verification so `completedThroughFinalize` cannot go true on a pre-review path.

3. Replace coarse phase-complete sync-back with safe task-to-checkbox reconciliation.
   Do not check an entire phase from one parent phase task.
   When mapping is not provable, emit `unresolved-mapping-report.md` and leave unchecked items intact.

4. Narrow the `plan.md` mutation boundary.
   Update only explicit managed status/progress fields or a dedicated managed block.
   Do not wipe arbitrary existing `## Progress` body content.

5. Complete the `finalize-report.md` contract and Phase 7 verification coverage.
   Add active plan path or explicit `no active plan`, explicit next action, and direct assertions for the missing fields and no-active-plan path.

## Next Routing Target

Next routing target: Phase 7 remediation Session A.

Required remediation scope only:
- `P7-S0` finalize targeting and finalize summary contract completion
- `P7-S1` truthful sync-back mapping and `plan.md` mutation boundary fix
- `P7-S4` cook finalize ordering and completion-state fix
- `P7-S5` verification updates for no-active-plan, contract-complete finalize report, and non-optimistic sync-back assertions

Do not widen into Phase 8 packaging, migration UX, or Phase 9 release hardening.

After remediation:
- rerun Session B against the frozen Phase 7 bar plus remediation-owned verification additions
- rerun Session C review on the remediated candidate
- return to Session D for a new verdict

## Blockers

- unsafe global active-plan fallback in finalize
- finalize runs before required cook review/test evidence
- sync-back can fabricate full phase completion from coarse phase-task state
- `plan.md` progress rewrite exceeds the allowed mutation boundary
- `finalize-report.md` misses required durable evidence fields

## Unresolved Questions

- none
