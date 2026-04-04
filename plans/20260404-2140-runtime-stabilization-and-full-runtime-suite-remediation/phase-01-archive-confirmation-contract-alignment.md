# Phase 1: Archive Confirmation Contract Alignment

## Overview
Align the older archive-related runtime tests and NFR harnesses with the archive confirmation contract already landed in Phase 12. Archive entry now returns a pending approval gate before mutating plan state; older tests still assume immediate archive completion.

## Requirements
- Treat the Phase 12 archive confirmation contract as the source of truth unless new contradictory runtime evidence appears
- Prefer test and harness updates over reopening the landed archive runtime behavior
- Keep archive confirmation coverage explicit across entry, approval continuation, and post-approval durable artifacts

## Related Code Files
- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

## Implementation Steps
- Confirm the current archive confirmation behavior and continuation path from the landed runtime code and Phase 12 archive tests
- Update legacy archive tests and NFR harness expectations from immediate `valid` to `pending -> approval -> valid`
- Extract or reuse a shared archive-confirmation helper only if it lowers duplication without obscuring the contract
- Re-run the focused archive-related suites before advancing

## Todo Checklist
- [ ] Reconcile `runtime-workflow-wave2.integration.test.ts` with the confirmation-gated archive contract
- [ ] Reconcile `runtime-cli.integration.test.ts` plan archive subcommand expectations with the confirmation-gated archive contract
- [ ] Reconcile `runtime-workflow-phase5-nfr-evidence.integration.test.ts` `NFR-5.2` evidence flow with the confirmation-gated archive contract
- [ ] Keep Phase 12 archive confirmation proof green while the legacy surfaces are updated

## Acceptance Criteria
- No legacy runtime test still expects `plan archive` to return `status: "valid"` before approval resolution
- Archive-focused tests cover both the pending confirmation state and the approved continuation state
- Focused archive-related runtime reruns pass on a clean execution surface

## Verification Commands
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-cli.integration.test.ts`
- `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`

## Success Criteria
- The archive confirmation contract is represented consistently across legacy tests, NFR harnesses, and the landed Phase 12 runtime behavior

## Risk Notes
- Do not weaken the confirmation gate or silently revert to pre-Phase-12 archive mutation behavior just to satisfy older tests
