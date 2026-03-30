# Phase 10 `P10-S4` Remediation Session A Implementation Summary (S51)

**Date**: 2026-03-30
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S4` remediation only
**Status**: completed
**Role/Modal Used**: fullstack-developer / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Scope Guard

- Stayed inside `P10-S4`.
- Limited changes to the packaged-artifact smoke helper and suite only.
- Did not reopen accepted `P10-S0` through `P10-S3`.
- Did not widen into release-readiness closure beyond packaged-artifact smoke and go/no-go evidence.

## Implemented Changes

1. Fixed `B1` by switching execution from `node <internal-entrypoint>` to the installed packaged-artifact `cdx` bin and enforcing no repo-local fallback in helper logic.
2. Fixed `F1` by extending the fresh-repo lane to run installed-artifact `init` preview/apply plus `doctor`, and proving `installOnly === true` with report assertions.
3. Fixed `F3` by extending the install-only lane to include blocked probes for `cook`, `review`, and `test`, plus `debug`.
4. Fixed `F4` by extending the wrapped-runner lane to prove both config-file-selected runner and env-override-beats-config through the packaged artifact.
5. Fixed `M1` by removing `cdx daemon start --once` from the acceptance path.

## Files Updated

- `tests/runtime/helpers/phase10-packaged-artifact-smoke.ts`
- `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`

## Verification

Commands run:

1. `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism`
   - unchanged-first baseline before edits: pass (`4/4`)
   - after first remediation patch: fail (`1/4`, F4 config doctor source observed default), then patched
   - after second patch: fail (`1/4`, equivalent quote normalization mismatch), then patched
   - final rerun: pass (`4/4`) in `66.88s`

## Installed-Bin Evidence Surfaces

- `packagedTarballPath`
- `packagedInstallRoot`
- `packagedInstalledBinPath`
- `packagedResolvedBinPath`
- `fallbackToRepoCdx: false`

## Unresolved Questions

- none
