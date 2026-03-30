# Phase 10 Remediation Session C Review Report

- Date: 2026-03-27
- Status: completed
- Session role: reviewer
- Modal: default
- Scope: narrowed `P10-S0` remediation review against pinned `BASE_SHA` `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Findings

### IMPORTANT: malformed runner override/config values still fall through silently instead of surfacing a typed invalid-runner block

`resolveWorkerRunnerConfig()` now tokenizes quoted commands, but it still treats parse failure as "source absent" and falls through to the next precedence source or the default runner instead of preserving the selected source as invalid. The failure path is visible in [`packages/codexkit-daemon/src/runtime-config.ts:27`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-config.ts#L27) and [`packages/codexkit-daemon/src/runtime-config.ts:153`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-config.ts#L153): `parseRunnerCommandText()` returns `null` for unmatched quotes or dangling escapes, and `resolveWorkerRunnerConfig()` then skips straight to config/default.

That still violates the frozen `P10-S0` contract in [`plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md:155`](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md#L155), which explicitly says no path may silently fall back from an invalid override/config to bare `codex exec`. I reproduced it with `CODEXKIT_RUNNER='"/broken path exec' cdx doctor --json`: the command reported `runnerSource: "default"` and `runnerCommand: "codex exec"` instead of a typed invalid-runner diagnostic. The new Phase 10 freeze test only covers valid quoted inputs plus a missing executable case, so this regression path is still unpinned in [`tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:89`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts#L89).

### MODERATE: `cdx doctor` rejects valid wrapper runners that do not implement a bare `--version` probe

The new doctor availability check validates the selected runner by executing only the first token with `--version`, ignoring the rest of the configured runner command. That behavior is in [`packages/codexkit-daemon/src/workflows/doctor-workflow.ts:102`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/doctor-workflow.ts#L102). For a configured wrapper such as `"/path/to/runner-wrapper" exec`, doctor probes `runner-wrapper --version`, not the actual selected command shape.

That produces false `DOCTOR_SELECTED_RUNNER_INCOMPATIBLE` blocks for wrappers that are valid for worker launch but do not expose a standalone `--version` mode. I reproduced this with a local wrapper script that accepts `exec` and the normal launch flags but rejects `--version`; `cdx doctor --json` blocked even though the selected runner command itself was usable. This weakens the frozen wrapper-command contract in [`plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md:137`](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md#L137) and [`plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md:178`](/Users/hieunv/Claude%20Agent/CodexKit/plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-1-b0-spec-test-design.md#L178). The current test coverage only asserts the missing-runner path, not the valid-wrapper-without-`--version` path, in [`tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:171`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts#L171).

## Open Questions Or Assumptions

- Assumed the authoritative public package/bin seam blocker is closed: the root manifest no longer carries the duplicate contract metadata, and the Phase 10 freeze test now asserts the CLI package metadata against the shared seam.
- Assumed reviewer scope remains candidate-only and excludes tester rerun output and verdict rerun output, per prompt.
- Targeted Vitest rerun was not cleanly usable as a reviewer signal in this sandbox: `npm run test:runtime -- ...` expanded to the full runtime suite and surfaced an unrelated Phase 1 daemon failure, and direct `npx vitest` needed `TMPDIR=.tmp` because the default temp path was sandbox-blocked. The findings above are grounded in current-tree code inspection plus direct `cdx doctor --json` reproductions.

## Change Summary

- The narrowed remediation does centralize the public `@codexkit/cli` and `cdx` contract into one authoritative seam and binds manifests/docs to it in the Phase 10 freeze test.
- The remaining open blockers are both in the runner-contract path, so `P10-S0` should still stay in remediation rather than advancing to later Phase 10 lanes.
