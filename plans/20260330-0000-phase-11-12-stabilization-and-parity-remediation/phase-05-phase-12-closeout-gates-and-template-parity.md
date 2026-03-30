# Phase 5: Phase 12 Closeout Gates and Template Parity

## Overview
Finish the remaining parity debt: close the `cook` and `debug` verification gaps, then add the missing plan templates and wire template selection into planning.

## Requirements
- Preserve current workflow behavior where already correct
- Implement only the remaining confirmed partial and missing graph ids
- End with one final parity verification pass against the represented surface

## Related Graph Ids
- `workflow.cook`
- `gate.review_approval`
- `gate.test_pass_required`
- `gate.finalize_required`
- `gate.review_verification_evidence_required`
- `gate.debug_verification_evidence_required`
- `template.feature_implementation`
- `template.bug_fix`
- `template.refactor`
- `template.template_usage_guide`

## Related Code Files
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts`
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
- `packages/codexkit-daemon/src/workflows/review-workflow.ts`
- `packages/codexkit-daemon/src/workflows/test-workflow.ts`
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`
- `packages/codexkit-daemon/src/workflows/plan-files.ts`
- `plans/templates/feature-implementation-template.md`
- `plans/templates/bug-fix-template.md`
- `plans/templates/refactor-template.md`
- `plans/templates/template-usage-guide.md`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

## Implementation Steps
- Remove `cook` finalize deferral where represented parity requires completed review/test/finalize closeout
- Extend `debug` from root-cause handoff to verification-evidence completion where required by the graph
- Add the missing reusable plan templates and teach plan generation to choose them without breaking current plan bundle behavior
- Re-run parity audit against the represented bundle and close only if missing/partial items are resolved

## Todo Checklist
- [ ] Close `cook` review/test/finalize gate gaps in `packages/codexkit-daemon/src/workflows/cook-workflow.ts`, `packages/codexkit-daemon/src/workflows/review-workflow.ts`, `packages/codexkit-daemon/src/workflows/test-workflow.ts`, and `packages/codexkit-daemon/src/workflows/finalize-workflow.ts` [critical]
- [ ] Add debug verification-evidence closeout in `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
- [ ] Add reusable template assets in `plans/templates/feature-implementation-template.md`, `plans/templates/bug-fix-template.md`, `plans/templates/refactor-template.md`, and `plans/templates/template-usage-guide.md`
- [ ] Wire template selection into `packages/codexkit-daemon/src/workflows/plan-files.ts`
- [ ] Re-run runtime tests and the represented-surface parity audit before declaring PASS

## Acceptance Criteria
- `cook` no longer stops short of represented finalize/review/test gate semantics
- `debug` emits verification evidence sufficient to close the represented gate
- Plan generation can use the represented reusable templates rather than only hardcoded markdown synthesis
- Final audit against the consumer bundle returns no confirmed missing or partial required graph ids

## Verification Commands
- `npm run test:runtime -- tests/runtime/runtime-workflow-wave2.integration.test.ts`
- `npm run test:runtime -- tests/runtime/runtime-workflow-phase6-debug.integration.test.ts`
- `npm run test:runtime -- tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `npm run build`
- `npm run typecheck`
- `npm run test:runtime`

## Success Criteria
- CodexKit can credibly move from `PARTIAL` to `PASS` for the represented non-deferred ClaudeKit graph surface relevant to the Codex host port

## Risk Notes
- Do not claim PASS until the final parity audit is rerun from the new baseline
