# Phase 6 Wave 1 Session B Test Report

Date: 2026-03-23  
Status: completed  
Role/Modal Used: tester / default testing modal  
Model Used: GPT-5 Codex / Codex CLI  
Pinned BASE_SHA: `cfdac9eecc918672082ab4d460b8236e2aea9566`  
Candidate HEAD: `cfdac9eecc918672082ab4d460b8236e2aea9566`

## Scope And Source Of Truth

- current candidate repo tree at pinned `BASE_SHA`
- frozen B0 verification artifact:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-b0-spec-test-design.md`
- handoff context only:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-6-wave-1-session-a-implementation-summary.md`
- required docs and control artifacts read first:
  - `README.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-6-wave-2-ready-after-s2-s3.md`
  - `docs/workflow-extended-and-release-spec.md`
  - `docs/verification-policy.md`
  - `docs/non-functional-requirements.md`

## Frozen B0 Commands Executed First (Unchanged)

1. `npm test -- --run tests/runtime/runtime-workflow-phase6-cli.integration.test.ts`  
2. `npm test -- --run tests/runtime/runtime-workflow-phase6-review.integration.test.ts`  
3. `npm test -- --run tests/runtime/runtime-workflow-phase6-test.integration.test.ts`  
4. `npm test -- --run tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`

Observed across all four unchanged runs:

- each command executed unit + integration suites, then full runtime suite (`16` files, `72` tests), because `npm test` maps to:
  - `TMPDIR=.tmp vitest run tests/unit tests/integration && TMPDIR=.tmp vitest run tests/runtime --no-file-parallelism`
- each run ended `exit 1` with the same four failing assertions in Phase 6 files:
  - `tests/runtime/runtime-workflow-phase6-review.integration.test.ts` (2 failures)
  - `tests/runtime/runtime-workflow-phase6-test.integration.test.ts` (1 failure)
  - `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts` (1 failure)

## Contract-Gap Findings (Implementation vs Frozen Spec)

### 1) `cdx review codebase` on clean repo does not emit `no findings`

- failing assertion: report content must include `no findings`
- observed report emits seeded findings (`critical/important/moderate`) on clean fixture
- contract impact:
  - Phase 6 section 5.5 requires explicit `no findings` when clean
  - frozen B0 review test expectation violated

### 2) bare `cdx review` does not enter scope-selection gate

- failing assertion: expected `workflow=review`, empty `checkpointIds`, and pending approval at `review-scope`
- observed behavior: hard `CLI_USAGE` error `WF_REVIEW_OPERATION_REQUIRED`
- contract impact:
  - Phase 6 section 5.2 requires prompt-based scope selection for bare `cdx review`
  - `NFR-3.2` no unnecessary prompt/shape friction is not satisfied for this path

### 3) default `cdx test <context>` lacks typed diagnostics in blocked/degraded case

- failing assertion: `result.diagnostics.length > 0` (plus typed fields)
- observed behavior: diagnostics array empty for default path in no-prerequisite fixture
- contract impact:
  - Phase 6 section 6.6 requires failure causes and suggested fixes in `test-report.md`
  - `NFR-3.3` requires typed blocking diagnostics with next step

### 4) `cdx debug ...` does not publish route classification in result payload

- failing assertion: `result.route === "database"`
- observed behavior: `result.route` empty string while checkpoints/report path are present
- contract impact:
  - Phase 6 section 8.3 requires branch classification (`database` in this scenario)
  - frozen B0 debug route contract violated

## Follow-up Verification Added (Harness Gap Only)

Reason:
- B0 command shape `npm test -- --run <file>` does not isolate target files in this repo due the `test` script composition; this is a harness behavior gap, not a product contract.

Command:

`TMPDIR=.tmp npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase6-cli.integration.test.ts tests/runtime/runtime-workflow-phase6-review.integration.test.ts tests/runtime/runtime-workflow-phase6-test.integration.test.ts tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`

Result:

- `1` file passed (`cli`)
- `3` files failed (`review`, `test`, `debug`)
- `4` failing assertions reproduced exactly, confirming the same Wave 1 contract gaps without full-runtime-suite noise

## Exit-Criteria Mapping Snapshot (Wave 1 Scope Only)

- CLI command-shape acceptance and typed rejection: **pass** (`runtime-workflow-phase6-cli.integration.test.ts`)
- `cdx review` no-findings + bare-scope-selection behavior: **fail** (2 gaps)
- `cdx test` preflight-first with explicit typed blocked/degraded behavior: **partial fail** (default path diagnostics gap)
- `cdx debug` route classification and durable report contract: **partial fail** (route field gap; checkpoint/report presence observed)

## Blockers

- Wave 1 Session B cannot mark verification pass while the four contract gaps above remain.

## Unresolved Questions

- none
