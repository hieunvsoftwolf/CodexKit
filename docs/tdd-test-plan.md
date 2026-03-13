# CodexKit TDD Test Plan

**Project**: CodexKit  
**Scope**: Phase 1 runtime foundation  
**Last Updated**: 2026-03-11

## Why This Exists

Current migration work has specs and schema, but no execution-level verification yet. This plan makes testing a first-class requirement before worker spawning and workflow migration add more moving parts.

## Test Strategy

- write service behavior tests before each concrete implementation
- keep DB and daemon verification as integration tests against isolated temporary state
- prefer executable invariants over snapshot-heavy tests
- do not merge runtime features that lack at least one failing test written first

## Test Layers

### Unit Tests

Target:
- config normalization
- state transition guards
- ready-task calculation
- lease expiration rules
- approval status transitions
- event payload validation

Rule:
- every service method gets a red-green-refactor cycle

### Integration Tests

Target:
- fresh database migration
- restart-safe durability
- worker heartbeat and stale detection
- task dependency unblock after completion
- daemon command handling across process restarts

Rule:
- each integration test uses its own temp state directory and database file

### Contract Tests

Target:
- MCP request envelope validation
- repository port conformance
- CLI JSON output stability

Rule:
- add contract tests before workflow import or external MCP clients depend on the surface

## Phase 1 Must-Have Tests

1. `createRuntimeConfig()` builds deterministic local paths.
2. `001-init.sql` applies cleanly to an empty SQLite database.
3. run creation persists and can be listed after process restart.
4. task dependency resolution marks tasks `ready` only when blockers complete.
5. claim lease expiration releases stuck work.
6. stale worker sweep emits a deterministic event payload.
7. approval request and response persist correct terminal gate state.

## Red-Green Order

1. write DB migration smoke test
2. write run service tests
3. write task service tests
4. write worker and claim service tests
5. write approval and event service tests
6. add daemon integration tests after core services pass

## Exit Criteria

Phase 1 is test-ready only when:

- `npm run typecheck` passes
- unit tests exist for every runtime service
- integration tests cover DB migration and restart behavior
- no runtime core package is merged without tests

## Current Gaps

- no dependency install or CI wiring yet
- no repository implementations yet
- no integration fixture helper for temp SQLite databases yet

## Unresolved Questions

- how much direct repository coverage vs service-level coverage to require on top of the chosen `better-sqlite3` adapter
- whether CLI JSON output should be frozen in Phase 1 or Phase 2
