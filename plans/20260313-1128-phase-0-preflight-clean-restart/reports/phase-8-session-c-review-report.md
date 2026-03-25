# Phase 8 Session C Review Report

## Findings

1. `CRITICAL` `cdx init` and `cdx update` still mutate before any operator-visible preview is published, so the current `--approve-*` flags are not approval-after-preview gates.
File refs:
- [packages/codexkit-daemon/src/workflows/init-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/init-workflow.ts#L197) writes managed files and metadata before the report is published at [packages/codexkit-daemon/src/workflows/init-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/init-workflow.ts#L229).
- [packages/codexkit-daemon/src/workflows/update-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/update-workflow.ts#L151) applies writes before the preview/report is published at [packages/codexkit-daemon/src/workflows/update-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/update-workflow.ts#L177).
- The CLI accepts `--apply` together with `--approve-protected` / `--approve-managed-overwrite` in one shot at [packages/codexkit-cli/src/workflow-command-handler.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts#L61) and [packages/codexkit-cli/src/workflow-command-handler.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts#L81).
Why this matters:
- Phase 8 froze preview-first behavior where planned writes, preserved files, conflicts, and blocked actions must be operator-visible before mutation starts. The current implementation only computes the preview in memory, then writes, then publishes the report. That makes the explicit approval flags contract-inconsistent for protected writes to `AGENTS.md` and `.codex/**` because the approving command is also the mutating command.

2. `IMPORTANT` Install-only state is recorded and diagnosed, but it is not enforced at worker-backed workflow entry.
File refs:
- `init` records install-only state at [packages/codexkit-daemon/src/workflows/init-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/init-workflow.ts#L205).
- The shared scan only emits diagnostics that worker-backed workflows "must remain blocked" at [packages/codexkit-daemon/src/workflows/repo-scan-engine.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/repo-scan-engine.ts#L106).
- But workflow entrypoints still dispatch directly with no install-state preflight in [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L82), [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L106), [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L112), and [packages/codexkit-daemon/src/runtime-controller.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L118).
- `runCookWorkflow` and `runPlanWorkflow` also start immediately with no Phase 8 install-only guard at [packages/codexkit-daemon/src/workflows/cook-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/cook-workflow.ts#L510) and [packages/codexkit-daemon/src/workflows/plan-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-workflow.ts#L79).
Why this matters:
- Phase 8 requires repos without a first commit to remain blocked from worker-backed workflows until git prerequisites are satisfied. Right now that rule is advisory only. The likely outcome is later failure inside worker launch or worktree setup rather than an early typed block at workflow start.

3. `IMPORTANT` `cdx resume` surfaces reclaim candidates, but it does not convert reclaim-blocked cases into one concrete recovery action, and it can report a generic continuation command that ignores the actual blocker.
File refs:
- Reclaim candidates are detected in [packages/codexkit-daemon/src/workflows/resume-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/resume-workflow.ts#L89).
- The continuation command ignores reclaim state and only looks at pending approvals or plan pointers in [packages/codexkit-daemon/src/workflows/resume-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/resume-workflow.ts#L123).
- The returned diagnostics always say `RESUME_RECOVERY_READY` whenever a run is found, even if reclaim candidates exist, at [packages/codexkit-daemon/src/workflows/resume-workflow.ts](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/resume-workflow.ts#L183).
Why this matters:
- The frozen contract called out blocked recovery, reclaim visibility, and one explicit continuation command. In reclaim-blocked cases the current continuation can be `cdx run show <id>` or `cdx cook <plan>` even though the real next action is reclaim-related. That misses the `NFR-5.5` / `NFR-6.4` requirement to surface the blocking resource and one concrete recovery action.

4. `MODERATE` Verification for the changed Phase 8 surfaces is materially incomplete.
File refs:
- The only new Phase 8 runtime coverage is [tests/runtime/runtime-workflow-phase8-cli.integration.test.ts](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-workflow-phase8-cli.integration.test.ts#L23).
- It exercises happy-path preview/apply and pending-approval resume, but it does not cover the frozen install-only fixture, host-capability-gap doctor behavior, modified-managed update conflicts, reclaim-blocked resume, or explicit plan-path continuation.
Why this matters:
- Those gaps line up with the highest-risk Phase 8 contracts and with the exact reviewer/tester attention areas called out in the control-state and Session A summary. The current suite would not catch findings 1-3.

## Open Questions Or Assumptions

- Assumption: Phase 8 still treats `cdx init --apply` / `cdx update --apply` as operator-facing packaging flows that must make preview output visible before mutation, not merely compute a preview internally.
- Assumption: worker-backed workflows for `NFR-4.5` include at least `cook`, `review`, `test`, and `debug`; if `plan` is intentionally exempt, the current code still needs an explicit guard for the workflows that spawn workers.

## Change Summary

- Added public Phase 8 workflow entrypoints and shared packaging helpers.
- Main review blockers are contract drift around preview/apply safety, missing install-only enforcement, and incomplete blocked-recovery handling in `cdx resume`.
