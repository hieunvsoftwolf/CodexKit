# Phase 5 Wave 2 Session D Verdict

**Date**: 2026-03-22
**Phase**: Phase 5 Workflow Parity Core
**Session**: D lead verdict
**Status**: blocked
**Role/Modal Used**: lead verdict / Default
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `df037409230223e7813a23358cc2da993cb6c67f`

## Decision

Fail the current Phase 5 Wave 2 candidate.

Session B's pass matters, but it does not outweigh Session C's repo-backed findings. The tester proved that direct Wave 2 command paths and accepted Wave 1 behavior still work under the exercised scenarios. The reviewer showed that the current tree still breaks required continuation semantics, archive immutability, durable inline history, and trustworthy Phase 5 NFR closure evidence. Those are blockers for Wave 2 closure.

Keep the original B0 report frozen. This verdict does not redefine the acceptance bar.

## Weighting Of Tester Pass Versus Reviewer Findings

Weight used for this verdict:

1. current Wave 2 candidate repo tree
2. frozen Phase 5 docs and frozen B0 acceptance
3. Session B and Session C artifacts as verification evidence

Why Session B is not enough to pass:

- Session B confirmed pending-gate creation and next-step guidance, but it did not prove that approving a non-auto `cook` gate resumes the run and advances checkpoints.
- Session B confirmed inline section presence, but not durable append semantics across repeated `validate` or `red-team` runs.
- Session B confirmed blocked archive diagnostics, but not immutability against blocked post-archive mutation.
- Session B confirmed the NFR harness emits a passing bundle, but Session C correctly showed that multiple metric mappings do not satisfy the actual owned NFR definitions.

## Reviewer Findings As Wave 2 Blockers

### 1. Non-auto `cdx cook` gate approvals are dead ends

Verdict: blocker.

Why it blocks Wave 2 closure:

- Phase 5 requires `cdx cook` to execute through the post-implementation boundary with real gate semantics, not just emit pending approvals.
- The current workflow returns immediately after creating a pending approval and does not persist resumable stage state that would let approval resolution continue the workflow.
- `approval respond` resolves only the approval row; it does not resume `runCookWorkflow`, advance the checkpoint, or complete the next stage.

Repo basis:

- `packages/codexkit-daemon/src/workflows/cook-workflow.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-core/src/services/approval-service.ts`

Spec basis:

- `docs/workflow-parity-core-spec.md` section 4.4
- `docs/workflow-parity-core-spec.md` `cdx cook` gate contract
- `docs/non-functional-requirements.md` `NFR-1.5`

### 2. Blocked `validate` and `red-team` still mutate archived plans

Verdict: blocker.

Why it blocks Wave 2 closure:

- Archive is supposed to preserve historical artifacts.
- The current implementation returns blocked status for archived plans but still rewrites `plan.md` with new inline sections.
- That contradicts both the emitted diagnostics and the archive immutability requirement.

Repo basis:

- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`

Spec basis:

- `docs/workflow-parity-core-spec.md` archive semantics for `cdx plan archive`

### 3. Inline validate/red-team history overwrites instead of appending durable history

Verdict: blocker.

Why it blocks Wave 2 closure:

- Wave 2 owns inline validate/red-team mutation semantics.
- The helper replaces the entire section body between matching `##` headings, so repeated runs collapse history to the latest entry.
- That is not durable inline audit history.

Repo basis:

- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`

Spec basis:

- `docs/workflow-parity-core-spec.md` inline validation and red-team durability requirements
- `docs/non-functional-requirements.md` `NFR-5.2`

### 4. Phase 5 NFR evidence harness can false-green incomplete metric coverage

Verdict: blocker.

Why it blocks Wave 2 closure:

- Phase 5 cannot be accepted unless its owned NFR metrics pass with executable evidence.
- The current harness over-claims `NFR-1.3`, `NFR-3.2`, and `NFR-5.2`; a green bundle from this harness is not sufficient closure evidence.
- This is not just a test-quality note. It blocks a phase-complete verdict because the evidence contract itself is incomplete.

Repo basis:

- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

Spec basis:

- `docs/non-functional-requirements.md` `NFR-1.3`
- `docs/non-functional-requirements.md` `NFR-3.2`
- `docs/non-functional-requirements.md` `NFR-5.2`
- `docs/workflow-parity-core-spec.md` section 3.1

## Blocker Order

1. Fix non-auto `cdx cook` continuation so approval resolution actually resumes the workflow and advances checkpoints through the remaining Phase 5 path.
2. Fix archived-plan immutability so blocked `validate` and `red-team` do not mutate archived `plan.md` or phase artifacts.
3. Fix inline validate/red-team durability so repeated runs append history instead of overwriting prior entries.
4. Fix the Phase 5 NFR evidence harness so each claimed metric is backed by the actual owned evidence contract.

## Reroute Target

Next reroute target: Phase 5 Wave 2 remediation Session A.

Required remediation scope:

- implement resumable non-auto `cook` gate progression after approval response
- prevent any blocked post-archive inline mutation
- change inline section mutation helpers to preserve append-style durable history
- correct the Phase 5 NFR harness and assertions for `NFR-1.3`, `NFR-3.2`, and `NFR-5.2`
- add or update tests that directly cover approval-resume behavior, archive immutability, repeated inline history accumulation, and truthful NFR evidence mapping

After remediation:

- rerun Session B against the frozen Wave 2 acceptance
- rerun Session C review on the remediated candidate
- return to Session D for a new verdict

## Wave 2 Closure Call

The Session C findings are blockers for Wave 2 closure.

Findings 1 through 3 are direct functional/spec violations in Wave 2-owned scope. Finding 4 blocks Phase 5 acceptance because the phase cannot close on false-green NFR evidence.

## Next Roadmap Phase

None yet.

Phase 5 is not accepted on the current Wave 2 candidate, so the roadmap must stay in the Phase 5 remediation loop rather than advance to the next roadmap phase.

## Unresolved Questions

- none
