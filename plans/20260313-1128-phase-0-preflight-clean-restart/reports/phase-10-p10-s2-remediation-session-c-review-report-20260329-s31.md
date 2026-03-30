# Phase 10 `P10-S2` Remediation Session C Review Report (S31)

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` remediation only
**Status**: completed
**Role/Modal Used**: code-reviewer / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## IMPORTANT

### R1 remains open because blocked drifted apply attempts still refresh preview state

- Evidence:
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts:353`
  - `packages/codexkit-daemon/src/workflows/init-workflow.ts:425`
- First drifted `cdx init --apply` is blocked, but the same blocked run still overwrites the stored preview fingerprint/state.
- Direct repro reported by reviewer:
  - preview under default runner
  - first `--apply` under `CODEXKIT_RUNNER='"/bin/cat" /dev/null'` blocks
  - second identical `--apply` succeeds with `applyExecuted: true` and writes files
  - no fresh preview occurs between those two apply attempts
- Impact:
  - still violates `S28` / frozen `P10-S2` requirement that apply remain bound to a reviewed preview

## MODERATE

### Added `R1` regression is too narrow

- Evidence:
  - `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:413`
- Current regression asserts only the first mismatched apply is blocked.
- It does not assert that repeated apply attempts remain blocked until a fresh preview is generated for the new runner selection.
- This allows the suite to stay green while `R1` remains broken.

## No Finding

- `R2` remediation looks correct.
- Explicit empty config runner selection is preserved as `config-file` + invalid instead of absent/default fallback.
- Added `R2` regression is narrow and sufficient for that blocker.

## Verification Notes

- `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism`
  - result: pass (`7/7`)
- blocker-specific isolated runs for the new `R1` and `R2` tests both passed
- direct CLI repro outside the test file confirmed the remaining `R1` bypass

## Blockers

- `R1` still blocks `P10-S2` acceptance: blocked mismatched apply attempts overwrite preview state, so a second apply under the drifted runner succeeds without a fresh preview

## Handoff Notes

- Fix `R1` by only persisting preview state from true preview runs, or otherwise ensuring blocked `--apply` runs cannot refresh approval fingerprint state.
- Extend the `R1` regression to assert:
  - preview under runner A
  - apply under runner B blocks
  - repeated apply under runner B still blocks
  - a new preview under runner B is required before apply can succeed
- `R2` can remain accepted as remediated.
