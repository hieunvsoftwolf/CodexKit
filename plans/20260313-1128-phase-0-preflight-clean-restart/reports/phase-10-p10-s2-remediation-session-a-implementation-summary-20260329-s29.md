# Phase 10 `P10-S2` Remediation Session A Implementation Summary (S29)

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` remediation only
**Status**: completed
**Role/Modal Used**: fullstack-developer / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Scope Guard

- Stayed in `P10-S2`.
- Did not reopen accepted `P10-S0` or `P10-S1`.
- Did not widen into `P10-S3`, `P10-S4`, or release-readiness closure.
- Kept the frozen `P10-S2` B0 artifact unchanged.
- Kept the host caveat explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Implemented Changes

1. Fixed `R1` by binding `cdx init` preview/apply approval fingerprint to runner-selection metadata.
   - Added runner source, rendered runner command, selection state, and invalid reason into the preview/apply fingerprint path.
   - This blocks apply when runner selection drifts from the reviewed preview instead of allowing mutation under a different runner.

2. Fixed `R2` by treating explicit empty config runner selection as invalid rather than absent.
   - Empty `[runner] command = ""` now remains an explicit invalid selection instead of silently falling back to default `codex exec`.

3. Added only the narrow regression coverage needed to pin `R1` and `R2`.
   - Added a regression that blocks `cdx init --apply` when runner selection changes after preview.
   - Added a regression that asserts explicit empty config runner selection yields typed invalid-runner behavior instead of default fallback.

## Files Updated

- `packages/codexkit-daemon/src/workflows/init-workflow.ts`
- `packages/codexkit-daemon/src/runtime-config.ts`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`

## Verification

Commands run:

1. `npm run build`
   - result: pass

2. `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
   - result: overall exit `1` because the script still runs the broad runtime suite and hits pre-existing unrelated failures
   - relevant note: the targeted `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` subset passed `7/7`

3. `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism -t "treats explicit empty config runner selection as invalid instead of default fallback"`
   - result: pass

4. `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism -t "blocks init apply when runner selection drifts from the reviewed preview"`
   - result: pass

## Contract Mapping

- `R1` preview/apply runner drift is blocked and pinned by regression evidence: done
- `R2` explicit empty config runner selection is invalid, not absent/default fallback: done
- remediation stayed narrow and did not change the frozen B0 artifact: done

## Residual Risks

- The unchanged broad `npm run test:runtime` path still includes unrelated runtime-suite failures outside `P10-S2`, mostly around stderr JSON parse pollution from Node SQLite warnings plus one daemon assertion mismatch.
- Those failures were not treated as `P10-S2` blockers because the targeted `P10-S2` contract subset and the new narrow regressions passed.

## Unresolved Questions

- none
