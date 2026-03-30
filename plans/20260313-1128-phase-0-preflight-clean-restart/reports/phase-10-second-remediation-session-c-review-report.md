# Phase 10 Second Remediation Session C Review Report

- Date: 2026-03-27
- Status: completed
- Session role: reviewer
- Modal: default
- Scope: narrowed `P10-S0` second-remediation review against pinned `BASE_SHA` `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Findings

### IMPORTANT: invalid selected-runner state still reaches worker launch as an opaque process failure instead of a typed preflight block

The second remediation fixes `cdx doctor` and `cdx init`, but the runtime still does not guard worker-backed launch when the selected runner is already known-invalid. `resolveWorkerRunnerConfig()` now preserves malformed env/config input as `selectionState: "invalid"` with an empty `command` array in [`runtime-config.ts:192`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-config.ts#L192). `WorkerRuntime` then blindly feeds that array into `buildDefaultWorkerCommand()` and appends launch flags anyway in [`worker-runtime.ts:14`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runner/worker-runtime.ts#L14) and [`worker-runtime.ts:79`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runner/worker-runtime.ts#L79). With an invalid selected runner, the effective process command becomes just the bundle flags, so launch degrades into a generic worker failure instead of a stable typed diagnostic at workflow entry.

I reproduced this on the current tree by opening a throwaway git fixture under `.tmp/review-fixtures`, forcing `config.workerRunner` into the same invalid shape that `resolveWorkerRunnerConfig()` now returns, and spawning a worker through `WorkerRuntime`. The worker registered and entered launch, then failed with exit code `1`; there was no runner-specific typed block before execution. That means the narrowed blocker is only closed for `doctor`/`init`, not for the actual worker-backed runtime path the frozen runner contract is meant to protect. It also creates a new regression relative to the old behavior: the system no longer falls back silently, but it still does not stop invalid selected-runner state cleanly before worker execution.

## Open Questions Or Assumptions

- Assumed the authoritative public package/bin seam remains closed. The current tree still aligns [`package.json`](/Users/hieunv/Claude%20Agent/CodexKit/package.json), [`packages/codexkit-cli/package.json`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/package.json), [`README.md`](/Users/hieunv/Claude%20Agent/CodexKit/README.md), [`docs/system-architecture.md`](/Users/hieunv/Claude%20Agent/CodexKit/docs/system-architecture.md), and [`tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts).
- Assumed reviewer scope excludes tester rerun output and verdict rerun output, per prompt.
- Clean direct repros confirmed both intended Session A closure claims in isolation:
- malformed `CODEXKIT_RUNNER` now stays on `env-override` and returns `DOCTOR_SELECTED_RUNNER_INVALID`
- a fixed-arg wrapper shape such as `CODEXKIT_RUNNER='\"/bin/cat\" /dev/null'` no longer triggers `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE`
- Focused Vitest executions were not usable as primary reviewer evidence in this sandbox because concurrent repo-local runtime activity left the processes hung and one direct workspace `doctor` repro hit `database is locked`. The report is grounded in current-tree code inspection plus isolated fixture repros.

## Change Summary

- The narrowed second remediation does close the two prior `doctor`-path blockers: malformed selected-runner text now yields a typed invalid state, and `cdx doctor` no longer falsely blocks valid fixed-arg wrapper commands.
- One runner-path issue still remains on the actual worker launch path, so `P10-S0` should not be accepted yet.
