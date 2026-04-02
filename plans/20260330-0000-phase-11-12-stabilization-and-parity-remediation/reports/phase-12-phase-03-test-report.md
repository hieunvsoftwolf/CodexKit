# Phase 12 Phase 3 Test Report

Date: 2026-03-31
Status: completed
Session role/modal: `tester / default`
Model used: `gpt-5 / medium`
Candidate tree: `/Users/hieunv/Claude Agent/CodexKit`
Execution surface: local Codex terminal session (`zsh`, workspace-write sandbox)

## Scope And Order Executed

Executed in required order:
1. frozen phase-local subset command A
2. frozen phase-local subset command B
3. broader runtime accounting

No production code changes were made.

## Command-Level Evidence

### Step 1
- exact required command: `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- execution wrapper used for evidence capture: `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts > plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log 2>&1; ec=$?; echo EXIT_CODE=$ec > plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.exit`
- status: `EXIT_CODE=1`
- raw evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.exit`

### Step 2
- exact required command: `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- execution wrapper used for evidence capture: `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts > plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log 2>&1; ec=$?; echo EXIT_CODE=$ec > plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.exit`
- status: `EXIT_CODE=1`
- raw evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.exit`

### Step 3
- exact required command: `NODE_NO_WARNINGS=1 npm run test:runtime`
- execution wrapper used for evidence capture: `NODE_NO_WARNINGS=1 npm run test:runtime > plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log 2>&1; ec=$?; echo EXIT_CODE=$ec > plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.exit`
- status: `EXIT_CODE=1`
- raw evidence:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.exit`

## Required Harness Caveat (Preserved)

- `npm run test:runtime -- <file>` expands into broader runtime coverage in this repo.
- broader runtime currently surfaces three legacy archive expectation failures outside the frozen phase-local files.

## Archive + Preview Parity Evidence (Current Candidate Tree)

Real CLI-flow evidence is present and passing in all three command logs:
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts (2 tests)` passed.
- archive CLI flow assertion passed: `real cdx archive flow gates plan mutation until approval resolves and publishes summary plus journal artifacts`.
- preview CLI flow assertion passed: `real cdx preview flow emits markdown and view-url artifacts through the public CLI entrypoint`.

Direct runtime parity evidence also passed:
- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts (2 tests)` passed.
- confirms archive pre-approval no-mutation gating and post-approval durable artifacts.
- confirms preview artifact emission visibility in durable artifact listings.

Primary citations:
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log` (pass lines for both phase-12 files and CLI-flow assertions)
- same pass lines also present in step 1 and step 2 logs.

## Broader Runtime Accounting And Classification

Observed broader runtime failures (outside frozen phase-local files):
- `tests/runtime/runtime-cli.integration.test.ts` expects archive status `valid`, but runtime now returns `pending` pre-approval.
- `tests/runtime/runtime-workflow-wave2.integration.test.ts` expects archive status `valid`, but runtime now returns `pending` pre-approval.
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts` metric pass assertion fails (`expected false to be true`) during the same broader run.

Verdict on broader failures for this phase:
- for Phase 12 Phase 3 frozen phase-local acceptance, these are treated as out-of-scope stale expectation fallout in legacy broader suites (matching preserved caveat and remediation notes).
- for full runtime-suite green status, they remain a live blocker until legacy expectations/evidence contracts are synchronized.

## Final Verdict For Session B Tester Rerun

- frozen phase-local objective: satisfied (archive + preview parity evidence present, including real `cdx plan archive` and real `cdx preview` CLI-flow passes)
- broader runtime accounting: completed with known three broader failures preserved and classified as above
- tester rerun artifact for control lane: complete

## Unresolved Questions

- none
