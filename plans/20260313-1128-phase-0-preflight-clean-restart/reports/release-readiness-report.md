# Release Readiness Report

- Generated At: 2026-03-27T11:28:53.705Z
- base_sha: 8a7195c2a98253dd1060f9680b422b75d139068d
- candidate_sha: 8a7195c2a98253dd1060f9680b422b75d139068d-dirty-4b736a3186f695ec
- Release Verdict: fail

## Suite Summary
- validation-golden: accepted (accepted)
- validation-chaos: accepted (accepted)
- validation-migration: accepted (accepted)
- phase-5-wave2-nfr-evidence: rejected (schema/candidate provenance incompatible with Phase 9 frozen contract)

## NFR Pass Fail Table
| Metric | Status | Fixture Refs | Host Manifest Refs | Evidence Refs | Freshness | Notes |
|---|---|---|---|---|---|---|
| NFR-1.1 | pass | interrupted-run | bundle://host-manifest/current | chaos-restart-continuity:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-restart-continuity-6294475b3df4.md | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-1.2 | blocked | none | none | /Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | rejected | no accepted evidence for metric<br/>rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-1.3 | blocked | none | none | /Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | rejected | no accepted evidence for metric<br/>rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-1.4 | pass | interrupted-run | bundle://host-manifest/current | chaos-reclaim-operator-state:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-reclaim-operator-state-5d170c01eb45.md | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-1.5 | pass | git-clean<br/>fresh-session-handoff | bundle://host-manifest/current | plan-artifact:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/plan-artifact-8d42f785f9be.md<br/>/Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | fresh until 2026-04-03T11:28:26.520Z | rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-2.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.4 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.5 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.2 | pass | git-clean | bundle://host-manifest/current | brainstorm-decision-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/brainstorm-decision-report-f2e05f54dc2f.md<br/>review-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/review-report-03a850870cf6.md<br/>test-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/test-report-baefcc2ec8b5.md<br/>debug-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/debug-report-f3130819c07d.md<br/>/Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | fresh until 2026-04-03T11:28:26.520Z | rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-3.3 | blocked | none | none | /Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | rejected | no accepted evidence for metric<br/>rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-3.4 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.5 | pass | git-clean | bundle://host-manifest/current | plan-artifact:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/plan-artifact-8d42f785f9be.md | fresh until 2026-04-03T11:28:26.520Z | none |
| NFR-3.6 | pass | git-clean | bundle://host-manifest/current | golden-plan-cook-comparative-trace:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/golden-plan-cook-comparative-trace-c4b7dd618a04.md<br/>frozen-claudekit-plan-cook-trace-source:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/frozen-claudekit-plan-cook-trace-source-222e488b3a5b.json | fresh until 2026-04-03T11:28:26.520Z | none |
| NFR-3.7 | pass | interrupted-run | bundle://host-manifest/current | chaos-reclaim-operator-state:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-reclaim-operator-state-5d170c01eb45.md | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-4.1 | fail | fresh-no-git<br/>git-clean<br/>interrupted-run<br/>retained-failed-worker | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-4.2 | pass | claudekit-migrated | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-4.3 | pass | claudekit-migrated | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-4.4 | pass | git-clean | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-4.5 | pass | fresh-no-git | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-4.6 | pass | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-5.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-5.2 | pass | git-clean | bundle://host-manifest/current | finalize-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/finalize-report-246224390c45.md<br/>docs-impact-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/docs-impact-report-324b8aad2fd3.md<br/>git-handoff-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/git-handoff-report-abcb5dc68f2e.md<br/>/Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | fresh until 2026-04-03T11:28:26.520Z | rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-5.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-5.4 | pass | interrupted-run<br/>retained-failed-worker | bundle://host-manifest/current | chaos-crash-ledger-artifact-history:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-crash-ledger-artifact-history-fcf72ed79926.md<br/>chaos-split-artifact:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-split-artifact-b13201014c2b.log | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-5.5 | pass | interrupted-run | bundle://host-manifest/current | chaos-reclaim-operator-state:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-reclaim-operator-state-5d170c01eb45.md | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-5.6 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-6.1 | pass | fresh-session-handoff | bundle://host-manifest/current | brainstorm-decision-report:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/brainstorm-decision-report-f2e05f54dc2f.md<br/>/Users/hieunv/Claude Agent/CodexKit/.tmp/phase-5-wave2-nfr-evidence.json | fresh until 2026-04-03T11:28:26.520Z | rejected reused evidence from foreign candidate commit 9f2cfce33796cc96fb92ad64f4194c0e852e18f0 |
| NFR-6.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-6.3 | pass | fresh-session-handoff | bundle://host-manifest/current | golden-restatement-check:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-be4e08cf636a.md | fresh until 2026-04-03T11:28:26.520Z | none |
| NFR-6.4 | pass | interrupted-run | bundle://host-manifest/current | chaos-approval-resume-state:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-approval-resume-state-a7c2927dd76c.md | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-6.5 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.4 | fail | parallelizable-repo | bundle://host-manifest/current | chaos-parallel-reliability-benchmark:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-5735659ed22f.md | fresh until 2026-04-03T11:28:44.517Z | none |
| NFR-8.1 | blocked | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md<br/>host-matrix-smoke:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/host-matrix-smoke-c645b920fcd1.json | fresh until 2026-04-03T11:27:54.075Z | blocked pending additional host/runtime prerequisites |
| NFR-8.2 | pass | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-8.3 | pass | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md | fresh until 2026-04-03T11:27:54.075Z | none |
| NFR-8.4 | fail | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-df5ba504c84f.md<br/>host-matrix-smoke:/Users/hieunv/Claude Agent/CodexKit/.tmp/phase9-durable-artifacts/validation-migration/host-matrix-smoke-c645b920fcd1.json | fresh until 2026-04-03T11:27:54.075Z | host matrix evidence is missing, stale, blocked, or rejected |

## Open Blockers
- NFR-1.2 is blocked
- NFR-1.3 is blocked
- NFR-2.1 is blocked
- NFR-2.2 is blocked
- NFR-2.3 is blocked
- NFR-2.4 is blocked
- NFR-2.5 is blocked
- NFR-3.1 is blocked
- NFR-3.3 is blocked
- NFR-3.4 is blocked
- NFR-4.1 is fail
- NFR-5.1 is blocked
- NFR-5.3 is blocked
- NFR-5.6 is blocked
- NFR-6.2 is blocked
- NFR-6.5 is blocked
- NFR-7.1 is blocked
- NFR-7.2 is blocked
- NFR-7.3 is blocked
- NFR-7.4 is fail
- NFR-8.1 is blocked
- NFR-8.4 is fail
- phase-5-wave2-nfr-evidence: schema/candidate provenance incompatible with Phase 9 frozen contract

## Waived Issues
- none

## Migration Readiness Verdict
- not ready

## Host Compatibility
- NFR-8.1 status: blocked
- NFR-8.4 status: fail
- Freshness rule: NFR-8.4 host matrix evidence must remain within fresh_until

## Unresolved Questions
- none
