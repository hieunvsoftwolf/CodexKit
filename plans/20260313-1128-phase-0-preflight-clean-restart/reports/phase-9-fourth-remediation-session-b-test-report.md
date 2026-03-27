# Phase 9 Fourth-Remediation Session B Test Report

- Date: 2026-03-26
- Status: completed with findings
- Session Role: tester
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate Ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Scope

- Read-first set completed per prompt (README, plan/control-state/session artifacts, and Phase 9 docs).
- Source of truth used: current fourth-remediation candidate tree + pinned BASE_SHA context + current control-state snapshot + frozen Phase 9 B0 artifact + Session A summary + current phase docs.
- Reviewer rerun output and verdict rerun output not used.

## Commands Run

1. Scoped Phase 9 suite first (unchanged):

```bash
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts tests/runtime/runtime-workflow-phase9-chaos-recovery.integration.test.ts tests/runtime/runtime-workflow-phase9-migration-checklist.integration.test.ts tests/runtime/runtime-workflow-phase9-release-readiness.integration.test.ts --no-file-parallelism
```

Result:
- Test Files: `5 passed (5)`
- Tests: `6 passed (6)`
- Duration: `320.80s`

2. Verification-only follow-up for doc-derived gap (added after scoped suite):

```bash
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase9-contract.integration.test.ts --no-file-parallelism
```

Result:
- Test Files: `1 failed (1)`
- Tests: `1 failed | 2 passed (3)`
- Failing check: helper provenance anchor does not point to current fourth-remediation Wave 2 snapshot.

## Must-Verify Outcomes

### 1) `NFR-6.3` proof uses actual `plan -> cook` handoff-surface decisions

Status: pass

Evidence:
- `release-readiness-report.md` row `NFR-6.3` references:
  - `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-2552c65c3cee.md`
- Artifact content states plan-owned provenance explicitly:
  - `Accepted decision provenance: plan -> cook handoff surface only`
  - `Plan-owned accepted decisions scanned: 4`
  - `Restatement events detected: 0`

### 2) `NFR-7.4` evidence uses comparable retry/failure reliability behavior

Status: pass

Evidence:
- `release-readiness-report.md` row `NFR-7.4` references:
  - `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-205ba0d718c8.md`
- Artifact content shows comparable workload + non-zero reliability signal:
  - `Workload comparable: true`
  - `Non-zero retry/failure signal observed in both runs: true`
  - `Sequential retry events: 2`
  - `Parallel retry events: 2`
  - `Observed delta: 0.0000` with `Allowed delta: 0.1000`

### 3) Phase 9 evidence helper anchors to current Wave 2 ready snapshot

Status: fail

Evidence:
- Current Wave 2 ready snapshot for this remediation lane:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`
- Helper still anchors to older snapshot in source:
  - `tests/runtime/helpers/phase9-evidence.ts` uses:
    - `control-state-phase-9-third-remediation-wave-2-ready-after-sa.md`
- Verification-only follow-up assertion added and failed:
  - `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`
  - expected helper source to contain `control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`

### 4) Accepted fixes remain intact

#### `NFR-3.6` frozen trace repair

Status: intact

Evidence:
- `release-readiness-report.md` row `NFR-3.6` includes:
  - `golden-plan-cook-comparative-trace-6e36db9bf7b5.md`
  - `frozen-claudekit-plan-cook-trace-source-222e488b3a5b.json`

#### Honest blocked handling for one-version `NFR-8.1`

Status: intact

Evidence:
- `release-readiness-report.md` row `NFR-8.1` is `blocked` with explicit note.
- `migration-checklist-f15798dc22ba.md` row `host-matrix-smoke` is `blocked` with explicit reason (`fewer than two real Codex CLI versions discovered`).

#### Contract timeout stability

Status: intact in this rerun

Evidence:
- Scoped contract file completed inside timeout envelope during full suite run.
- Contract test constant remains explicit (`PHASE9_CONTRACT_TEST_TIMEOUT_MS = 20_000`).

#### Same-run candidate identity stabilization

Status: intact

Evidence:
- `tests/runtime/helpers/phase9-evidence.ts` still uses frozen per-process identity cache:
  - `let frozenCandidateIdentity ...`
  - `resolvePhase9CandidateIdentity()` returns cached identity once resolved.

#### Durable migration row evidence refs

Status: intact

Evidence:
- `migration-checklist-f15798dc22ba.md` includes per-row durable evidence refs for required rows.
- `release-readiness-report.md` maps migration-backed rows to durable artifact refs.

## Findings

### CRITICAL

1. Phase 9 evidence helper provenance anchor is stale for current remediation wave.
- File: `tests/runtime/helpers/phase9-evidence.ts`
- Current value: `control-state-phase-9-third-remediation-wave-2-ready-after-sa.md`
- Expected for current lane: `control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`
- Impact: provenance anchor requirement in current control-state is not met; release evidence still builds against previous wave snapshot name.

## Added Verification-Only Follow-Up

- Added one doc-derived contract assertion:
  - `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts`
  - Test name: `anchors helper provenance to current fourth-remediation wave-2 control snapshot`
- This follow-up currently fails and reproduces the defect above.
- No production code edits made.

## Artifact Evidence

- Release synthesis:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
- Golden restatement proof (`NFR-6.3`):
  - `.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-2552c65c3cee.md`
- Chaos reliability proof (`NFR-7.4`):
  - `.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-205ba0d718c8.md`
- Migration checklist:
  - `.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-f15798dc22ba.md`

## Unresolved Questions

- none
