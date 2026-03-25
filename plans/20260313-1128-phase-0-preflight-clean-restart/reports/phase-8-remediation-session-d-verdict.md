# Phase 8 Remediation Session D Verdict

**Date**: 2026-03-25
**Phase**: Phase 8 Packaging and Migration UX
**Verdict**: fail
**Role/Modal Used**: lead-verdict / default
**Model Used**: Codex / GPT-5
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Decision

Phase 8 still fails on the remediated candidate.

The tester rerun is meaningful evidence: it shows the candidate materially fixed the earlier install-only, doctor drift, reclaim-blocked resume, protected-path, non-destructive, migration-assistant, and host-gap issues, and the broad `npm run test:runtime -- ...` rerun instability remains Phase-8-external noise only.

That tester pass does not overturn the remaining reviewer blockers because both uncovered gaps are still live in current code and both hit mandatory Phase 8 contracts:

- resumed `plan` runs still do not reliably surface the required explicit plan-path continuation command
- the `init` / `update` preview handshake still proves only path-level shape, not the actual write payload later authorized by apply

Under `docs/non-functional-requirements.md`, a failing mandatory Phase-owned metric is a phase blocker. Phase 8 cannot pass while either condition remains.

## Tester Pass Versus Reviewer Blockers

- keep the tester rerun as valid evidence that five of the original blocker areas are remediated
- keep the reviewer rerun as authoritative for the two remaining blocker areas because the tester coverage did not close them
- do not treat the broad `test:runtime` rerun noise as a Phase 8 blocker

Why the tester pass is not enough:

- the new Phase 8 integration suite covers pending-approval continuation and reclaim-blocked continuation, but it does not cover `cdx plan ...` followed by `cdx resume <run-id>` for explicit plan-path re-entry
- the new preview tests prove preview-before-apply gating exists, but they do not prove that the apply step is cryptographically or semantically bound to the exact operator-visible previewed file content

## Contract-Weighted Blockers

### 1. `IMPORTANT` Resumed `plan` continuation still regresses to `cdx run show <run-id>`

Why fail:

- `resume-workflow.ts` emits `cdx cook <absolute-plan-path>` only when `state.activePlanPath` already exists on the recovered run or when `run.commandLine` itself ends with `plan.md`
- `plan-workflow.ts` persists workflow state before the new plan path exists, copies only the prior global active-plan pointer into the run metadata, then writes the newly generated `written.planPath` only into global settings
- the current run metadata schema can store `activePlanPath`, but the new plan-run path is never written back into that run's workflow state

Current code evidence:

- `packages/codexkit-daemon/src/workflows/resume-workflow.ts:129-150`
- `packages/codexkit-daemon/src/workflows/plan-workflow.ts:88-95`
- `packages/codexkit-daemon/src/workflows/plan-workflow.ts:109-112`
- `packages/codexkit-daemon/src/workflows/workflow-state.ts:41-48`

Contract impact:

- violates the Phase 8 `cdx resume` rule that explicit continuation must be surfaced when workflow semantics require plan-path re-entry
- violates the compatibility contract that `cdx resume` plus explicit `cdx cook <absolute-plan-path>` re-entry both remain first-class
- fails mandatory continuity metrics:
  - `NFR-1.5`
  - remaining Phase 8 continuity hardening in `NFR-1`
  - Phase 8 continuity and handoff expectations tied to `NFR-6`

Verdict weight:

- sufficient by itself to fail Phase 8 because this is an in-scope public continuation path and the current wave is required to cover both entry and continuation

### 2. `IMPORTANT` `cdx init` / `cdx update` preview handshake remains content-blind

Why fail:

- the persisted preview fingerprint records repo state, approvals, blocked actions, and path-level preview metadata
- it does not include the actual managed-file payload or any stable checksum of that payload
- apply still writes `template.content` directly, so a later apply can remain authorized even if the bytes behind a managed write changed while the path-level preview shape stayed the same

Current code evidence:

- `packages/codexkit-daemon/src/workflows/init-workflow.ts:109-149`
- `packages/codexkit-daemon/src/workflows/update-workflow.ts:94-132`
- `packages/codexkit-daemon/src/workflows/phase8-packaging-plan.ts:172-179`
- `packages/codexkit-daemon/src/workflows/phase8-managed-content.ts:63-75`

Contract impact:

- Phase 8 shared packaging rules require previewed actions before apply, not a content-blind apply token
- `NFR-4.3` requires preview/apply flows to make the operator-visible mutation set explicit before mutation starts
- this closes the original mutate-before-preview bug only partially; it does not yet fully bind apply to the operator-visible preview the remediation summary claims

Verdict weight:

- additional Phase 8 blocker
- not Phase 9 work; this remains inside Phase 8 packaging safety scope

## Minimum Next-Remediation Scope

Only this minimum Phase 8 scope should be remediated next:

1. persist the newly generated plan path into the plan run's workflow state and make `cdx resume` return `cdx cook <absolute-plan-path>` for resumed `plan` runs
2. add verification that covers `cdx plan <task>` followed by `cdx resume <run-id>` and fails if continuation falls back to `cdx run show <run-id>`
3. bind `cdx init` and `cdx update` apply authorization to the actual previewed write payload, not only path/disposition metadata
4. include a stable checksum or equivalent payload fingerprint for each managed write in the preview-state comparison and reject apply when that payload changes after preview
5. add verification that a content change between preview and apply invalidates the prior preview token

Explicit non-scope:

- no Phase 9 widening
- no unrelated runtime or importer cleanup
- no attempt to turn the broad `npm run test:runtime -- ...` instability into a Phase 8 blocker unless it directly blocks the exact remediation rerun commands

## Final Outcome

- Phase 8 does not pass on the remediated candidate
- the tester rerun pass stands, but it is not sufficient to clear the remaining reviewer-confirmed continuation and preview-binding blockers
- Phase 8 must stay blocked from advancement

## Unresolved Questions

- none
