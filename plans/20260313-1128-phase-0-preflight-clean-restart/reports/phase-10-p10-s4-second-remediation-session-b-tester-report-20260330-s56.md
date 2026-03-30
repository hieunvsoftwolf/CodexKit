# Phase 10 P10-S4 Second-Remediation Session B Tester Report

**Date**: 2026-03-30
**Session**: `S56`
**Role**: tester
**Status**: completed

## Summary

- Frozen `P10-S4` packaged-artifact smoke contract passed unchanged first: `4/4` tests passed.
- Remaining assertion-strength gaps are closed in the current candidate:
  - `F1` now asserts `initApply.runnerCommand` and checks `doctor-report.md` against the effective command value.
  - `F4` now asserts `initReportPath` and `init-report.md` runner source and command for both config-file and env-override variants.
- Direct installed-bin execution still holds with explicit evidence:
  - `installed_bin_path=/Users/hieunv/Claude Agent/CodexKit/.tmp/s56-evidence-rerun/fixture/node_modules/.bin/cdx`
  - `resolved_target_path=/Users/hieunv/Claude Agent/CodexKit/.tmp/s56-evidence-rerun/fixture/node_modules/@codexkit/cli/dist/index.js`
  - `repo_local_cdx=/Users/hieunv/Claude Agent/CodexKit/cdx`
  - `fallbackToRepoCdx=false`
- Daemon-start scaffolding remains absent from the acceptance path.
- Raw `npx` `EPERM` handling remains limited to helper plumbing only.

## Commands Run

```bash
sed -n '1,220p' README.md
sed -n '1,260p' docs/public-beta-quickstart.md
sed -n '1,260p' plans/20260313-1128-phase-0-preflight-clean-restart/plan.md
sed -n '1,320p' plans/20260313-1128-phase-0-preflight-clean-restart/phase-10-public-cli-packaging-and-onboarding.md
sed -n '1,320p' plans/.../reports/control-state-phase-10-p10-s4-second-remediation-wave-2-ready-after-s55-control-agent-20260330-165545.md
sed -n '1,360p' plans/.../reports/phase-10-p10-s4-b0-spec-test-design.md
sed -n '1,360p' plans/.../reports/phase-10-p10-s4-second-remediation-session-a-implementation-summary-20260330-s55.md
sed -n '1,360p' plans/.../reports/phase-10-p10-s4-remediation-session-b-tester-report-20260330-s52.md
sed -n '1,360p' plans/.../reports/phase-10-p10-s4-remediation-session-c-review-report-20260330-s53.md
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism
rg -n "daemon-start|daemonStart|DAEMON_START" tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts tests/runtime/helpers/phase10-packaged-artifact-smoke.ts
rg -n "runPackagedCliWithRawNpxFallback|EPERM|npm_config_cache|npx" tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts tests/runtime/helpers/phase10-packaged-artifact-smoke.ts
```

## Frozen Contract Mapping

- `F1`: proven by unchanged-first pass plus strengthened assertions in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:116` and `:127`
- `F4`: proven by unchanged-first pass plus `initReportPath` and `init-report.md` assertions in both variants at `:245`, `:250`, `:279`, and `:284`
- installed-bin execution proof: explicit standalone evidence under `.tmp/s56-evidence-rerun/`
- `M1`: no daemon-start scaffolding found in the `P10-S4` smoke acceptance files
- host `EPERM` scoping: raw `npx` fallback logic remains confined to helper plumbing

## Blockers

- none

## Handoff Notes

- Frozen `P10-S4` contract passed unchanged first in this rerun.
- `F1` and `F4` appeared durably covered from the tester perspective.
- Installed packaged-bin direct execution remains explicitly evidenced with `fallbackToRepoCdx=false`.

## Unresolved Questions

- none
