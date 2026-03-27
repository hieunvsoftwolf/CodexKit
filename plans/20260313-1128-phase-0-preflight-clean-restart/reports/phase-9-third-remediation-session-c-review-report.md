# Phase 9 Third-Remediation Session C Review Report

- Date: 2026-03-26
- Status: completed
- Session Role: reviewer
- Source of truth: current candidate worktree at `/Users/hieunv/Claude Agent/CodexKit`, pinned `BASE_SHA` `8a7195c2a98253dd1060f9680b422b75d139068d`, current control-state snapshot, third-remediation Session A summary, prior review/verdict reports, current Phase 9 docs
- Exclusions honored: no tester rerun output, no verdict rerun output

## Findings

### CRITICAL

- `NFR-6.3` is still not backed by a contract-grade fresh-session continuation proof. The executed fresh session is `plan -> cook` at `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts:171-182`, but the test counts restatement events against `acceptedDecisions` pulled from the separate `brainstorm -> plan` handoff bundle at `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts:153-156` and `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts:261-266`. Those accepted decisions are the generic brainstorm bundle strings created in `packages/codexkit-daemon/src/workflows/brainstorm-workflow.ts:61-68`, while the plan workflow does not emit an accepted-decision bundle for the `plan -> cook` handoff at `packages/codexkit-daemon/src/workflows/plan-workflow.ts:150-161`. The durable artifact only records that two brainstorm decisions were scanned against the fresh `cook` run and found `0` matches at `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-22970560400b.md`. That can pass without proving that decisions actually present in the real `plan -> cook` handoff survived fresh-session continuation, so the blocker closure claim for `NFR-6.3` remains unsupported.

- `NFR-7.4` is still not evidenced by a meaningful sequential-vs-parallel reliability benchmark. The comparator now uses stable labels, but the benchmark still manufactures divergence and never exercises a reliability loss path. In `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts:61-72`, every task is always claimed, released, and marked completed; `failedOrRetried` is then derived from failed tasks or expired/superseded claims at `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts:84-92`, which leaves both rates structurally at `0` in the happy path. The only difference between sequential and parallel ordering is the injected sleep on the parallel branch at `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts:62-64`, and `nfr74Pass` still requires that synthetic divergence at `tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts:274-277`. The resulting artifact shows a forced reversed order with `0.0000` vs `0.0000` failure/retry rates at `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-85ebf065f700.md`. This closes the old cross-run-id bug, but it still does not prove that the actual parallel payoff benchmark stays within the `+10%` reliability budget under comparable execution.

### MODERATE

- The evidence helper still anchors candidate provenance to the old reroute snapshot instead of the current Wave 2 ready snapshot. `tests/runtime/helpers/phase9-evidence.ts:17-22` reads `control-state-phase-9-third-remediation-reroute-after-s14.md`, while the current control-state snapshot identifies `control-state-phase-9-third-remediation-wave-2-ready-after-sa.md` as the current durable state at `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-third-remediation-wave-2-ready-after-sa.md:15-18`. In this workspace both snapshots carry the same pinned `BASE_SHA`, so same-run candidate identity still stayed stable across regenerated bundles and the release report, but the implementation summary claim that the helper was repointed to the current snapshot is not true. That is a provenance hygiene gap on the review surface.

## Open Questions Or Assumptions

- Assumed reviewer-owned command execution was allowed. I ran `npm run -s typecheck` and the scoped Phase 9 five-file suite directly: `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism`.
- The scoped suite passed on the current candidate: `5` files, `6` tests, total duration about `138.64s`. The contract file completed in about `2.7s`, so I did not reproduce the earlier timeout fragility under the required full run.
- I verified the narrowed positive repairs that should stay preserved:
  - `NFR-3.6` now uses a durable frozen trace source artifact in the generated golden evidence and release synthesis.
  - accepted blocked `NFR-8.1` note merge is now accurate in `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md:55`.
  - same-run candidate identity stayed stable across the regenerated Phase 9 bundles and release report.
  - migration checklist rows now point to durable per-row evidence artifacts in `.tmp/phase9-durable-artifacts/validation-migration/`.
- No other open questions.

## Brief Change Summary

- The third remediation does appear to fix the previously accepted `NFR-3.6`, `NFR-8.1` note-merge, contract-timeout, candidate-identity, and migration-row-evidence issues.
- The narrowed blocker set is still not fully closed because the new `NFR-6.3` and `NFR-7.4` proofs remain synthetic in ways that keep the release-report `pass` rows ahead of the actual evidence.
