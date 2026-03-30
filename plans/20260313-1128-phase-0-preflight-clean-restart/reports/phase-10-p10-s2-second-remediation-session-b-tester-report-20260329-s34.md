# Phase 10 `P10-S2` Second-Remediation Session B Tester Report (S34)

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` second remediation only
**Status**: completed
**Role/Modal Used**: tester / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Summary

- Frozen B0 was run unchanged first via `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`.
- The aggregate unchanged-first command still exited non-zero, but the frozen contract file `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` passed `7/7` in that same run.
- Isolated frozen-contract rerun passed.
- The required `S33` continuation path matched expected behavior exactly:
  - preview under runner A
  - apply under runner B blocks
  - repeated apply under runner B still blocks
  - preview under runner B occurs
  - apply under runner B succeeds
- `R1` is discharged by tester evidence.
- `R2` remains accepted; no current-tree contradiction found.
- Host caveat remains explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Commands Run

1. `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
   - result: aggregate exit `1`
   - note: frozen contract file passed `7/7`; unrelated files still failed outside `P10-S2`

2. `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism --testTimeout=60000`
   - result: pass

3. Direct CLI continuation harness in a fresh git fixture:
   - `cdx daemon start --once --json`
   - ordered `cdx init` preview/apply calls under runner A and runner B to verify the full continuation path
   - result: matched expected `INIT_APPLY_REQUIRES_PREVIEW` behavior until a fresh preview under runner B occurred

## Frozen B0 Mapping

- unchanged-first execution requirement: satisfied
- frozen contract suite expectation: satisfied by `7/7` pass for `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
- `F7` continuation contract: satisfied by direct CLI evidence
- explicit empty-config invalid-runner behavior: still satisfied by the frozen contract suite

## Blockers

- none

## Handoff Notes

- Keep treating the broad `test:runtime` non-zero as out-of-slice handoff context unless it starts failing the frozen `P10-S2` contract file or the `R1`/`R2` behavior.
- Keep the raw `npx` `EPERM` caveat explicit in `P10-S2` reporting.
