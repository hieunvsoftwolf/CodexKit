# Phase 2: Phase 11 Verification, Freeze, and Smoke

## Overview
Convert the stabilized baseline into a trusted release candidate for internal use. This phase proves the current shipped surface works before Phase 12 adds more behavior.

## Requirements
- Verify only implemented and intended current product surface
- Produce one clear freeze point for later Phase 12 work
- Record what works now versus what stays deferred to parity work

## Related Code Files
- `package.json`
- `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-onboarding-contract.integration.test.ts`
- `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`
- `docs/public-beta-quickstart.md`
- `README.md`

## Implementation Steps
- Run the full build, typecheck, and runtime verification set on the stabilized branch
- Re-run packaging and smoke paths that prove the current Phase 10 user journey is still valid
- Capture a freeze summary with exact commands, results, and any known non-blocking limitations
- Tag or otherwise designate the Phase 11 baseline commit only after the verification set is green

## Todo Checklist
- [ ] Run baseline verification with `npm run build`, `npm run typecheck`, and `npm run test:runtime` [critical]
- [ ] Run packaging/smoke verification for the current beta surface using `npm run build:cli-artifact`, `npm run pack:cli`, and `npm run smoke:cli:tarball`
- [ ] Re-check onboarding and contract tests in `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`, `tests/runtime/runtime-workflow-phase10-onboarding-contract.integration.test.ts`, and `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts`
- [ ] Write a freeze summary and baseline handoff report under this plan directory
- [ ] Record the exact commit or tag that becomes the Phase 11 baseline for Phase 12

## Acceptance Criteria
- A single baseline commit is identified as the Phase 11 freeze point
- Build, typecheck, runtime tests, and packaging smoke all complete successfully from that baseline
- `README.md` and `docs/public-beta-quickstart.md` still describe a working user path for the current implemented feature set

## Verification Commands
- `npm run build`
- `npm run typecheck`
- `npm run test:runtime`
- `npm run build:cli-artifact`
- `npm run pack:cli`
- `npm run smoke:cli:tarball`

## Success Criteria
- Phase 12 starts from a clean, documented, buildable, and smoke-verified baseline

## Risk Notes
- Do not treat a build-only result as sufficient
- If packaging smoke fails, Phase 12 should not start until the baseline is trustworthy again
