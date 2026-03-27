# Phase 9 Third-Remediation Session D Verdict

- Date: 2026-03-26
- Status: completed
- Session Role: lead-verdict
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate Ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Verdict

- Phase verdict: `fail`

The third-remediation Phase 9 candidate still does not pass. The tester rerun matters and it does carry real weight: the scoped five-file Phase 9 suite passed twice in the required order, the contract-timeout fragility no longer appears, and the accepted `NFR-3.6` / `NFR-8.1` / provenance-stability repairs that were expected to stay fixed do appear intact. That is not enough to clear Phase 9 because the reviewer rerun's remaining blockers are both on required proof shape, and the current candidate code still supports those findings.

## Evidence Weighed

### CRITICAL

1. `NFR-6.3` is still not backed by the actual `plan -> cook` fresh-session handoff surface.
   - In `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`, the fresh session is real: `plan` runs, then `cook` is executed in a fresh process with `PHASE9_FRESH_SESSION_MARKER=1`.
   - But the accepted decisions being scanned for restatement still come from the separate `brainstorm -> plan` handoff bundle at lines `153-156` and `261-266`, not from a `plan -> cook` handoff bundle.
   - `packages/codexkit-daemon/src/workflows/brainstorm-workflow.ts` does emit accepted decisions in its bundle. `packages/codexkit-daemon/src/workflows/plan-workflow.ts` still emits only `handoffCommand`, not an accepted-decision handoff bundle for `plan -> cook`.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-0c30bd2b1eb2.md` records only that `2` upstream decisions were scanned against the fresh `cook` run and `0` restatement events were found. It does not prove those decisions were the ones actually handed from `plan` to `cook`.
   - Contract impact: `release-readiness-report.md` is still ahead of the evidence when it marks `NFR-6.3` as `pass`.

2. `NFR-7.4` is still evidenced by a synthetic benchmark, not an audit-grade comparable reliability workload.
   - In `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts`, every work item is always claimed, released, and completed; failed or retried counts are then derived from failed tasks and expired/superseded claims.
   - That leaves both sequential and parallel failure/retry rates structurally at `0.0000` in the benchmark's happy path.
   - The only parallel-specific behavior that changes order is the injected sleep at lines `62-64`, so the benchmark still manufactures divergence instead of measuring a real reliability tradeoff under comparable workload conditions.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-ed700a545888.md` shows reversed completion order with `0.0000` vs `0.0000` failure/retry rates. That is enough to satisfy the current test logic, but not enough to prove the `<= +10%` reliability budget against a meaningful sequential baseline.
   - Contract impact: `release-readiness-report.md` is still ahead of the evidence when it marks `NFR-7.4` as `pass`.

### MODERATE

1. The evidence helper still points at the older reroute snapshot instead of the current Wave 2 ready snapshot.
   - `tests/runtime/helpers/phase9-evidence.ts` still reads `control-state-phase-9-third-remediation-reroute-after-s14.md`.
   - The current durable Wave 2 snapshot is `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-third-remediation-wave-2-ready-after-sa.md`.
   - This did not re-break same-run candidate identity in the current workspace because both snapshots still carry the same pinned `BASE_SHA`, so I do not treat it as a decisive fail reason by itself.
   - It is still a provenance-hygiene defect and the Session A summary overstated that repair.

## Decision Rationale

I weigh the tester rerun as a strong positive signal for stability, but not as sufficient to pass the phase. The passing rerun shows the narrowed Phase 9 suite is repeatable and that several previously accepted fixes stayed intact. It does not overrule the reviewer rerun because the remaining reviewer blockers are not flaky-test issues or stylistic objections. They are proof-contract gaps on Phase 9-owned release evidence.

Under `docs/non-functional-requirements.md`, `docs/workflow-extended-and-release-spec.md`, and the frozen B0 mapping, Phase 9 cannot close while required metrics are promoted to `pass` on evidence that does not actually prove the required handoff surface (`NFR-6.3`) or a meaningful comparative reliability workload (`NFR-7.4`). The candidate therefore remains blocked.

## Minimum Next-Remediation Scope Only

Do not widen scope beyond Phase 9. The minimum next-remediation set is:

1. Replace the `NFR-6.3` proof with evidence taken from the real `plan -> cook` fresh-session handoff surface.
   - The accepted decisions measured for restatement must originate from the actual `plan -> cook` handoff payload or another equally contract-grade `plan`-owned continuation surface.
   - The durable artifact must make that provenance explicit.

2. Replace the `NFR-7.4` benchmark with an audit-grade comparable reliability workload.
   - Use the same workload shape for sequential and parallel runs.
   - Measure real failed/retried-task behavior or an equally valid reliability-loss signal under comparable execution, not a sleep-forced ordering difference with structurally zero failure/retry rates.

3. Correct the Phase 9 evidence helper provenance anchor.
   - Point `tests/runtime/helpers/phase9-evidence.ts` at the current third-remediation Wave 2 ready snapshot, not the older reroute snapshot.
   - Keep the existing same-run candidate-identity stabilization behavior intact.

4. Rerun only the narrowed Phase 9 verification chain after those repairs.
   - Session B tester rerun
   - Session C reviewer rerun
   - Session D verdict rerun

Preserve without reopening:

- `NFR-3.6` durable frozen trace source wiring
- accepted blocked `NFR-8.1` note-merge accuracy and honest one-version blocked behavior
- scoped contract-suite timeout stability
- same-run candidate identity stabilization
- durable migration checklist row evidence refs

## Unresolved Questions

- none
