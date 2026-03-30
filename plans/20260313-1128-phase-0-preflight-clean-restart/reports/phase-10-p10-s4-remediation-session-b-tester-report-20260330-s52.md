# Phase 10 `P10-S4` Remediation Session B Tester Report (S52)

**Date**: 2026-03-30
**Phase**: Phase 10 Public CLI Packaging and Onboarding
**Scope**: `P10-S4` remediation only
**Status**: completed
**Role/Modal Used**: tester / Default
**Model Used**: GPT-5 / Codex CLI
**Skill Route**: `none required`

## Summary

- Frozen `P10-S4` packaged-artifact smoke contract was run unchanged first and passed (`4/4`).
- Current candidate closes `B1`, `F1`, `F3`, `F4`, and `M1` in tester view.
- Direct installed-bin execution was verified with explicit path evidence and `fallback_to_repo_cdx=false`.
- Daemon-start scaffolding is no longer in the acceptance path.
- Raw `npx` `EPERM` handling remains limited to helper plumbing only.

## Commands Run

1. `cd '/Users/hieunv/Claude Agent/CodexKit' && TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism`
   - unchanged-first result: `4/4` tests passed, duration `147.67s`

2. direct installed-bin evidence probe
   - emitted:
     - `tarball_path=/Users/hieunv/Claude Agent/CodexKit/.tmp/s52-evidence/pack-wgMwbk/codexkit-cli-0.1.0.tgz`
     - `install_root=/Users/hieunv/Claude Agent/CodexKit/.tmp/s52-evidence/fixture-SsHnOe`
     - `installed_bin_path=/Users/hieunv/Claude Agent/CodexKit/.tmp/s52-evidence/fixture-SsHnOe/node_modules/.bin/cdx`
     - `resolved_target_path=/Users/hieunv/Claude Agent/CodexKit/.tmp/s52-evidence/fixture-SsHnOe/node_modules/@codexkit/cli/dist/index.js`
     - `repo_local_cdx=/Users/hieunv/Claude Agent/CodexKit/cdx`
     - `fallback_to_repo_cdx=false`

## Frozen B0 Mapping

- `B1` direct installed-bin execution: closed in tester view
- `F1` fresh repo `init` preview/apply + `doctor` + `installOnly` proof: closed in tester view
- `F3` install-only blocked probes including `review` and `test`: closed
- `F4` config-file-selected and env-over-config wrapped-runner proof: closed in tester view
- `M1` daemon-start scaffolding removed: closed

## Blockers

- none in tester view

## Handoff Notes

- Frozen `P10-S4` contract passes unchanged-first on the current candidate in tester view.
- Current smoke suite provides packaged-artifact path proof for all required lanes without repo-local fallback or daemon-start scaffolding.
