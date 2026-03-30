# Public Beta Quickstart (`init -> brainstorm -> plan -> cook`)

Use this as one exact outside-user onboarding path.

## 1) Install And First Checks

Canonical `npx`-first path:

```bash
npx @codexkit/cli init
npx @codexkit/cli doctor
```

On this host, raw `npx` can hit `EPERM` on `~/.npm`. Use:

```bash
npm_config_cache="$PWD/.npm-cache" npx @codexkit/cli init
npm_config_cache="$PWD/.npm-cache" npx @codexkit/cli doctor
```

Global install alternative:

```bash
npm install -g @codexkit/cli
cdx init
cdx doctor
```

## 2) Initialize The Repo

```bash
cdx init
cdx init --apply --approve-protected --approve-managed-overwrite
```

If `init-report.md` says install-only, create the first commit before workflow commands:

```bash
git add .
git commit -m "bootstrap codexkit install"
```

Then re-run:

```bash
cdx doctor
```

## 3) Wrapped Runner Example (`codex-safe`)

Temporary override:

```bash
CODEXKIT_RUNNER="codex-safe exec --profile beta" cdx doctor
```

Persisted config:

```toml
# .codexkit/config.toml
schema_version = 1
managed_by = "codexkit"

[runner]
command = "codex-safe exec --profile beta"
```

## 4) Exact Workflow Path

Example repository path: `/Users/alex/dev/todo-api`

```bash
cd /Users/alex/dev/todo-api
cdx brainstorm "Add a health-check endpoint and tests"
cdx plan "Add a health-check endpoint and tests"
cdx cook /Users/alex/dev/todo-api/plans/20260329-health-check-endpoint/plan.md
```

The `cdx cook` path above is an exact example path shape. Use the absolute `plan.md` path produced by your `cdx plan` run.
