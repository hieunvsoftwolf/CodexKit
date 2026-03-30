# Phase 10 `P10-S2` Second-Remediation Session A Implementation Summary (S33)

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` second remediation only
**Status**: completed
**Role/Modal Used**: fullstack-developer / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Scope Guard

- Stayed in `P10-S2`.
- Did not reopen accepted `P10-S0` or `P10-S1`.
- Did not widen into `P10-S3`, `P10-S4`, or release-readiness closure.
- Kept the frozen `P10-S2` B0 artifact unchanged.
- Kept `R2` accepted and untouched.
- Kept the host caveat explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Implemented Changes

1. Closed the remaining `R1` continuation-path hole.
   - Prevented `cdx init` preview-state persistence on `--apply` runs.
   - Blocked `--apply` attempts can no longer refresh the approval fingerprint or preview state.

2. Expanded the `R1` regression to the full required continuation flow.
   - asserted:
     - preview under runner A
     - apply under runner B blocks
     - repeated apply under runner B still blocks
     - preview under runner B succeeds
     - apply under runner B then succeeds

## Files Updated

- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`

## Verification

Commands run:

1. `npm run build`
   - result: pass

2. `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
   - result: exit `1`
   - note: unchanged broad runtime-suite behavior remains
   - relevant note: within that unchanged-first run, `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` passed `7/7`, including the new `R1` continuation-path test

3. `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism -t "requires a fresh preview before apply can proceed after runner drift"`
   - result: pass (`1 passed, 6 skipped`)

## Contract Mapping

- remaining `R1` continuation bypass is fixed: done
- blocked `--apply` attempts no longer refresh preview state: done
- repeated apply under drifted runner remains blocked until a new preview occurs: done
- remediation stayed narrow and left `R2` accepted: done

## Residual Risks

- unchanged broad `npm run test:runtime` still exits non-zero because it expands to unrelated runtime-suite failures outside `P10-S2`
- those failures remain handoff context only unless they begin to fail the frozen `P10-S2` contract or the `R1`/`R2` acceptance paths

## Unresolved Questions

- none
