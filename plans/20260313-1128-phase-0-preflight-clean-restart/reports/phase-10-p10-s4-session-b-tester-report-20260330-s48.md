# Phase 10 `P10-S4` Session B Tester Report (S48)

**Date**: 2026-03-30
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S4` only
**Status**: blocked
**Role/Modal Used**: tester / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Summary

- Frozen `P10-S4` B0 command was run unchanged first and passed:
  - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism`
  - result: `4/4` tests passed
- Packaged-artifact execution rule was independently re-verified with explicit installed-bin evidence:
  - tarball path captured
  - installed bin path captured
  - resolved real path captured
  - repo-local `./cdx` path captured separately
  - `fallback_to_repo_cdx=false`
- Host raw-`npx` `EPERM` caveat remains explicit and is treated as host-safe install plumbing only, not as acceptance downgrade to repo-local `./cdx`

## Frozen B0 Mapping

- `F1` fresh repo install and doctor: **partial only**
  - current test covers doctor via packaged `npx` fallback path
  - missing full `init` preview/apply plus explicit `installOnly` proof in this lane
- `F2` git-backed repo install and quickstart workflow: **covered**
- `F3` install-only gating: **partial only**
  - current test checks `cook` and `debug` blocked
  - frozen B0 requires `cook`, `review`, and `test` probes, plus optional extra worker-backed workflow
- `F4` wrapped-runner path: **partial only**
  - current test verifies env override path
  - frozen B0 requires both:
    - config-file-selected variant
    - env-override-beats-config variant

## Evidence

- tarball: `/Users/hieunv/Claude Agent/CodexKit/.tmp/p10-s4-evidence/pack-GVuGnS/codexkit-cli-0.1.0.tgz`
- installed bin: `/Users/hieunv/Claude Agent/CodexKit/.tmp/p10-s4-evidence/fixture-UIVjLu/node_modules/.bin/cdx`
- resolved real path: `/Users/hieunv/Claude Agent/CodexKit/.tmp/p10-s4-evidence/fixture-UIVjLu/node_modules/@codexkit/cli/dist/index.js`
- repo local path: `/Users/hieunv/Claude Agent/CodexKit/cdx`
- fallback check: `fallback_to_repo_cdx=false`

## Blockers

- `F1` lane is not fully implemented per frozen B0 acceptance checks
- `F3` lane is missing required `review` and `test` install-only blocked probes
- `F4` lane is missing required config-file runner-selection variant

## Handoff Notes

- Keep the existing frozen command as the first-run gate; it is green but insufficient for full B0 acceptance.
- Preserve the packaged-artifact-only acceptance path; do not accept repo-local `./cdx` fallback.
- Keep `EPERM` handling scoped to npm cache plumbing only.
