# Phase 7 Remediation Session D Verdict

**Date**: 2026-03-24
**Phase**: Phase 7 Plan Sync, Docs, and Finalize
**Session**: D remediation lead verdict
**Status**: blocked
**Role/Modal Used**: lead-verdict / default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`

## Decision

Fail the remediated Phase 7 candidate.

The tester rerun pass stands for the checks it executed. It does not clear acceptance because the reviewer blocker remains real in the current tree: explicit `planPathHint` is still accepted without validating that it resolves to `plan.md`, so finalize can rewrite the wrong durable file.

## Weighting Used

1. current remediated candidate repo tree in `/Users/hieunv/Claude Agent/CodexKit`
2. current control-state snapshot and Phase 7 rerun artifacts
3. frozen Phase 7 contract docs and prior verdict context
4. remediation Session B tester rerun
5. remediation Session C reviewer rerun

The tester rerun is strong evidence that the implemented fixes closed the originally tested gaps. It is not sufficient to override a remaining durable-state integrity defect that is directly visible in current code and still violates the frozen Phase 7 contract.

## Evidence Considered

Reports:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-7-remediation-verdict-ready-after-sb-sc.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-remediation-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-remediation-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-remediation-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-d-verdict.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md`

Primary contract anchors:
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Current-tree seams inspected:
- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

## Verdict Basis

### Tester rerun weight

The Session B rerun passed the required checks it executed:
- explicit `no-active-plan` path
- non-optimistic sync-back and unresolved mapping emission
- managed `## Progress` preservation
- mandatory finalize artifacts
- contract-complete `finalize-report.md`
- explicit no-auto-commit behavior
- honest pre-review finalize semantics and evidence gating

That pass remains valid and should be retained.

### Reviewer blocker weight

The remaining reviewer blocker is acceptance-blocking.

Why:
- Phase 7 sync-back is defined against the active plan dir and `plan.md`, or explicit `no active plan`, not an arbitrary existing markdown file in that directory. `docs/workflow-extended-and-release-spec.md:593-599`
- Phase 7 exit criteria require `plan.md` status and progress to update correctly. `docs/project-roadmap.md:274-277`
- Phase 7 also carries `NFR-5` durable evidence and auditability obligations, so mutating the wrong durable file is not a harmless edge case. `docs/non-functional-requirements.md:119-125`

Current-tree confirmation:
- `resolvePlanPath(...)` still accepts any existing `input.planPathHint` and returns it directly without checking that the basename is `plan.md`. `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:46-49`
- `RuntimeController.finalize(...)` exposes that raw `planPathHint` directly to finalize. `packages/codexkit-daemon/src/runtime-controller.ts:126-133`
- finalize then reads and rewrites the resolved target via `upsertPlanStatusProgress(...)` as though it were the durable plan file. `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:212-217`
- current Phase 7 tests do not include a negative assertion that rejects non-`plan.md` hints. `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts:66-137`

This means the remediation closed the old workspace-global fallback, but did not fully close finalize targeting safety. A malformed or hostile explicit hint can still redirect durable plan mutation into a phase file or other non-`plan.md` file.

## Decision Mapping

### Pass/Fail

Fail.

### Why the tester pass does not override the blocker

- The tester rerun proves the remediated candidate satisfies the tested acceptance paths.
- The reviewer blocker is a narrower but higher-severity contract miss: wrong-file durable mutation remains possible through a public finalize entrypoint.
- Acceptance for Phase 7 is contract-based, not test-count-based. A remaining durable-state integrity defect in finalize targeting keeps the candidate below the Phase 7 bar.

## Minimum Second-Remediation Scope

Keep scope strictly inside Phase 7.

1. Restrict explicit finalize hints to the active durable `plan.md` target only.
   - `planPathHint` must be rejected or treated as no-plan unless it resolves to `plan.md`.
   - Do not allow finalize sync-back to target `phase-*.md` or arbitrary markdown files.

2. Preserve current remediation wins.
   - Do not regress no-active-plan handling.
   - Do not regress non-optimistic sync-back.
   - Do not regress managed `## Progress` preservation.
   - Do not regress finalize report fields, docs impact, git handoff, or no-auto-commit behavior.

3. Add direct verification for the remaining blocker.
   - Add a negative test that calls finalize with a non-`plan.md` hint and proves finalize does not rewrite that file as the durable plan target.
   - Assert the resulting behavior is either explicit rejection or `no-active-plan`, whichever implementation path is chosen, but it must not report success against a non-`plan.md` path.

Do not widen into Phase 8 or Phase 9.

## Next Routing Target

Next routing target: Phase 7 second remediation Session A.

Required remediation scope only:
- finalize explicit hint validation to `plan.md`
- verification coverage for hostile or malformed non-`plan.md` hints

## Blockers

- explicit `planPathHint` is not validated to `plan.md`, so finalize can still rewrite the wrong durable file

## Unresolved Questions

- none
