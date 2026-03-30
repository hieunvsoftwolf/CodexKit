# Phase 3: Phase 12 Archive and Preview Parity

## Overview
Close the smallest high-value parity gaps first: archive confirmation/journal semantics and preview workflow/artifact output. These are isolated enough to land early and reduce the remaining missing graph surface.

## Requirements
- Implement only confirmed missing graph surface
- Follow consumer-bundle contracts, not raw source reinterpretation
- Add runtime tests with artifact-level assertions

## Related Graph Ids
- `artifact.journal_entry_md`
- `artifact.preview_output_md`
- `artifact.preview_view_url`
- `gate.plan_archive_confirmation_required`

## Related Code Files
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- `packages/codexkit-daemon/src/workflows/artifact-paths.ts`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

## Implementation Steps
- Add an explicit archive confirmation checkpoint before `plan archive` mutates `plan.md`
- Emit a journal artifact as part of archive closeout
- Add a dedicated preview workflow port with markdown output and view URL emission
- Route preview through the CLI/controller surface and verify artifact publishing

## Todo Checklist
- [ ] Add archive confirmation handling for `gate.plan_archive_confirmation_required` in `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts` and `packages/codexkit-cli/src/workflow-command-handler.ts` [critical]
- [ ] Emit `artifact.journal_entry_md` from archive closeout and publish it through the artifact service
- [ ] Add a preview workflow implementation and exports in `packages/codexkit-daemon/src/workflows/index.ts`
- [ ] Wire CLI/controller support for preview in `packages/codexkit-cli/src/workflow-command-handler.ts` and `packages/codexkit-daemon/src/runtime-controller.ts`
- [ ] Add runtime tests that assert `artifact.preview_output_md` and `artifact.preview_view_url` are both produced

## Acceptance Criteria
- `cdx plan archive` no longer mutates state before a confirmation gate resolves
- Archive emits both archive summary and journal artifact output
- Preview emits a markdown artifact and a view URL artifact/field consistent with the represented graph contract

## Verification Commands
- `npm run test:runtime -- tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `npm run test:runtime -- tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `npm run test:runtime`

## Success Criteria
- All currently confirmed missing archive/preview graph ids move out of the missing bucket

## Risk Notes
- Keep preview implementation narrow; do not expand into non-required visual features
