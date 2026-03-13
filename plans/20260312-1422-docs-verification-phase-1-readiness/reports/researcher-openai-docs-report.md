# Researcher Report

**Scope**: Verify current Codex/OpenAI host capabilities against repo assumptions

## Verified

- Codex reads `AGENTS.md` from the current directory, ancestor directories up to repo root, and home. More specific files override broader ones.
- Project-scoped Codex config belongs in `.codex/config.toml`.
- MCP server registration is a native Codex feature. CodexKit should supply compatibility semantics, not invent a separate transport model.
- Native skills exist in user and project skill directories.
- Native multi-agent role orchestration exists, but OpenAI documents it as experimental.
- Approval and sandbox controls are first-class host settings. Protected paths include `AGENTS.md`, `.codex/**`, and `.git/**` under workspace-write.
- `codex exec` exists for non-interactive subprocess execution.

## Mismatches Found

- Some repo docs treated `.codex/AGENTS.md` as if Codex would read it natively. Current docs show root `AGENTS.md` is canonical.
- Some repo docs implied Codex lacked native skills or multi-agent surfaces entirely. Current docs show both exist, but multi-agent is experimental and still not a durable parity runtime.
- Packaging docs did not call out protected-path approval requirements for root `AGENTS.md` and `.codex/**`.

## Recommendation

- Keep CodexKit authoritative for durable tasks, claims, approvals, mailbox routing, and resume.
- Use root `AGENTS.md`, optional `.codex/config.toml`, native MCP transport, and optional native skills as host integration layers only.

## Unresolved Questions

- Phase 2 should re-check the exact subprocess flags and sandbox preset chosen for worker roles before implementation starts.
