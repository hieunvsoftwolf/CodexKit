# Phase 9 Fifth-Remediation Session D Verdict

- Date: 2026-03-27
- Status: completed
- Session Role: lead-verdict
- Modal: default
- Skills: none required
- Pinned BASE_SHA: `8a7195c2a98253dd1060f9680b422b75d139068d`
- Candidate Ref: `/Users/hieunv/Claude Agent/CodexKit` (`main`, working tree beyond pinned base)

## Verdict

- Phase verdict: `fail`

The fifth-remediation Phase 9 candidate still does not pass. The prior decisive proof-shape blockers for `NFR-6.3` and `NFR-7.4` look closed in the current tester and reviewer reruns, and the narrowed five-file suite stayed green. That is not enough to clear Phase 9 because the current candidate still hardcodes the previous remediation Wave 2 provenance anchor instead of the active fifth-remediation Wave 2 snapshot used for this rerun.

## Evidence Weighed

### RELEASE-BLOCKING

1. The current candidate still anchors Phase 9 provenance to the wrong Wave 2 control-state snapshot for this rerun.
   - `tests/runtime/helpers/phase9-evidence.ts:17-22` still sets `PHASE9_CONTROL_STATE_REPORT` to `control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md`.
   - `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts:127-130` codifies the same fourth-remediation expectation.
   - The active source-of-truth snapshot for this verdict lane is `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-fifth-remediation-wave-2-ready-after-sa.md`.
   - Contract impact: the narrowed remediation explicitly claimed that provenance was repointed to the current Wave 2 snapshot, but the candidate tree and its own contract test still point at the prior wave. The pinned `BASE_SHA` staying the same limits runtime blast radius, but Phase 9 is a release-gate evidence lane. A stale active-wave provenance anchor means the proof bundle is still not fully traceable to the current rerun context, so the remediation claim is not fully closed.

### Severity Weighting

1. Tester rerun severity: `critical`
   - I agree with the tester that this is pass/fail material for the Phase 9 release gate because it affects current-wave evidence integrity, not just cosmetic wording.

2. Reviewer rerun severity: `moderate`
   - I agree with the reviewer that the defect does not appear to re-break same-run candidate identity or the pinned-base parse because both the fourth-remediation and fifth-remediation snapshots carry the same `BASE_SHA`.

3. Verdict weighting
   - I weigh the reviewer lower on behavioral blast radius and the tester higher on contract impact.
   - Net: low behavioral risk, but still release-blocking traceability debt. That combination is still a `fail` for Phase 9.

## Decision Rationale

Under `docs/non-functional-requirements.md`, `docs/workflow-extended-and-release-spec.md`, the Phase 9 B0 freeze, and the current control-state snapshot, Phase 9 cannot pass on a candidate whose current evidence lane still points at the wrong active provenance anchor. The fifth-remediation reruns otherwise repaired the previously decisive `NFR-6.3` and `NFR-7.4` proof blockers, so I am not widening scope beyond this remaining traceability defect. But the current candidate still mismatches the source-of-truth control-state artifact for this exact rerun wave, and the release-gate verdict should not waive that mismatch.

## Minimum Next-Remediation Scope Only

Do not widen scope beyond Phase 9. The minimum next-remediation set is:

1. Update the Phase 9 provenance anchor to the active fifth-remediation Wave 2 snapshot.
   - Change `tests/runtime/helpers/phase9-evidence.ts` from `control-state-phase-9-fourth-remediation-wave-2-ready-after-sa.md` to `control-state-phase-9-fifth-remediation-wave-2-ready-after-sa.md`.

2. Update the matching contract assertion.
   - Change `tests/runtime/runtime-workflow-phase9-contract.integration.test.ts` so the helper-provenance expectation matches the fifth-remediation Wave 2 snapshot.

3. Preserve the now-closed narrowed proof repairs without reopening them.
   - Do not redesign `NFR-6.3`.
   - Do not redesign `NFR-7.4`.
   - Keep preserved fixes intact: `NFR-3.6`, honest blocked `NFR-8.1`, contract-timeout stability, same-run candidate identity stabilization, durable migration row evidence refs.

4. Rerun only the narrowed verification chain after the two-file provenance repair.
   - Session B tester rerun
   - Session C reviewer rerun
   - Session D verdict rerun

## Unresolved Questions

- none
