# Phase 10 `P10-S2` Remediation Session B Tester Report (S30)

**Date**: 2026-03-29
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S2` remediation only
**Status**: completed
**Role/Modal Used**: tester / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Summary

- Frozen B0 was run unchanged first via `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`.
- That unchanged-first aggregate command exited non-zero because the script expands to unrelated broad runtime-suite failures.
- In the same unchanged-first run, the frozen contract file `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts` passed `7/7`.
- An isolated unchanged rerun of the frozen contract file also passed `7/7`.
- `R1` was reported as discharged by tester evidence:
  - drifted `cdx init --apply` blocked with `INIT_APPLY_REQUIRES_PREVIEW`
  - `applyExecuted=false`
- `R2` was reported as discharged by tester evidence:
  - explicit empty config runner stayed `config-file`
  - doctor blocked with typed invalid-runner behavior instead of default fallback
- Host caveat remains explicit:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Commands Run

1. `npm run test:runtime -- tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
   - result: exit `1`
   - note: broad runtime-suite failures outside `P10-S2`; frozen contract file itself passed

2. `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts --no-file-parallelism`
   - result: pass (`7/7`)

3. `R1` CLI harness:
   - `cdx daemon start --once --json`
   - `cdx init --approve-protected --approve-managed-overwrite --json`
   - `CODEXKIT_RUNNER='"/bin/cat" /dev/null' cdx init --apply --approve-protected --approve-managed-overwrite --json`
   - observed:
     - preview `runnerSource=default`
     - apply `runnerSource=env-override`
     - `applyExecuted=false`
     - blocked action includes `INIT_APPLY_REQUIRES_PREVIEW`

4. `R2` CLI harness:
   - fixture `.codexkit/config.toml` with `[runner] command = ""`
   - `cdx daemon start --once --json`
   - `cdx doctor --json`
   - observed:
     - `runnerSource=config-file`
     - `runnerCommand=""`
     - `runnerAvailable=false`
     - `status=blocked`
     - invalid-runner finding present

5. Narrow regression commands:
   - `... -t "treats explicit empty config runner selection as invalid instead of default fallback"`
   - `... -t "blocks init apply when runner selection drifts from the reviewed preview"`
   - result: both pass

## Frozen B0 Mapping

- `F7` preview/apply binding requirement: pass per tester evidence
- shared explicit-empty-config invalid behavior: pass per tester evidence
- unrelated broad runtime-suite failures did not invalidate the frozen `P10-S2` contract in tester view

## Blockers

- none in tester view

## Handoff Notes

- Keep broad `test:runtime` non-zero as handoff context only unless it starts failing the frozen `P10-S2` contract file or the `R1`/`R2` CLI fixtures.
- Keep the raw `npx` `EPERM` caveat explicit in future `P10-S2` reporting.
