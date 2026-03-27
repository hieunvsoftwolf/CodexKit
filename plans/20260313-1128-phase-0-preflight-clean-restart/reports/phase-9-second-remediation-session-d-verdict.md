# Phase 9 Second-Remediation Session D Verdict

- Date: 2026-03-26
- Status: completed
- Session Role: lead-verdict
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate Ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Verdict

- Phase verdict: `fail`

The second-remediation Phase 9 candidate still does not pass. The decisive issue is not the tester rerun timeout by itself. The decisive issue is that the reviewer rerun still shows claimed closure on required Phase 9 proof points that are not yet contract-grade, while the release synthesis still promotes those rows as `pass`.

## Evidence Weighed

### CRITICAL

1. `NFR-6.3` remains unsupported as a fresh-session continuation proof.
   - `docs/non-functional-requirements.md` requires `0` operator restatement events on `fresh-session-handoff` fixtures without transcript reuse.
   - The current golden test still runs `cook` immediately after `plan` inside the same test flow and derives `restatementEvents` from surfaces already present in that same run.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-e313a11acbf5.md` records only a continuation command string, inspected surface count, and `Restatement events detected: 0`; it does not show an executed fresh-session handoff proof.
   - Contract impact: Phase 9 cannot accept a `pass` row for `NFR-6.3` while the proof does not satisfy the fresh-session requirement.

2. `NFR-7.4` remains unsupported because the divergence comparison is invalid.
   - `docs/non-functional-requirements.md` defines `NFR-7.4` as a comparative reliability benchmark against the sequential baseline.
   - The current chaos benchmark compares `completionOrder` arrays built from different run-specific task ids, so `Execution paths diverged: true` can be satisfied just because the ids come from separate runs.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-673054707ab2.md` shows different opaque task ids, not a comparable order over shared task labels or positions.
   - Contract impact: the `NFR-7.4` `pass` row is still not audit-grade.

### IMPORTANT

1. `NFR-3.6` still lacks a captured frozen ClaudeKit trace artifact or durable source reference.
   - `docs/non-functional-requirements.md` says comparative metrics must use frozen reference traces captured on the same fixture family.
   - The current golden test compares the observed run only against the inline constant `FROZEN_CLAUDEKIT_PLAN_COOK_TRACE`.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-golden/golden-plan-cook-comparative-trace-57254d32868e.md` records the inline trace id and counts, but not a captured ClaudeKit trace artifact or durable source ref.
   - Contract impact: this is an evidence-shape gap on a required metric, so the `NFR-3.6` `pass` claim remains unsafe.

2. The scoped Phase 9 verification suite is still non-deterministic under full-run load.
   - Session B rerun failed the required scoped suite because `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts` timed out at the default `5s` budget during the full five-file run.
   - The isolated rerun passed, but only near the threshold (`4651ms` failing-case duration, `4947ms` file duration in the tester report).
   - Contract impact: this is a verification-stability defect, not a demonstrated runtime-behavior regression. It is not the primary reason for fail, but it means the required Phase 9 verification stack is still not reliably repeatable.

### MODERATE

1. Release synthesis still carries one inaccurate note on the accepted blocked `NFR-8.1` row.
   - `validation-migration` is accepted and `.tmp/phase9-host-matrix-smoke.json` honestly reports `status: blocked` with only one discovered real Codex CLI version.
   - `release-readiness-report.md` still leaves `no accepted evidence for metric` on the `NFR-8.1` row even though accepted blocked evidence exists.
   - Contract impact: the blocked status itself is honest and should stay blocked in this environment, but the note is inaccurate and should be repaired.

## Decision Rationale

I weigh the reviewer rerun blockers as decisive because they hit required Phase 9-owned proof contracts directly. Under `docs/non-functional-requirements.md` and `docs/workflow-extended-and-release-spec.md`, Phase 9 completion requires executable evidence, not narrative intent. The current candidate still promotes `NFR-6.3`, `NFR-7.4`, and effectively `NFR-3.6` as closed without audit-grade proof.

I weigh the tester rerun timeout as important but secondary. If the proof blockers above were fully closed, the timeout issue would still require one more narrow remediation because the required scoped suite cannot remain timing-fragile. It is not the strongest fail reason, but it is real verification debt and should be closed before the next verdict cycle.

I also preserve the fixes that are now valid and should not be reopened:

- same-run candidate identity stabilization across golden, chaos, migration, and release synthesis
- durable migration checklist row evidence refs
- honest blocked behavior for `NFR-8.1` when fewer than two real Codex CLI versions are available

## Minimum Next-Remediation Scope Only

Do not widen scope beyond Phase 9. The minimum next-remediation set is:

1. Replace the `NFR-6.3` proof with a real fresh-session continuation check.
   - Execute the handoff as an actual fresh-session re-entry path, then measure operator restatement events from that continuation surface.
   - The proof must show previously accepted upstream decisions were not restated after fresh-session handoff.

2. Replace the `NFR-7.4` divergence check with a comparable sequential-vs-parallel benchmark.
   - Compare shared task labels, positions, or another stable ordering surface that is meaningful across both runs.
   - Do not use cross-run opaque task ids as the divergence proof.

3. Back `NFR-3.6` with a captured frozen ClaudeKit trace artifact or durable source ref.
   - Keep the measured current-run comparison.
   - Replace the inline-only frozen reference with a durable captured reference on the same fixture family.

4. Repair the accepted-blocked note merge for `NFR-8.1`.
   - Keep the blocked status in this one-version environment.
   - Remove the inaccurate `no accepted evidence for metric` note when accepted blocked evidence exists.

5. Remove the scoped-suite timeout fragility in `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`.
   - The next tester rerun must be able to execute the required five-file Phase 9 suite deterministically under the normal full-run load for this scope.

6. Rerun only the narrowed Phase 9 verification chain after those repairs.
   - Session B tester rerun
   - Session C reviewer rerun
   - Session D verdict rerun

## Unresolved Questions

- none
