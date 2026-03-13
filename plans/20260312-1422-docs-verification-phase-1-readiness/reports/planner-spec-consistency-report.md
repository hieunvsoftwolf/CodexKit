# Planner Report

**Scope**: Review internal spec consistency for Phase 1 readiness

## Conflicts Found

- Phase 1 runtime specs treated `claim` as a core primitive, but `docs/phase-1-implementation-plan.md` omitted `ClaimRecord`, `ClaimsRepository`, `ClaimService`, lease-expiry coverage, and CLI inspection surface.
- Architecture and compatibility docs mapped Codex guidance files to `.codex/AGENTS.md`, which conflicts with current Codex instruction discovery.
- Architecture summary of message storage lagged behind the schema and Phase 3 primitive spec.

## Risk Notes

- Phase 1 must implement claims and lease expiry from day one or Phase 2 worker execution will start on an unstable task-ownership model.
- Packaging and update flows that touch root `AGENTS.md` or `.codex/**` need explicit approval handling because those are protected under Codex workspace-write.
- Codex native multi-agent should stay optional. Do not let Phase 1 or Phase 2 depend on an experimental host feature for parity-critical behavior.

## Recommendation

- Start Phase 1 against `docs/runtime-core-technical-spec.md`, `docs/codexkit-sqlite-schema.sql`, and the patched `docs/phase-1-implementation-plan.md`.
- Treat `docs/system-architecture.md` as architectural summary only; exact schema stays in the SQL doc and phase specs.

## Unresolved Questions

- Whether Phase 1 daemon is long-running by default or on-demand remains open but is not a blocker for first implementation slices.
