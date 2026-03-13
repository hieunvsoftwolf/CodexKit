# Phase 0 Preflight Clean Restart

**Status**: Active
**Date**: 2026-03-13
**Scope**: Restore a docs-first baseline, remove discarded Phase 1 candidate code, and prepare a git-backed high-rigor restart.

## Objectives

- restore the workspace to a docs and knowledge baseline
- remove discarded Phase 1 runtime code and generated artifacts
- normalize root workspace config so the remaining baseline stays internally consistent
- update control docs so the next recommended action is preflight, not immediate implementation
- create a git-backed clean baseline and capture a reproducible `BASE_SHA`
- re-enter control-agent to start the real Phase 1 wave from that `BASE_SHA`

## Checklist

- [x] remove discarded Phase 1 runtime packages, CLI entrypoint, and runtime-only tests
- [x] remove generated Phase 1 SQLite artifacts
- [x] normalize root package and TypeScript config for the docs and knowledge baseline
- [x] update control docs and supporting READMEs for the clean restart
- [x] verify the cleaned baseline with the surviving tests and graph validator
- [x] initialize or attach the workspace root to a git repository
- [x] create the clean-baseline commit and record `BASE_SHA`
- [ ] re-run control-agent from the clean baseline to emit runnable Phase 1 Session A and Session B0 prompts

## Reports

- `reports/cleanup-reset-report.md`

## Exit Criteria

- the workspace is back to a docs and knowledge baseline with no discarded Phase 1 implementation files
- root config does not reference removed runtime packages
- the workspace root is git-backed
- a clean docs-first baseline commit exists and its `BASE_SHA` is recorded
- control-agent can emit the default high-rigor Phase 1 execution wave from that `BASE_SHA`

## Unresolved Questions

- whether the workspace root should be initialized as a new git repo or attached to an existing parent repo
