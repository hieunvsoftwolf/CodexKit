# Phase 5 Wave 2 Session C Review Report

Date: 2026-03-22
Role/Modal Used: code-reviewer / Default
Status: completed
Source of truth reviewed:
- current Wave 2 candidate repo tree
- Phase 5 docs listed in the session prompt
- Wave 2 Session A summary as handoff context only

## Findings

### CRITICAL

1. `cdx cook` non-auto gates are dead ends; approving the gate does not resume the workflow or advance the checkpoint state.
- `runCookWorkflow` publishes the research/plan/implementation artifacts, then returns as soon as it creates a pending approval; it does not persist any continuation state beyond the approval id, and it does not record the pending checkpoint as current workflow state when the gate is still unresolved. See `packages/codexkit-daemon/src/workflows/cook-workflow.ts:195-225` and `packages/codexkit-daemon/src/workflows/cook-workflow.ts:281-371`.
- `approval respond` only resolves the approval row. It never re-enters `runCookWorkflow`, advances to the next stage, or records the approved checkpoint. See `packages/codexkit-daemon/src/runtime-controller.ts:295-297` and `packages/codexkit-core/src/services/approval-service.ts:121-190`.
- I confirmed this with a local repro under workspace `TMPDIR`: a `parallel` cook stopped at `post-research`; after `respondApproval(..., "approved")` and `recomputeRun`, the run still had `currentCheckpoint = "cook-mode"`, `runStatus = "pending"`, zero implementation tasks, and no resumed work.
- This breaks the Wave 2 claim that non-auto cook paths can continue through `post-research`, `post-plan`, and `post-implementation`, and it violates the cook gate-state invariant in `docs/workflow-parity-core-spec.md:75-133` and `docs/workflow-parity-core-spec.md:347-404`.

### IMPORTANT

2. Blocked `validate` and `red-team` still mutate archived plans, which violates archive immutability/history-preservation semantics.
- `runPlanValidateWorkflow` computes `status = "blocked"` for archived plans, but it still rewrites `plan.md` with a new `## Validation Log` section before returning. See `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:171-209`.
- `runPlanRedTeamWorkflow` does the same for archived plans: it returns `blocked`, but still rewrites `plan.md` with `## Red Team Review`. See `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:257-279`.
- That conflicts with the implementation’s own diagnostics (`Archived plans are immutable...`, `cannot be red-teamed in-place`) and with the Phase 5 spec requirement that archive must mark the plan archived without mutating historical report contents. See `docs/workflow-parity-core-spec.md:317-340`.
- I confirmed this with a local repro under workspace `TMPDIR`: after archive, running blocked `validate` added `## Validation Log`, and blocked `red-team` then added `## Red Team Review`.

3. Inline mutation history is not durable across repeated `validate` or `red-team` runs; the helper overwrites the prior section body instead of appending a durable log.
- `upsertH2Section` replaces everything between the matching `##` heading and the next `##` heading. See `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:63-88`.
- `appendPhaseSection` is built on the same helper, so repeated phase-note propagation also collapses to the latest single bullet. See `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts:90-94`.
- The spec explicitly requires the durable inline sections to be appended or updated as history-bearing artifacts, not replaced with a single latest entry. See `docs/workflow-parity-core-spec.md:275-276` and `docs/workflow-parity-core-spec.md:317-334`.
- I confirmed this with a local repro under workspace `TMPDIR`: running `validate` twice left the `Validation Log` with one timestamp entry, not an appended history.

4. The Phase 5 NFR evidence harness does not actually prove several of the metrics it claims to close, so it can emit a false-green evidence bundle.
- `NFR-1.3` is mapped to a second direct `hydratePlanTasks(...)` call in the same run/context, but the metric is about duplicate hydrations during explicit plan-path re-entry or resume. See `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts:68-71` versus `docs/non-functional-requirements.md:52-59`.
- `NFR-3.2` is mapped to `!("pendingApproval" in fastPlan)`, which does not prove absence of unnecessary mode or operation prompts. See `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts:80-81` versus `docs/non-functional-requirements.md:76-85`.
- `NFR-5.2` is mapped only to a successful auto cook that wrote `implementation-summary.md`; it does not cover typed failure diagnostic artifacts across terminal workflow runs, which is what the metric requires. See `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts:73-78` versus `docs/non-functional-requirements.md:95-103`.
- The same test writes `.tmp/phase-5-wave2-nfr-evidence.json` as closure evidence. See `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts:126-149`. Because the mappings are incomplete, downstream control-state can accept evidence that does not actually satisfy the owned NFR contract.

## Notes

- I did not find a clear regression in the accepted Wave 1 reuse/hydration pickup behavior itself; the existing Wave 1 and Wave 2 tests still target the expected reuse-first and partial-hydration fallback paths. The new risk is that Wave 2 now exposes additional cook gates whose continuation semantics are not implemented.
- No code edits were made. Review included static inspection plus small local reproductions under workspace `TMPDIR`.

## Unresolved Questions

- none
