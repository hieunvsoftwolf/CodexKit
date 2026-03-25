# Phase 8 Second-Remediation Session D Verdict

**Date**: 2026-03-25
**Phase**: Phase 8 Packaging and Migration UX
**Session**: D lead verdict rerun
**Status**: completed
**Role/Modal Used**: lead-verdict / default
**Model Used**: Codex / GPT-5
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Decision

Pass the second-remediation Phase 8 candidate.

The current tree closes both prior blocker contracts, the tester rerun passed the required frozen Phase 8 checks, and the reviewer rerun reported no findings. The only carried residual gap is limited unit-level isolation around preview-token fingerprint composition; that gap is real but non-blocking because the Phase 8 contract is satisfied by current implementation plus integration evidence.

Phase 8 is closed on the current candidate. No further Phase 8 remediation is required.

## Weighting Used

1. current second-remediation candidate repo tree
2. frozen Phase 8 docs and B0 acceptance context
3. second-remediation tester rerun report
4. second-remediation reviewer rerun report
5. prior remediation verdict context for the exact blocker pair

## Why This Now Passes

### 1. Resumed `plan` runs now return explicit plan-path continuation

The prior blocker was that `cdx resume <run-id>` could fall back to `cdx run show <run-id>` because the generated plan path was not persisted onto the originating plan run.

Current-tree evidence shows that gap is closed:
- [plan-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-workflow.ts#L109) writes the generated `written.planPath` and then writes it back into the run workflow state at [plan-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-workflow.ts#L112)
- [resume-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/resume-workflow.ts#L143) now prefers `state.activePlanPath` and emits `cdx cook <absolute-plan-path>`
- [runtime-workflow-phase8-cli.integration.test.ts](/Users/hieunv/Claude Agent/CodexKit/tests/runtime/runtime-workflow-phase8-cli.integration.test.ts#L315) asserts the `cdx plan ...` then `cdx resume <run-id>` continuation contract directly

Contract effect:
- satisfies the Phase 8 continuation requirement for explicit next-command recovery
- clears the Phase-owned continuity blocker against `NFR-1.5` and the remaining Phase 8 continuity hardening in `NFR-1` and `NFR-6`

### 2. `init` and `update` preview/apply authorization is now payload-bound

The prior blocker was that preview/apply authorization proved only path-level preview shape and not the actual managed-write payload later authorized by apply.

Current-tree evidence shows that gap is closed:
- [phase8-packaging-plan.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/phase8-packaging-plan.ts#L189) builds per-template `{ path, contentSha256 }` payload fingerprints from actual managed-file bytes
- [init-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/init-workflow.ts#L114) includes `payloadFingerprints` in the persisted preview fingerprint, and [init-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/init-workflow.ts#L316) blocks apply when the prior preview fingerprint no longer matches
- [update-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/update-workflow.ts#L99) includes the same payload-bound fingerprinting and [update-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/update-workflow.ts#L261) enforces the same mismatch block on apply
- [runtime-workflow-phase8-cli.integration.test.ts](/Users/hieunv/Claude Agent/CodexKit/tests/runtime/runtime-workflow-phase8-cli.integration.test.ts#L336) covers invalidation of prior preview authorization when the previewed payload fingerprint changes across invocations

Contract effect:
- satisfies the Phase 8 preview-before-apply safety bar
- clears the `NFR-4.3` blocker and closes the remaining Phase 8 packaging-safety gap

## Tester And Reviewer Weighting

Keep the tester rerun as valid contract evidence:
- the frozen B0 command order was preserved
- broad `npm run test:runtime -- ...` behavior remains rerun-noise only, not a Phase 8 blocker
- the targeted Phase 8 evaluation passed and covered the required second-remediation contract checks

Keep the reviewer rerun as decisive code-level evidence:
- reviewer reported no findings in the requested second-remediation scope
- current-tree inspection matches that report for both former blockers

No remaining Phase 8 contract risk outweighs the tester pass plus reviewer-clean result.

## Residual Non-Blocking Gap

Accepted as non-blocking follow-up only:
- coverage is still integration-heavy with limited unit-level isolation for preview-token fingerprint composition

Why it does not block Phase 8:
- the blocker was functional contract closure, not test-style preference
- the current integration evidence exercises the public Phase 8 behavior that the docs freeze
- no reviewer finding or current-tree inspection shows a live contract miss behind this gap

## Phase Call

- Phase 8 passes on the current second-remediation candidate
- Phase 8 can advance beyond remediation

## Minimum Next Routing Target

Minimum next routing target only:
- publish the next control-state snapshot marking Phase 8 as passed and routing to the required preflight or freeze gate before any Phase 9 high-rigor work starts

Do not reopen Phase 8 scope unless new contradictory evidence appears.

## Blockers

- none

## Unresolved Questions

- none
