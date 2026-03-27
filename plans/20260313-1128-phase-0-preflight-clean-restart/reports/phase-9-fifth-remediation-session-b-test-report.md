# Phase 9 Fifth-Remediation Session B Test Report

- Date: 2026-03-27
- Status: completed with findings
- Session role: tester
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Scope and constraints used

- Used source of truth: current fifth-remediation candidate tree, pinned `BASE_SHA`, current control-state snapshot, frozen Phase 9 B0 artifact, fifth-remediation Session A summary, current Phase 9 docs.
- Not used: reviewer rerun output, verdict rerun output.
- No production-code edits.

## Scoped suite execution (required first)

Command run exactly:

`TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism`

Result:

- Test Files: `5 passed`
- Tests: `7 passed`
- Duration: `163.97s`

## Must-verify checks

1. `NFR-6.3` proof scans raw `plan -> cook` handoff fields directly: **pass**
- Code path collects `handoffCommand`, `planPath`, `mode`, and `diagnostics[].nextStep` as raw values in golden suite.
- Evidence artifact: `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-087e417c6b08.md` shows raw field list and `Restatement events detected: 0`.

2. `NFR-7.4` evidence reflects emergent comparable reliability behavior, not scripted retry budgets: **pass (proof-shape), metric result fail**
- Chaos suite now derives reliability from runtime claim expiry/supersede under comparable sequential vs parallel workload; no fixed retry-budget array.
- Evidence artifact: `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-560e84a10c4d.md` explicitly states no scripted budgets and reports observed runtime outcomes.
- Current measured metric outcome remains `fail` (`parallel 2.0000` vs `sequential 1.0000`, delta `1.0000` > allowed `0.1000`).

3. `tests/runtime/helpers/phase9-evidence.ts` provenance anchors to current Wave 2 ready snapshot: **fail**
- Helper still anchors to fourth-remediation snapshot string.
- Current control-state snapshot for this rerun is fifth-remediation Wave 2 ready snapshot.

## Preserved accepted-fix checks

- `NFR-3.6` frozen trace repair: **intact** (`pass` row + frozen trace artifact refs present)
- Honest blocked handling for one-version `NFR-8.1`: **intact** (`blocked` with explicit host prerequisite note, not forced pass/fail)
- Contract timeout stability: **intact** (contract test timeout constant remains bounded and unchanged)
- Same-run candidate identity stabilization: **intact** (same `baseSha/candidateSha` across validation-golden/chaos/migration bundles)
- Durable migration row evidence refs: **intact** (migration rows promoted to per-row durable artifacts, checklist references durable row paths)

## Concrete defects

### CRITICAL

1. Provenance anchor is stale for this wave and validation still enforces stale target.
- `tests/runtime/helpers/phase9-evidence.ts` points to `control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`.
- `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts` also asserts the same fourth-remediation string.
- Current source-of-truth snapshot is `control-state-phase-9-fifth-remediation-wave-2-ready-after-sa.md`.
- Impact: provenance claim in current Wave 2 tester rerun is not aligned with current control-state artifact.

## Artifact evidence used

- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
- `.tmp/validation-golden-evidence.json`
- `.tmp/validation-chaos-evidence.json`
- `.tmp/validation-migration-evidence.json`
- `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-087e417c6b08.md`
- `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-560e84a10c4d.md`
- `.tmp/phase9-durable-artifacts/validation-golden/golden-plan-cook-comparative-trace-fe22e1bd1849.md`
- `.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-bf8ca5f05e29.md`

## Unresolved Questions

- none
