# Phase 10 P10-S4 Third-Remediation Session D Lead Verdict

**Date**: 2026-03-30
**Session**: `S62`
**Role**: lead verdict
**Status**: completed

## Verdict

- pass: `P10-S4` is accepted on the current candidate tree

## Acceptance Mapping

- direct installed packaged-bin execution: satisfied by installed-bin and no-fallback assertions in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:58` and helper enforcement in `tests/runtime/helpers/phase10-packaged-artifact-smoke.ts:74`, with explicit tester evidence in `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-b-tester-report-20260330-s60.md`
- fresh repo lane: satisfied by the first smoke test in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:84`, including init preview/apply, `installOnly`, and `doctor-report.md` runner-source and command proof
- git-backed quickstart lane: satisfied by the second smoke test in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:130`, covering `init -> doctor -> brainstorm -> plan -> cook` through the installed bin and absolute `plan.md` usage
- install-only gating lane: satisfied by the third smoke test in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:179`, preserving typed `WF_INSTALL_ONLY_REPO_BLOCKED` failures through the packaged artifact
- wrapped-runner config and env precedence lane: satisfied by the fourth smoke test in `tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts:210`, including the formerly missing config-preview `init-report.md` proof at lines `220-235`, config-file apply and doctor proof, and env-over-config precedence proof

## Evidence Reconciled

- `S59` stayed assertion-only inside the smoke suite
- `S60` passed the frozen contract unchanged first and reported no blockers
- `S61` reported no findings and confirmed `F4` closure
- independent confirmation on the current tree also passed unchanged:

```bash
TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase10-packaged-artifact-smoke.integration.test.ts --no-file-parallelism
```

- result: `4/4` tests passed

## Caveat

- raw `npx` remains a host-specific caveat on this machine because `~/.npm` can hit `EPERM`
- acceptance remains valid because the gate stays on direct installed packaged-bin execution
- any `npx` fallback handling remains limited to host-safe helper plumbing

## Blockers

- none

## Handoff Notes

- Treat `P10-S4` as passed for the packaged-artifact smoke and go/no-go slice only.
- Do not expand this verdict into a broader release-readiness claim beyond the frozen scope.
- Keep the raw `npx` `EPERM` caveat explicit in any follow-on packaging or onboarding summary on this host.

## Unresolved Questions

- none
