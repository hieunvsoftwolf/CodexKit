# Phase 12 Phase 5 Spec-Test Design Report

Date: 2026-04-04
Status: completed
Role/Modal Used: spec-test-design / reasoning
Pinned BASE_SHA: `335e6339aae38d4b0b648b4d1f956e6dad47dad8`

## Scope Frozen

- `cook` / `review` / `test` / `finalize` closeout semantics now require one phase-local runtime proof that `cdx cook --auto` can complete the full evidence chain when repo verification prerequisites are satisfiable.
- `debug` verification evidence now requires one phase-local runtime proof that branch-specific evidence is durable enough to close the represented gate, not just a generic debug report.
- plan template parity now requires both real template assets in the repo and durable plan-generation evidence that selection binds to those real assets.

## Verification-Owned Files

- `tests/runtime/runtime-workflow-phase12-closeout-gates.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-debug-evidence.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-plan-template-parity.integration.test.ts`

## Frozen Test Contracts

### 1. Closeout Gates

- fixture is git-backed and includes a passing `npm test` script so closeout is blocked only by workflow behavior, not missing prerequisites
- `cook` must finish `implementation`, `test-*`, `review-*`, and `finalize-*` checkpoints in the same auto run
- `cook.completedThroughFinalize` must be `true`
- `COOK_FINALIZE_DEFERRED_PRE_REVIEW` is now an explicit regression on this satisfiable surface
- finalize report must cite durable implementation, test, and review artifacts

### 2. Debug Evidence

- database-routed debug run must keep the standard checkpoint chain
- the run must publish `debug-evidence-bundle.md`
- that evidence bundle must include database-specific verification content:
  - schema context
  - query or migration evidence
  - safety note
  - verification expectation
- the run must preserve the completed `Prepare verify handoff expectations` task

### 3. Plan Template Parity

- required repo assets:
  - `plans/templates/feature-implementation-template.md`
  - `plans/templates/bug-fix-template.md`
  - `plans/templates/refactor-template.md`
  - `plans/templates/template-usage-guide.md`
- required durable asset markers:
  - `# Feature Implementation Template` with `## Deliverable`
  - `# Bug Fix Template` with `## Reproduction`
  - `# Refactor Template` with `## Safety Checks`
  - `# Template Usage Guide` with references to the template asset names
- plan generation must record a durable selected template id plus a `Template source: plans/templates/<file>` line
- frozen selection examples:
  - `Implement release dashboard export` -> `feature-implementation`
  - `Fix checkout redirect bug` -> `bug-fix`
  - `Refactor plan bundle rendering` -> `refactor`

## First-Pass Commands

- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-closeout-gates.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-debug-evidence.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-plan-template-parity.integration.test.ts`

## Broader Regression Commands Frozen For Session B

- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `npm run build`
- `npm run typecheck`
- `npm run test:runtime`

## Host Verification Caveat

- sandboxed vitest/runtime verification on this host can fail before assertion evidence with Vite temp-file EPERM under node_modules/.vite-temp
- if that happens on the same surface, rerun the same command elevated and record that caveat; do not blind-retry sandboxed

## Baseline Expectation At BASE_SHA

- `runtime-workflow-phase12-closeout-gates.integration.test.ts` should fail on `BASE_SHA` because auto cook still defers finalize before fresh review/test evidence exists.
- `runtime-workflow-phase12-debug-evidence.integration.test.ts` should fail on `BASE_SHA` because the current debug evidence bundle is generic and does not publish database-specific verification evidence.
- `runtime-workflow-phase12-plan-template-parity.integration.test.ts` should fail on `BASE_SHA` because template assets are absent and plan generation remains hardcoded.

## First-Pass Command Outcomes On BASE_SHA

- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-closeout-gates.integration.test.ts`
  - exit: `1`
  - assertion surface: `cook.completedThroughFinalize` stayed `false`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-debug-evidence.integration.test.ts`
  - exit: `1`
  - assertion surface: `debug-evidence-bundle.md` did not contain `Schema context`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-plan-template-parity.integration.test.ts`
  - exit: `1`
  - assertion surface: required template assets under `plans/templates/` were absent
- no first-pass command hit the host Vite temp-file `EPERM` caveat on this run

## Unresolved Questions

- none
