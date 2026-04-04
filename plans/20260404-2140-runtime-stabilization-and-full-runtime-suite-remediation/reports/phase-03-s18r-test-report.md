# Phase 03 S18R Test Report

Date: 2026-04-05
Session: S18R
Role: tester
Status: completed
Phase: Phase 03 Phase 9 golden trace canonicalization
Pinned BASE_SHA: `537f1a8aed241b72664771a1295347dc9713a1e0`

## Execution Surface

- Worktree: `/Users/hieunv/Claude Agent/CodexKit-p03-phase9-golden-s16`
- Branch: `phase-03-phase9-golden-trace-s16`
- Source of truth used: remediated S16/S16R candidate worktree + frozen S17 verification contract + latest durable control-state

## Frozen S17 Subset (run first, unchanged)

1. Command:
   - `git ls-files --stage tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
   - Exit: `0`
   - Result: pass (canonical fixture tracked)
   - Raw log: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/01-git-ls-files-canonical.log`

2. Command:
   - `git ls-files --stage plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json`
   - Exit: `0`
   - Result: pass (no tracked entry returned for historical report path)
   - Raw log: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/02-git-ls-files-historical.log`

3. Command:
   - `rg -n "phase-9-frozen-claudekit-plan-cook-trace.json|tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json" tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
   - Exit: `1`
   - Result: non-blocking under known caveat; frozen literal-path grep can false-negative when active path is assembled with `path.join(...)` segments
   - Raw log: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/03-rg-frozen-paths.log`

4. Command:
   - `TMPDIR=.tmp NODE_NO_WARNINGS=1 npm_config_cache="$PWD/.npm-cache" npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
   - Exit: `0`
   - Result: pass (`1` file, `1` test; assertion-layer reached)
   - Raw log: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/04-vitest-phase9-golden.log`

## Bounded Follow-Up (for frozen grep brittleness)

### Active constant assembly inspection

- Evidence: constant built via `path.join(process.cwd(), "tests", "fixtures", "phase9", "frozen-claudekit-plan-cook-trace.json")` and read through `readFileSync(FROZEN_CLAUDEKIT_PLAN_COOK_TRACE_PATH, "utf8")`.
- Raw logs:
  - `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/05-inspect-constant-assembly.log`
  - `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/07-rg-canonical-assembly-signals.log`

### Historical live-read exclusion

- Command:
  - `rg -n "plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-frozen-claudekit-plan-cook-trace.json" tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
- Exit: `1`
- Result: no literal historical report-path live read remains in active test file.
- Raw log: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/logs/s18r/06-rg-historical-live-read.log`

## Acceptance Target Check (S18R)

- Canonical fixture file exists and is tracked in candidate: pass
  - Evidence: `01-git-ls-files-canonical.log`
- Historical report-path JSON is not canonical tracked source: pass
  - Evidence: `02-git-ls-files-historical.log`
- Active test no longer performs live read from historical report path: pass
  - Evidence: `06-rg-historical-live-read.log`, `05-inspect-constant-assembly.log`
- Focused suite reaches assertion-layer execution and exits `0`: pass
  - Evidence: `04-vitest-phase9-golden.log`
- Frozen grep exit `1` classification:
  - Classified as known literal-path false-negative only after bounded evidence proved canonical path is assembled and live via `path.join(...)` and historical live read is absent.
  - Evidence: `03-rg-frozen-paths.log`, `05-inspect-constant-assembly.log`, `07-rg-canonical-assembly-signals.log`, `06-rg-historical-live-read.log`

## Host Caveats Preserved

- Did not use host-local untracked historical report JSON as live input or as pass proof.
- Preserved known caveat: frozen literal-path `rg` can false-negative because active test assembles canonical path with `path.join(...)` segments.

## Unresolved Questions

- none
