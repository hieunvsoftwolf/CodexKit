# Phase 3: Phase 9 Golden Trace Canonicalization

## Overview
Remove the live dependency on a historical Phase 9 report-path artifact and move the golden parity suite onto a canonical repo-owned frozen trace source that current tests can rely on.

## Requirements
- Historical reports stay preserved for audit and traceability, but they must not remain the only live source for current runtime tests
- The frozen trace source used by Phase 9 golden parity must live at a canonical repo-owned path intended for active test consumption
- The canonical source and the golden parity test must stay consistent with the current NFR evidence model

## Related Code Files
- `tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`
- `tests/runtime/helpers/phase9-evidence.ts`
- `tests/fixtures/phase9/frozen-claudekit-plan-cook-trace.json`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-third-remediation-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-third-remediation-wave-2-ready-after-sa.md`

## Implementation Steps
- Introduce a canonical repo-owned frozen trace source path for active Phase 9 golden parity testing
- Update the golden parity suite to read the canonical path instead of a historical plan-report path
- Keep historical Phase 9 reports unchanged except where a current note must clarify that they are trace-only evidence
- Re-run the focused golden parity suite and confirm the evidence references remain durable

## Todo Checklist
- [ ] Add a canonical repo-owned frozen trace source for current Phase 9 golden parity testing
- [ ] Update `runtime-workflow-phase9-golden-parity.integration.test.ts` to use the canonical frozen trace source
- [ ] Keep historical Phase 9 report paths traceable without making them live runtime dependencies

## Acceptance Criteria
- The golden parity suite no longer fails with `ENOENT` on a historical report-path dependency
- The active frozen trace source lives under a canonical repo-owned path intended for current test consumption
- Historical reports remain available for traceability but are not required as live test inputs

## Verification Commands
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase9-golden-parity.integration.test.ts`

## Success Criteria
- Phase 9 golden parity evidence uses a durable canonical source that fits the current repo layout and test model

## Risk Notes
- Do not paper over the missing source by restoring a stale historical path unless the current contract explicitly restores that path as canonical
