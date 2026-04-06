# Release Readiness Report

- Generated At: 2026-04-05T23:27:54.090Z
- base_sha: 8a7195c2a98253dd1060f9680b422b75d139068d
- candidate_sha: 308867621e6c3d77746302b08a624445f7b84213
- Release Verdict: fail

## Suite Summary
- validation-golden: accepted (accepted)
- validation-chaos: accepted (accepted)
- validation-migration: accepted (accepted)

## NFR Pass Fail Table
| Metric | Status | Fixture Refs | Host Manifest Refs | Evidence Refs | Freshness | Notes |
|---|---|---|---|---|---|---|
| NFR-1.1 | pass | interrupted-run | bundle://host-manifest/current | chaos-restart-continuity:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-restart-continuity-e656d235cd0a.md | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-1.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-1.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-1.4 | pass | interrupted-run | bundle://host-manifest/current | chaos-reclaim-operator-state:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-reclaim-operator-state-2f7a1ae2363b.md | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-1.5 | pass | git-clean<br/>fresh-session-handoff | bundle://host-manifest/current | plan-artifact:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/plan-artifact-a44ed07404b5.md | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-2.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.4 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-2.5 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.2 | pass | git-clean | bundle://host-manifest/current | brainstorm-decision-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/brainstorm-decision-report-233d56cbbac1.md<br/>review-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/review-report-66d05e913076.md<br/>test-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/test-report-52e605952b81.md<br/>debug-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/debug-report-98c8ba0c9c21.md | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-3.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.4 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-3.5 | pass | git-clean | bundle://host-manifest/current | plan-artifact:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/plan-artifact-a44ed07404b5.md | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-3.6 | pass | git-clean | bundle://host-manifest/current | golden-plan-cook-comparative-trace:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/golden-plan-cook-comparative-trace-4727d2bce18b.md<br/>frozen-claudekit-plan-cook-trace-source:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/frozen-claudekit-plan-cook-trace-source-7cb3e7f26ad1.json | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-3.7 | pass | interrupted-run | bundle://host-manifest/current | chaos-reclaim-operator-state:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-reclaim-operator-state-2f7a1ae2363b.md | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-4.1 | fail | fresh-no-git<br/>git-clean<br/>interrupted-run<br/>retained-failed-worker | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-4.2 | pass | claudekit-migrated | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-4.3 | pass | claudekit-migrated | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-4.4 | pass | git-clean | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-4.5 | pass | fresh-no-git | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-4.6 | pass | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-5.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-5.2 | pass | git-clean | bundle://host-manifest/current | finalize-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/finalize-report-71b854f223ea.md<br/>docs-impact-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/docs-impact-report-fe53f128206a.md<br/>git-handoff-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/git-handoff-report-e02a54b1e949.md<br/>fix-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/fix-report-0b6e84554ed0.md<br/>team-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/team-report-09dd20520b69.md | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-5.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-5.4 | pass | interrupted-run<br/>retained-failed-worker | bundle://host-manifest/current | chaos-crash-ledger-artifact-history:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-crash-ledger-artifact-history-d90facc580d2.md<br/>chaos-split-artifact:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-split-artifact-1bec82a9cbf3.log | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-5.5 | pass | interrupted-run | bundle://host-manifest/current | chaos-reclaim-operator-state:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-reclaim-operator-state-2f7a1ae2363b.md | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-5.6 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-6.1 | pass | fresh-session-handoff | bundle://host-manifest/current | brainstorm-decision-report:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/brainstorm-decision-report-233d56cbbac1.md | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-6.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-6.3 | pass | fresh-session-handoff | bundle://host-manifest/current | golden-restatement-check:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-golden/golden-restatement-check-8feacb12d24d.md | fresh until 2026-04-12T23:27:51.170Z | none |
| NFR-6.4 | pass | interrupted-run | bundle://host-manifest/current | chaos-approval-resume-state:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-approval-resume-state-fb9506c31ba0.md | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-6.5 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.1 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.2 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.3 | blocked | none | none | none | blocked: no accepted evidence | no accepted evidence for metric |
| NFR-7.4 | fail | parallelizable-repo | bundle://host-manifest/current | chaos-parallel-reliability-benchmark:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-chaos/chaos-parallel-reliability-benchmark-b56a96e06399.md | fresh until 2026-04-12T23:27:35.551Z | none |
| NFR-8.1 | blocked | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md<br/>host-matrix-smoke:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/host-matrix-smoke-02c5f15d4b27.json | fresh until 2026-04-12T23:27:21.844Z | blocked pending additional host/runtime prerequisites |
| NFR-8.2 | pass | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-8.3 | pass | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md | fresh until 2026-04-12T23:27:21.844Z | none |
| NFR-8.4 | fail | host-capability-gap | bundle://host-manifest/current | migration-checklist:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/migration-checklist-d325674f3850.md<br/>host-matrix-smoke:/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only/.tmp/phase9-durable-artifacts/validation-migration/host-matrix-smoke-02c5f15d4b27.json | fresh until 2026-04-12T23:27:21.844Z | host matrix evidence is missing, stale, blocked, or rejected |

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
