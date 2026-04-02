# Phase 12 Phase 3 Spec-Test-Design Report

**Date**: 2026-03-30
**Status**: completed
**Role/Modal Used**: spec-test-designer / reasoning
**Model Used**: gpt-5.4 / medium
**Pinned BASE_SHA**: `75a5af42d2f18e3ffee23ebebc6dc99ba20b5606`

## Summary

- froze Phase 12 Phase 3 archive and preview verification against the pinned baseline docs and durable control artifacts only
- authored verification-owned phase-local runtime tests in `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts` and `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- kept verification ownership isolated from production files and legacy shared tests

## Frozen Acceptance And Integration Expectations

- `cdx plan archive` must not mutate `plan.md` before confirmation resolves
- the first archive pass must return a pending confirmation result with a typed pending-approval payload and no archive artifacts yet
- approving the archive continuation must complete the mutation path, set archived state, and emit both archive summary and archive journal markdown artifacts
- archive summary and archive journal artifacts must be visible in durable run artifact listings
- `cdx preview` must be callable as a public CLI workflow and report workflow `preview`
- preview completion must emit a markdown output artifact plus a view URL artifact or equivalent field
- both preview artifacts must be visible in durable run artifact listings

## Real-Workflow E2E Requirement

- accepted e2e harness for this phase is CLI-flow execution through the real `cdx` entrypoint with `--json`
- required public workflows:
  - `cdx plan archive`
  - `cdx preview`
- direct workflow calls alone do not satisfy the e2e requirement for this phase
- direct runtime workflow tests are still required in addition to CLI e2e because they pin state-mutation and artifact-level invariants more tightly
- `N/A` is not acceptable by default for either in-scope workflow in this phase

## Frozen First-Pass Commands

- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- broader regression: `NODE_NO_WARNINGS=1 npm run test:runtime`

## Authored Verification Scope

- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - freezes direct runtime expectations for archive confirmation gating, post-approval mutation, archive summary artifact, archive journal artifact, and durable artifact-list visibility
  - freezes direct runtime expectations for preview markdown output, preview view URL artifact or field, and durable artifact-list visibility
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
  - freezes real-`cdx` e2e for archive confirmation plus approval continuation
  - freezes real-`cdx` e2e for preview artifact emission through the public CLI entrypoint

## Notes

- test design was derived from `README.md`, current phase docs, latest durable control-state, planner decomposition, and control-agent verification policy
- active uncommitted production deltas were treated as implementation-owned candidate changes and were not used as source of truth for acceptance design

## Unresolved Questions

- none
