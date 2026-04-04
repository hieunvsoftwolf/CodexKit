# Phase 4: Full Runtime Suite Closeout

## Overview
Run the full stabilization closeout after the three failure groups are fixed or reclassified. This phase exists to prove the repo no longer depends on the old baseline/pre-existing exception model for these surfaces.

## Requirements
- Re-run build, typecheck, focused suites, and the full runtime suite on a clean execution surface
- Keep host caveats explicit when they affect verification execution
- Publish one concise closeout report that records the grouped root causes, fixes, and final green evidence

## Related Code Files
- `package.json`
- `tests/runtime/`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`

## Implementation Steps
- Re-run focused suites for phases 1 through 3 on the clean execution surface
- Re-run `npm run build`, `npm run typecheck`, and `npm run test:runtime`
- Record exact commands, execution surface, exit codes, and any preserved host caveat
- Declare the plan complete only after the full runtime suite is green

## Todo Checklist
- [ ] Re-run focused phase 1 verification
- [ ] Re-run focused phase 2 verification
- [ ] Re-run focused phase 3 verification
- [ ] Re-run `npm run build`
- [ ] Re-run `npm run typecheck`
- [ ] Re-run `npm run test:runtime`
- [ ] Publish the stabilization closeout report

## Acceptance Criteria
- `npm run build` passes on the clean execution surface
- `npm run typecheck` passes on the clean execution surface
- `npm run test:runtime` passes on the clean execution surface
- The closeout report no longer relies on the old "baseline/pre-existing" classification for these three grouped failure surfaces

## Verification Commands
- `npm run build`
- `npm run typecheck`
- `npm run test:runtime`

## Success Criteria
- The landed `main` baseline is stable enough that the full runtime suite is part of normal green verification, not an accepted red baseline

## Risk Notes
- Keep build artifacts and worktree-local state explicit; do not mistake missing local build output for a product regression during final closeout
