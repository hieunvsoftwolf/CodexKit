# Phase 3 Remediation Session B Test Report

## Metadata
- Date: 2026-03-20
- Status: completed
- Role/modal used: tester / Default
- Model used: GPT-5 / Codex
- Source of truth: current dirty candidate tree at `/Users/hieunv/Claude Agent/CodexKit` on `main`
- Frozen verification contract: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-3-session-b0-spec-test-design.md`

## Command Evidence
1. targeted blocker suite first:
   - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-cli.integration.test.ts tests/runtime/runtime-compat-primitives.integration.test.ts tests/runtime/runtime-compat-primitives-gap.integration.test.ts --no-file-parallelism`
   - result: pass (`3` files, `15` tests)
2. full runtime suite second:
   - `npm run test:runtime`
   - result: pass (`9` files, `46` tests)
3. gap expansion:
   - none added in this session; required blocker and full runtime coverage already present in executed suites

## Required Verification Mapping

### CLI rejects self-asserted compat caller flags
- pass
- evidence:
  - `tests/runtime/runtime-cli.integration.test.ts` test `compat call rejects self-asserted caller flags`
  - observed CLI error envelope: `CLI_USAGE` with session-derived caller message

### unauthorized mailbox pulls do not mutate durable state
- pass
- evidence:
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` test `user mailbox authz denial does not mutate worker mailbox cursor or delivery`
  - asserts cursor unchanged and `deliveredAt` unchanged after denied pull

### worker.spawn enforces task/team scope when `teamId` omitted
- pass
- evidence:
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` test `worker.spawn enforces task team scope even when teamId is omitted`
  - denial is `permission_denied`; task claim list stays empty

### team.delete remains `shutting_down` until drain then becomes `deleted`
- pass
- evidence:
  - `tests/runtime/runtime-compat-primitives.integration.test.ts` test `keeps team.delete in shutting_down until workers drain and preserves shutdown messaging`
  - first delete returns `deleted=false` and team state `shutting_down`; second delete after worker stop returns `deleted=true`

### auto_approve_run transactional coupling and rollback safety
- pass
- evidence:
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` test `approval auto_approve_run is transactionally coupled with policy write`
  - injected policy-write failure keeps approval `pending` and policy unset; retry succeeds and emits policy update event

### task.create ownedPaths normalization/validation
- pass
- evidence:
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` test `task.create normalizes ownedPaths and rejects non-relative paths`
  - normalized output asserted; absolute path rejected with `validation_error`

### artifact.read cross-run mapping aligns to frozen B0/spec (`not_found`)
- pass
- evidence:
  - `tests/runtime/runtime-compat-primitives-gap.integration.test.ts` test `artifact.read supports id and run/path lookup and enforces run scope`
  - cross-run read by `artifactId` asserted as `not_found`

## `.tmp` NFR Artifact Disposition
- `.tmp/nfr-7.1-launch-latency.json` and `.tmp/nfr-7.2-dispatch-latency.json` changed during runtime test execution in this candidate tree
- treated as candidate evidence only, not phase-close proof

## Findings
- no blocker found in this tester rerun
- execution order followed exactly: targeted blocker suite first, then full runtime suite

## Unresolved Questions
- none
