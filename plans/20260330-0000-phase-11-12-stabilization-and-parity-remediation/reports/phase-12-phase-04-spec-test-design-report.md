# Phase 12 Phase 4 Spec-Test-Design Report

**Date**: 2026-04-02
**Status**: completed
**Role/Modal Used**: spec-test-designer / reasoning
**Model Used**: gpt-5.4 / medium
**Pinned BASE_SHA**: `02275ccddb6dde5715805a9eda266c7324a15581`

## Summary

- froze Phase 12 Phase 4 verification against the pinned baseline docs, planner decomposition, and newer Wave 1 routing-disposition report rather than the stale `W0 required` frontmatter pointer
- authored verification-owned phase-local runtime tests in `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts` and `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
- kept verification ownership isolated from production files and shared legacy runtime suites

## Frozen Acceptance And Integration Expectations

- `cdx fix intermittent test failure --quick` must no longer return the old deferred diagnostic path and must create a durable `fix` run with checkpointed execution and published artifacts
- bare `cdx fix` is frozen as a chooser-gated entry surface for this phase: it must return a pending approval payload, expose one explicit `cdx approval respond ...` next step, and its approval continuation must complete on the same durable run with non-empty checkpoint history and published artifacts
- `cdx team review payment flow` must no longer return the old deferred diagnostic path and must create a durable `team` run with checkpointed execution, published artifacts, and worker-side runtime activity
- `cdx docs refresh architecture summary` must be a standalone `docs` workflow run, not finalize-only side effect, and must publish durable docs artifacts
- `cdx scout payment onboarding risk` must be a standalone `scout` workflow run, not disguised `review` aliasing, and must publish durable scout artifacts
- direct runtime verification freezes stable shape, not speculative internal naming, for newly ported checkpoints: each successful in-scope workflow path must return a non-empty unique checkpoint array and register the corresponding durable run in runtime state

## Real-Workflow E2E Requirement

- accepted e2e harness for this phase is CLI-flow execution through the real `cdx` entrypoint with `--json`
- required public workflows:
  - `cdx fix`
  - `cdx team`
  - `cdx docs`
  - `cdx scout`
- `fix` must carry both explicit entry and chooser-continuation evidence in this wave because chooser/approval continuation is an in-scope blocker when present
- direct runtime-state assertions are required in addition to CLI e2e to freeze durable run creation, checkpoint shape, artifact publication, and team primitive effects
- `N/A` is not acceptable by default for any in-scope workflow in this phase

## Frozen First-Pass Commands

1. `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
2. `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
3. broader regression: `TMPDIR=.tmp NODE_NO_WARNINGS=1 npm run test:runtime`

## Authored Verification Scope

- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - freezes real-`cdx` e2e for explicit `fix`, bare `fix` chooser plus approval continuation, `team`, `docs`, and `scout`
  - freezes the replacement of the earlier deferred `fix` and `team` CLI contract with runnable workflow entrypoints
- `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
  - freezes durable runtime run creation for `fix`, `team`, `docs`, and `scout`
  - freezes checkpoint-array shape for all four in-scope workflows without guessing undocumented checkpoint-id strings
  - freezes artifact publication for all four in-scope workflows
  - freezes team workflow runtime effects through worker-side activity on the created `team` run

## Ownership And Session Routing

- Session B0 owns exactly:
  - `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md`
- Session A may touch those files: no
- Session A should treat failures in these files as acceptance blockers for Phase 12.4 until rerouted by planner refresh

## Broader Runtime Failure Classification

- if the frozen first-pass commands above fail, classify the result as an in-scope Phase 12.4 blocker
- if the frozen first-pass commands pass but `npm run test:runtime` still fails only in pre-existing shared suites that encode stale deferred expectations or unrelated carry-forward contracts outside `workflow.fix`, `workflow.team`, `workflow.docs`, and `workflow.scout`, classify those failures as carry-forward stale-expectation fallout outside the owned phase subset
- such broader carry-forward failures should be reported explicitly with file-level evidence, but they do not by themselves invalidate the Phase 12.4 verification subset unless they expose a regression that changes one of the four in-scope workflow contracts or blocks the frozen subset from running

## Notes

- test design was derived from `README.md`, current plan and phase docs, planner decomposition, newer Wave 1 routing-disposition report, control-agent verification policy, and project architecture docs
- preferred host skills `docs-seeker`, `web-testing`, and `sequential-thinking` were unavailable here; best-available local-doc and runtime-suite fallback was used
- local harness check results on the pinned baseline matched the intended gap surface:
  - the direct phase-local commands above collect and fail on the expected missing/unsupported workflow entries for `fix`, `team`, `docs`, and `scout`
  - `npm run test:runtime -- <file>` does not isolate the owned file in this repo because the script still expands the broader `tests/runtime` tree first, so it is not the correct first-pass command for Session B
- this host required `TMPDIR=.tmp` for direct `vitest` execution to avoid temp-dir `EPERM` during test collection
- no production files were edited
- no candidate implementation branch or implementation summary was inspected

## Unresolved Questions

- none
