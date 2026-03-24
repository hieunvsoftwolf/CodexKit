# Phase 7 Session C Review Report

## Findings

### CRITICAL

1. Global active-plan fallback can mutate the wrong plan instead of recording `no active plan`.
   The new finalize seam resolves the target plan from the run first, but then falls back to the workspace-global `workflow.plan.active.path` setting. That makes `finalize` capable of syncing and rewriting an unrelated plan when the current run has no bound plan, which is the opposite of the explicit `no active plan` contract.
   Evidence:
   - [finalize-sync-back.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-sync-back.ts#L48) falls through to the global setting at lines 63-66.
   - [runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L118) exposes `finalize({ runId, planPathHint? })`, so this path is reachable for runs without a bound `planDir`.
   - [workflow-extended-and-release-spec.md](/Users/hieunv/Claude%20Agent/CodexKit/docs/workflow-extended-and-release-spec.md#L599) requires finalize to record `no active plan` and continue with docs/git handling.
   - [compatibility-matrix.md](/Users/hieunv/Claude%20Agent/CodexKit/docs/compatibility-matrix.md#L70) freezes active-plan state around run/plan context, not arbitrary workspace-global fallback.

### IMPORTANT

2. `cdx cook` now claims finalize completion before any test/review gate exists.
   Phase 7 docs require finalize after successful review and require the finalize entry to gather implementation, test, and review artifacts. The candidate calls finalize immediately after `post-implementation`, so the run can reach `completedThroughFinalize: true` with no test or review checkpoint evidence at all.
   Evidence:
   - [cook-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/cook-workflow.ts#L609) runs finalize immediately after the implementation boundary, and the approval-resume path does the same at lines 717-739.
   - [finalize-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-workflow.ts#L28) only gathers test/review artifacts if prior checkpoints already exist; this path provides none.
   - [workflow-extended-and-release-spec.md](/Users/hieunv/Claude%20Agent/CodexKit/docs/workflow-extended-and-release-spec.md#L69) says there is no success claim without fresh verification evidence, and [workflow-extended-and-release-spec.md](/Users/hieunv/Claude%20Agent/CodexKit/docs/workflow-extended-and-release-spec.md#L573) says `cdx cook` finalizes after successful review.
   - [phase-7-planner-decomposition-report.md](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md#L123) freezes the same ordering.
   - [runtime-workflow-wave2.integration.test.ts](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-wave2.integration.test.ts#L135) now codifies this earlier finalize path instead of catching it.

3. Sync-back can mark an entire phase complete from one coarse phase task, not from actual checklist-item completion.
   The candidate treats any completed parent phase task as authority to check every unchecked item in that phase. `cook --auto` then marks every parent phase task completed up front, so finalize can turn the whole plan to `completed` without any per-item evidence. That is optimistic stage-based reconciliation, not reconciliation from actual checkbox truth.
   Evidence:
   - [cook-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/cook-workflow.ts#L387) marks all phase tasks completed in auto mode.
   - [finalize-sync-back.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-sync-back.ts#L161) then checks every unchecked line for that phase at lines 165-170.
   - [phase-7-session-b0-spec-test-design.md](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md#L63) freezes plan status/progress as derived from checkbox truth, not optimistic workflow stage assumptions.
   - [runtime-workflow-phase7-finalize.integration.test.ts](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts#L103) currently asserts that auto cook leaves no unchecked boxes anywhere, which normalizes the optimistic behavior instead of testing task-to-checkbox correctness.

4. `plan.md` reconciliation blindly rewrites the whole `## Progress` section.
   The mutation boundary was supposed to be limited to defined reconciliation fields. Instead, any existing `## Progress` section is replaced wholesale with two lines, dropping any per-phase table or user-authored notes inside that section.
   Evidence:
   - [plan-files.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-files.ts#L174) rebuilds the entire section body and discards everything between `## Progress` and the next `## ` heading.
   - [phase-7-planner-decomposition-report.md](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md#L78) and [phase-7-planner-decomposition-report.md](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md#L164) freeze `plan.md` status/progress updates while forbidding blind rewrite of user-authored narrative.
   - [phase-7-session-b0-spec-test-design.md](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md#L77) also freezes per-phase completion visibility in `plan.md`, which this rewrite cannot preserve.

### MODERATE

5. `finalize-report.md` is contract-incomplete and the new tests do not check the missing fields.
   The report includes checkpoint names and artifact paths, but it omits the active `plan.md` path or explicit `no active plan`, and it does not give a concrete next action block for the operator. Those were frozen as minimum durable evidence. The new Phase 7 tests only look for checkpoint names and the word `approval`, so this gap will pass unnoticed.
   Evidence:
   - [finalize-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-workflow.ts#L84) does not emit the active plan path / `no active plan` line or an explicit next-action section.
   - [phase-7-session-b0-spec-test-design.md](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md#L128) freezes both fields as required finalize-report evidence.
   - [runtime-workflow-phase7-finalize.integration.test.ts](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts#L75) checks only checkpoint names, artifact basenames, and an approval word.

## Open Questions Or Assumptions

- Assumption: Phase 7 is still required to honor the published ordering contract for `cdx cook` even though public cook-to-test/review orchestration is incomplete elsewhere. If the intent changed, the Phase 7 docs and planner report need to be revised before this candidate can be called aligned.
- Assumption: the accepted mutation boundary for `plan.md` allows updating specific status/progress fields only, not replacing an entire `## Progress` section body wholesale.

## Change Summary

- Candidate adds the Phase 7 finalize seam, sync-back/docs/git artifact generation, and cook finalize wiring.
- Main risks are unsafe plan targeting, optimistic full-plan completion, and finalize completion claims that outrun verification/review ordering.
