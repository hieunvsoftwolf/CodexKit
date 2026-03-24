# Phase 7 Third Remediation Session A Implementation Summary

**Date**: 2026-03-24
**Status**: completed
**Role/Modal Used**: fullstack-developer / default
**Model Used**: GPT-5 / Codex CLI
**Scope**: explicit finalize hint canonical validation + symlink-alias bypass closure + validated-root artifact binding
**Pinned BASE_SHA Context**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`

## Scope And Guardrails Applied

- stayed inside Phase 7 third-remediation scope only
- did not rewrite B0 scope
- did not widen into Phase 8/9
- preserved accepted wins:
  - no workspace-global fallback
  - explicit no-active-plan handling
  - non-optimistic sync-back
  - managed `## Progress` preservation
  - contract-complete `finalize-report.md`
  - explicit no-auto-commit behavior
  - honest pre-review finalize semantics
- preserved required artifact filenames:
  - `unresolved-mapping-report.md`
  - `docs-impact-report.md`
  - `git-handoff-report.md`
  - `finalize-report.md`

## Implemented Changes

### 1) Canonical explicit hint validation against active durable `plan.md`

File:
- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts`

Changes:
- added canonical durable-plan resolver using `realpathSync.native`
- require both original path basename and canonical target basename to be `plan.md`
- derive active durable plan from run-bound plan state (`run.planDir/plan.md` first, then workflow-state `activePlanPath`) through canonical validation
- explicit `planPathHint` now treated as valid only when canonicalized target matches that active durable canonical plan
- basename-only `plan.md` aliases (including symlink to `phase-*.md` or arbitrary markdown) cannot become sync-back target

Result:
- sync-back target is the real active durable `plan.md` only

### 2) Downstream finalize artifact placement bound to validated durable root

File:
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`

Changes:
- replaced downstream input propagation so docs/git/finalize stages receive:
  - only `runId` + `workflow` by default
  - `planPathHint` only when `sync.planPath` is present from validated sync-back
- raw incoming hint is no longer forwarded when validation fails or when no active plan exists

Result:
- downstream report placement roots to same validated durable plan path used by sync-back

### 3) Direct runtime verification for symlink-alias bypass

File:
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

Added test:
- `finalize rejects plan.md symlink aliases and keeps report placement on the durable plan root`

Coverage:
- create `alias-plan-root/plan.md` symlink to a real phase file
- call finalize with `planPathHint` set to alias path
- assert `sync.planPath` resolves to durable `plan.md`, not alias
- assert phase target does not gain managed plan progress block markers
- assert `docs-impact-report.md`, `git-handoff-report.md`, `finalize-report.md` (and unresolved report when emitted) resolve under durable plan `reports/` root, not alias root

## Files Changed

- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts`
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

## Verification Run

1. `npm run typecheck`
- result: pass

2. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts tests/runtime/runtime-workflow-wave2.integration.test.ts --no-file-parallelism`
- result: pass
- files: `2` passed
- tests: `11` passed
- includes new direct symlink-alias bypass coverage

## Blockers

- none

## Unresolved Questions

- none
