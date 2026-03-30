# Phase 10 Wave 1 Session C Review Report

- Date: 2026-03-27
- Status: completed
- Session role: reviewer
- Modal: default
- Scope: candidate-only review of `P10-S0` shared contract freeze against pinned `BASE_SHA` `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Findings

### IMPORTANT: the public artifact and `cdx` bin contract is not actually frozen in one shared seam

The review target asked for one frozen public npm artifact shape and one `cdx` bin contract. The candidate currently duplicates that contract across three separate anchors:

- root workspace manifest still carries a `cdx` bin plus its own `codexkitPhase10Contract` block in `package.json:9-18`
- `@codexkit/cli` carries its own `cdx` bin plus a second `codexkitPhase10Contract` block in `packages/codexkit-cli/package.json:6-13`
- the daemon-side shared constants define the same package, bin, command-form, runner, and smoke-matrix contract in `packages/codexkit-daemon/src/workflows/packaging-contracts.ts:20-103`

The new verification only pins the daemon-side constants in `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:26-45`; it does not assert that either manifest matches those constants. That means the actual manifest seam that later `P10-S1` must pack can drift without any failing contract test. This is a direct miss against the stated goal that the shared contract be frozen in one place and not drift across docs/code.

### MODERATE: runner command parsing bakes in an unstable whitespace-tokenization assumption for later wrapped-runner lanes

`resolveWorkerRunnerConfig()` advertises env/config runner overrides as the frozen shared seam, but `parseRunnerCommandText()` tokenizes both sources with a raw whitespace split in `packages/codexkit-daemon/src/runtime-config.ts:27-33`, then feeds those tokens straight into worker launch in `packages/codexkit-daemon/src/runtime-config.ts:117-124` and `packages/codexkit-daemon/src/runner/worker-runtime.ts:79-85`.

That works for simple values like `codex-safe exec --profile beta`, but it breaks any quoted arg or executable path containing spaces. Example shape: `command = "codex-safe exec --label 'beta team'"` would be split into the wrong argv. The frozen docs/spec explicitly position wrapped runners plus fixed args as a supported downstream contract in `docs/workflow-extended-and-release-spec.md:897-917`, so this introduces a hidden parsing restriction that later lanes would have to either preserve or break. That is the kind of unstable assumption this review was asked to catch.

## Open Questions Or Assumptions

- Assumed `P10-S0` is contract-freeze only, so I did not treat the still-private package manifests as a finding by themselves.
- Assumed reviewer scope excludes tester output and verdict output, per prompt.
