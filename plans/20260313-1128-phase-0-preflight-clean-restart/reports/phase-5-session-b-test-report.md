# Phase 5 Session B Test Report

Date: 2026-03-22
Status: completed
Role/Modal Used: tester / default testing modal
Model Used: GPT-5 Codex
Pinned BASE_SHA: `df037409230223e7813a23358cc2da993cb6c67f`

## Scope And Source Of Truth

- current candidate repo tree
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-5-wave-2-ready-after-sa-b0.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-base-freeze-rerun-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md` (frozen expectation)
- `docs/workflow-parity-core-spec.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/compatibility-matrix.md`

## B0-Defined Checks Executed First (Unchanged)

1. `git rev-parse HEAD`
- result: `df037409230223e7813a23358cc2da993cb6c67f`

2. `git merge-base --is-ancestor df037409230223e7813a23358cc2da993cb6c67f HEAD`
- result: pass (`exit:0`)

3. `npm run test:runtime`
- result: pass (`10` files, `55` tests)

4. `node ./cdx --help`
5. `node ./cdx brainstorm --help`
6. `node ./cdx plan --help`
7. `node ./cdx cook --help`
- result: all four failed the same way
- failure: Node tried to parse shell wrapper `cdx` and raised `SyntaxError: Unexpected identifier 'pipefail'`
- note: this is command-shape issue in B0 command matrix (`node ./cdx ...`), not runtime workflow behavior

8. B0 suggested Phase 5 suite command (unchanged):
- `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-wave1.integration.test.ts tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
- result: pass (`2` files, `12` tests)

9. B0 suggested candidate-level suite:
- `npm run test:integration`
- result: pass (`2` files, `6` tests)

## Verification-Only Amendments (Doc-Derived Gaps)

B0 says amendments are allowed only for doc-derived verification gaps. I added tests only under `tests/runtime/` and did not change production code.

### Gaps Found

- brainstorm report minimum shape was not asserted directly
- plan file contract needed stricter checks for `status: pending` and required phase-file sections
- deferred plan-subcommand diagnostics covered only `validate`, not `red-team` and `archive`
- handoff command absolute-path expectation was not asserted in CLI test

### Verification-Only Test Updates

- `tests/runtime/runtime-workflow-wave1.integration.test.ts`
  - added brainstorm report-shape assertions
  - added explicit handoff metadata assertions (`explicitPolicyOnly`, decision artifact linkage)
  - added stricter plan contract checks (`status: "pending"`, required phase-file sections)
- `tests/runtime/runtime-cli.integration.test.ts`
  - expanded deferred subcommand diagnostics to cover `validate`, `red-team`, and `archive`
  - added absolute path assertion for plan handoff command target

## Post-Amendment Verification Runs

1. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-wave1.integration.test.ts tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`
- result: pass (`2` files, `13` tests)

2. `npm run test:runtime`
- result: pass (`10` files, `56` tests)

3. Deferred-behavior spot checks (CLI):
- `./cdx plan red-team /tmp/plan.md --json` -> typed deferred diagnostic (`WF_PLAN_SUBCOMMAND_DEFERRED`)
- `./cdx plan archive /tmp/plan.md --json` -> typed deferred diagnostic (`WF_PLAN_SUBCOMMAND_DEFERRED`)
- `./cdx cook --json` -> typed deferred diagnostic (`COOK_PLAN_REQUIRED`)

## Frozen Assertions Coverage (Requested Focus)

- explicit-only approval inheritance: pass
- hydration dedupe: pass
- plan-file contract: pass
- brainstorm report shape: pass
- typed diagnostics: pass
- cook and plan-subcommand deferred behavior: pass (deferred surfaced explicitly, not masked as complete)

Wave 2 remains deferred (`P5-S4`, final `P5-S6`, `P5-S7`) and was not counted as closed in this Session B report.

## Findings

1. `node ./cdx ...` commands in frozen B0 matrix are not executable as written because `cdx` is a shell wrapper, not a Node module entrypoint.
2. `--help` behavior is not a true help renderer in current CLI flow; commands emit typed usage/deferred responses instead. Not a blocker for frozen Wave 1 checks, but visible UX drift.

## Blockers

- none

## Unresolved Questions

- should frozen B0 command matrix switch `node ./cdx ...` to executable wrapper form (`./cdx ...`) for future reruns?
- should Phase 5 require explicit `--help` text rendering parity, or keep typed usage responses as current behavior?
