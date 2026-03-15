# Phase 2 Wave 1 Review Report

**Date**: 2026-03-15
**Status**: completed
**Role/Modal Used**: code-reviewer role contract / Default
**Model Used**: GPT-5 / Codex
**Pinned BASE_SHA**: `50b28fae3df63701189843b1b324d6a64fab991d`
**Candidate Ref**: branch `phase2-s1-implement` in worktree `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement`

## Summary

- no MCP or workflow-scope broadening finding
- findings stay inside the Phase 2 runner slice and center on isolation, snapshot fidelity, artifact completeness, and stale-worker recovery
- reviewer reported:
  - `1 CRITICAL`
  - `4 IMPORTANT`
  - `1 MODERATE`

## Full Report

### CRITICAL

- the runner does not actually prevent or reliably detect writes outside the worker worktree
- the child process is launched with controlled `cwd` and env only, then post-run auditing checks only paths visible from `git diff` or `ls-files` inside the worktree
- a worker can write to absolute paths, `../` escapes, or existing symlink targets outside the worktree and still finish clean with a normal patch artifact published
- validated repro references:
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worker-runtime.ts:63`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/artifact-capture.ts:56`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/path-policy.ts:69`

### IMPORTANT

- supported dirty-root overlay replay is missing even though Phase 2 makes overlays the only supported dirty-root snapshot mechanism
- `createWorktree()` never applies an overlay after `git worktree add`, and preflight explicitly rejects any non-null `overlayBundlePath`
- references:
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worktree-manager.ts:56`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worktree-manager.ts:65`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worktree-manager.ts:92`

- `patch.diff` is incomplete for new or untracked outputs
- the manifest records untracked files, but the patch is built with `git diff --binary`, which omits them
- references:
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/artifact-capture.ts:38`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/artifact-capture.ts:61`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/tests/runtime/runtime-worker-runtime.integration.test.ts:66`

- the stale or restart reclaim path required by the spec is not implemented
- stale-worker handling flips worker state and emits `worker.stale`, but does not capture evidence, queue reclaim, or perform the forced-shutdown or orphan flow described for daemon restart and unreconciled launcher state
- references:
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runtime-kernel.ts:5`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-core/src/services/worker-service.ts:108`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worker-runtime-finalize.ts:46`

- the default launch path does not pass `context.json` to the worker
- the bundle writes `context.json`, but the default command only invokes `codex exec --input-file <prompt.md>`
- references:
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/launch-bundle.ts:58`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/launch-bundle.ts:67`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worker-runtime.ts:62`

### MODERATE

- `env.json` understates the effective launched environment
- `auditKeys` is computed before `CODEXKIT_OWNED_PATHS_FILE`, `CODEXKIT_WORKTREE`, and `CODEXKIT_ARTIFACT_DIR` are added, so the retained audit record does not match the actual runtime env the worker received
- references:
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/launch-bundle.ts:37`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/launch-bundle.ts:47`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/launch-bundle.ts:63`
  - `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/packages/codexkit-daemon/src/runner/worker-runtime.ts:58`

## Blockers

- none

## Handoff Notes For Next Sessions

- re-test after fixing root-escape isolation first; that is the highest-risk Phase 2 violation
- after that, verify overlay replay, untracked-file patch capture, and stale-worker reclaim with restart or orphan fixtures, not just same-process child exits
- `npm run test:runtime` still has an unrelated timeout in `/Users/hieunv/Claude Agent/Claudekit-GPT-phase1-s1-implement/tests/runtime/runtime-daemon.integration.test.ts:130`
