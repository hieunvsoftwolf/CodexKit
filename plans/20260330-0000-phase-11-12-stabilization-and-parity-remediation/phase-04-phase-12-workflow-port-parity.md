# Phase 4: Phase 12 Workflow Port Parity

## Overview
Port the remaining standalone workflow surfaces that still exist only as vendored source skills or deferred CLI placeholders. The goal is runnable Codex-host workflow ports, not broad product redesign.

## Requirements
- Cover only confirmed partial workflow parity gaps
- Reuse existing primitive/task/approval infrastructure
- Keep new workflow files focused and testable

## Related Graph Ids
- `workflow.fix`
- `workflow.team`
- `workflow.docs`
- `workflow.scout`

## Related Code Files
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/workflows/repo-scan-engine.ts`
- `packages/codexkit-compat-mcp/src/invoke-tool.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-compat-primitives.integration.test.ts`

## Implementation Steps
- Replace deferred `fix` and `team` command paths with runnable workflow/controller entries
- Add standalone docs and scout workflow ports that reuse existing artifact and primitive infrastructure
- Keep team workflow built on current `team` primitives rather than introducing a separate orchestration substrate
- Add targeted runtime tests for each newly ported workflow

## Todo Checklist
- [ ] Implement `workflow.fix` and remove the deferred path from `packages/codexkit-cli/src/workflow-command-handler.ts` [critical]
- [ ] Implement `workflow.team` using existing team/message/task primitives in `packages/codexkit-daemon/src/runtime-controller.ts` and `packages/codexkit-compat-mcp/src/invoke-tool.ts`
- [ ] Add standalone `docs` workflow port with explicit artifact outputs instead of finalize-only docs impact
- [ ] Add standalone `scout` workflow port that produces a scout report rather than relying on internal review-only scout steps
- [ ] Add or update runtime tests for `fix`, `team`, `docs`, and `scout`

## Acceptance Criteria
- The CLI no longer reports `fix` or `team` as deferred for their represented workflow surfaces
- Docs and scout have standalone runnable workflow paths and artifacts
- New workflow tests prove user-entry command surface, durable run creation, and artifact publication

## Verification Commands
- `npm run test:runtime -- tests/runtime/runtime-cli.integration.test.ts`
- `npm run test:runtime -- tests/runtime/runtime-compat-primitives.integration.test.ts`
- `npm run test:runtime`

## Success Criteria
- Represented workflow surfaces that were previously vendored-only or deferred are now runnable in CodexKit

## Risk Notes
- Avoid pulling in bundle-adjacent but non-required workflows during this porting phase
