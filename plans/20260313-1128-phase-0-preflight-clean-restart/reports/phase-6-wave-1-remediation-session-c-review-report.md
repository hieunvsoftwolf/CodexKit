# Phase 6 Wave 1 Remediation Session C Review Report

- Date: 2026-03-23
- Status: completed
- Role/Modal: code-reviewer / Default
- Scope: `P6-S0 + P6-S1 + P6-S2 + P6-S3 + P6-S4` only
- Candidate: current remediated repo tree in `/Users/hieunv/Claude Agent/CodexKit`

## Findings

### IMPORTANT: recent-change review still drops untracked-only repo changes and can publish false `no findings`

Why it matters:
- Wave 1 blocker 1 is only partially closed. `cdx review codebase` is now repo-driven enough to emit clean `no findings`, but the default recent-change path still treats an untracked-only dirty repo as clean.
- That makes the durable `review-report.md` misleading for a common dirty-worktree case and weakens the review gate for standalone review and downstream fix/cook handoff.

Evidence:
- `packages/codexkit-daemon/src/workflows/review-workflow.ts:128-139` builds `recentPaths` only from `git diff --name-only HEAD`, which excludes untracked files.
- `packages/codexkit-daemon/src/workflows/review-workflow.ts:158-163` returns `[]` findings whenever `scope === "recent"` and `recentPaths.length === 0`, even if `statusLines` still contains untracked files.
- Live repro on current candidate:
  - fixture: git repo with only one untracked `new-file.ts`
  - command: `cdx review checkout --json`
  - observed result: `findings: []`
  - observed report: `.tmp/review-untracked-check/.codexkit/runtime/artifacts/run_7e70524a1e6cb1b5/review-report.md` contains `- no findings`

Spec refs:
- `docs/workflow-extended-and-release-spec.md:137-163`
- `docs/workflow-extended-and-release-spec.md:174-184`

Recommended action:
- fold non-runtime untracked paths into recent-change scope resolution, not only codebase scope, before emitting `no findings`

### IMPORTANT: explicit `cdx test ui` can silently run plain `npm test` and claim UI verification

Why it matters:
- Wave 1 blocker 3 is only partially closed. The workflow now runs real commands, but `ui` mode is still allowed to execute the wrong suite.
- A repo with only a generic `test` script can get a `ui` run that publishes a passed/degraded report even though no browser-oriented suite actually ran.

Evidence:
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:222-231` falls back from `ui` mode to `npm test`.
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:375-438` then records that command as the `ui` execution evidence.
- Live repro on current candidate:
  - fixture: git repo with only `package.json` script `"test": "node -e \"console.log('default-suite')\""`
  - command: `cdx test ui http://127.0.0.1:4173 --json`
  - observed execution artifact: `.tmp/review-ui-fallback-check/.codexkit/runtime/artifacts/run_02af7a8680631f75/test-execution-output.md`
  - observed content: `Mode: ui` but execution command was `npm test`

Spec refs:
- `docs/workflow-extended-and-release-spec.md:225-250`

Recommended action:
- when `ui` mode lacks `test:ui`/`test:e2e` support, publish an explicit blocked/degraded diagnostic and do not fall back to the default test suite

### MODERATE: `test-report.md` still fabricates totals and coverage numbers instead of reporting runner results

Why it matters:
- The remediation replaced fully synthetic execution with real command evidence, but the durable report contract is still not evidence-backed enough.
- Report consumers can read `Passed: 1` or `Line: 80%` / `Branch: 70%` even when those values were never produced by the test runner.

Evidence:
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:466-474` derives totals from command count and exit code, not test runner output.
- `packages/codexkit-daemon/src/workflows/test-workflow.ts:474` hard-codes coverage to `80/70` whenever coverage mode succeeds.
- Same live `ui` repro above produced `.tmp/review-ui-fallback-check/.codexkit/runtime/artifacts/run_02af7a8680631f75/test-report.md` with:
  - `Passed: 1`
  - `Failed: 0`
  - `Skipped: 0`
  - no real test case accounting behind those numbers

Spec refs:
- `docs/workflow-extended-and-release-spec.md:252-260`

Recommended action:
- parse runner output or persist an explicit `unknown/unavailable` report shape instead of publishing synthetic totals and coverage

## Blocker Check

Against the six failed-verdict Wave 1 blockers:

1. clean codebase `cdx review codebase` now emits `no findings`: original failure no longer reproduced, but recent-change review still has the untracked-path gap above
2. bare `cdx review` chooser path: no finding
3. `cdx test` real execution plus typed diagnostics: partial closure only; the workflow now runs real commands, but the `ui` fallback and report-metric synthesis above remain in-scope contract issues
4. bare `cdx test` chooser path: no finding
5. stable `result.route` from `cdx debug`: no finding
6. non-cook approval continuation for review/test/debug: no finding

## Verification

Commands run:

```bash
TMPDIR=.tmp npx vitest run --no-file-parallelism \
  tests/runtime/runtime-workflow-phase6-cli.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-review.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-test.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-debug.integration.test.ts \
  tests/runtime/runtime-workflow-phase6-remediation.integration.test.ts
```

Observed result:
- pass: `5` files
- pass: `10` tests

Additional live repros run:
- recent review on repo with only untracked file
- `ui` mode on repo with only generic `npm test` script

## Summary

- The six originally failed B0/remediation assertions now pass on the current candidate tree.
- I do not see remaining review findings on blocker 2, blocker 4, blocker 5, or blocker 6.
- I do see two remaining in-scope contract misses in the review/test surfaces plus one durable-report fidelity gap in `P6-S3`.

## Unresolved Questions

- none
