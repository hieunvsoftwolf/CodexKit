# Phase 9 Fourth-Remediation Session D Verdict

- Date: 2026-03-27
- Status: completed
- Session Role: lead-verdict
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate Ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Verdict

- Phase verdict: `fail`

The fourth-remediation Phase 9 candidate still does not pass. The tester rerun is a meaningful positive signal: the scoped five-file Phase 9 suite stayed green, the intended `NFR-6.3` and `NFR-7.4` artifacts were regenerated, and the preserved fixes the rerun was supposed to keep intact still look intact. That does not clear the phase because the reviewer rerun's remaining blockers are still contract-grade defects in the proof itself, and the current candidate code supports those findings.

## Evidence Weighed

### CRITICAL

1. `NFR-6.3` is still not proven against the raw `plan -> cook` handoff strings the operator actually receives.
   - The real plan-owned continuation surface is the `plan` workflow output fields `handoffCommand`, `planPath`, `mode`, and `diagnostics[].nextStep` in `packages/codexkit-daemon/src/workflows/plan-workflow.ts`.
   - The current proof does not scan those raw values directly. `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts` first rewrites them into synthetic narrative strings such as `Execute the plan-owned continuation command exactly as emitted: ...` and `Preserve plan-selected continuation mode for cook: ...`, then counts a restatement only when downstream text includes those rewritten sentences.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-2552c65c3cee.md` confirms that the accepted decisions scanned are those paraphrased sentences, not the raw emitted command/path/mode/next-step strings.
   - Contract impact: `docs/non-functional-requirements.md` requires `0` operator restatement events for previously accepted upstream decisions already present upstream. A proof that can miss restatements of the real handoff strings does not satisfy that metric, so `release-readiness-report.md` is still ahead of the evidence when it marks `NFR-6.3` as `pass`.

2. `NFR-7.4` is still evidenced by a scripted retry budget, not by emergent comparative reliability behavior under comparable sequential versus parallel load.
   - `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts` hard-codes `RELIABILITY_RETRY_BUDGETS = [1, 0, 1, 0]` and then forces each task to emit exactly that many expired claims before completion.
   - Both sequential and parallel runs therefore inherit the same preloaded retry count, and the measured `failedOrRetried` value is effectively `failedTasks + retryEvents` from that scripted budget rather than a runtime-dependent reliability signal caused by contention, reclaim pressure, or another parallelism-sensitive failure mode.
   - The durable artifact `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-205ba0d718c8.md` shows the self-fulfilling outcome: both runs report `2` retry events and the same `0.5000` rate.
   - Contract impact: `docs/non-functional-requirements.md` requires the parallel payoff benchmark to introduce no more than `10%` additional failed or retried tasks versus the sequential baseline. A benchmark whose reliability delta is predetermined by the test's fixed retry script does not prove that requirement, so `release-readiness-report.md` is still ahead of the evidence when it marks `NFR-7.4` as `pass`.

### MODERATE

1. The evidence helper provenance anchor still points at the prior remediation wave snapshot.
   - `tests/runtime/helpers/phase9-evidence.ts` still reads `control-state-phase-9-third-remediation-wave-2-ready-after-sa.md`.
   - The current fourth-remediation Wave 2 snapshot is `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`.
   - This remains a real provenance defect and the Session A summary overstated that repair. On its own I would not treat it as the decisive fail reason because same-run candidate identity stabilization still appears intact, but it is still unresolved and must be corrected in the next remediation.

## Decision Rationale

I weigh the tester rerun as strong evidence that the narrowed Phase 9 suite is stable and that the accepted preserved fixes were not regressed. I do not weigh it as sufficient to pass the phase because the tester's green outcome depends on the current proof logic, while the reviewer rerun shows that the logic still does not prove the Phase 9 contract being claimed.

Under `docs/non-functional-requirements.md`, `docs/workflow-extended-and-release-spec.md`, the frozen B0 acceptance, and the prior third-remediation verdict context, Phase 9 cannot pass while `NFR-6.3` and `NFR-7.4` are promoted to `pass` on evidence that is still synthetic at the proof layer. The stale provenance anchor is an additional unresolved defect, but the fail decision stands even without it because the two remaining proof-shape blockers are release-contract blockers.

## Minimum Next-Remediation Scope Only

Do not widen scope beyond Phase 9. The minimum next-remediation set is:

1. Replace the `NFR-6.3` proof so restatement detection is performed against the raw `plan -> cook` handoff strings actually emitted by `plan`.
   - Use the real `handoffCommand`, `planPath`, `mode`, and any accepted `diagnostics[].nextStep` continuation guidance directly, or another equally contract-grade `plan`-owned handoff surface.
   - Make the durable artifact explicit about that raw provenance.

2. Replace the `NFR-7.4` benchmark with a comparable sequential-versus-parallel workload that measures runtime-emergent failed/retried-task behavior rather than fixed scripted retry budgets.
   - Keep the workload shape comparable.
   - Ensure the measured reliability signal can actually diverge based on runtime behavior under sequential versus parallel execution.

3. Correct the Phase 9 evidence helper provenance anchor.
   - Point `tests/runtime/helpers/phase9-evidence.ts` at `control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`.
   - Keep the existing same-run candidate-identity stabilization behavior intact.

4. After those repairs, rerun only the narrowed Phase 9 verification chain.
   - Session B tester rerun
   - Session C reviewer rerun
   - Session D verdict rerun

Preserve without reopening:

- `NFR-3.6` frozen trace repair
- honest blocked `NFR-8.1` handling
- scoped contract timeout stability
- same-run candidate identity stabilization
- durable migration checklist row evidence refs

## Unresolved Questions

- none
