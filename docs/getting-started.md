# Getting started

ApeironCode is a local-first coding agent that fixes bugs, builds apps, improves
UI, and reviews code — with approval-gated writes and commands.

## 1. Install (from source)

```bash
git clone https://github.com/poolanithinreddy/ApeironCode.git
cd ApeironCode
npm ci
npm run build
npm link
apeironcode --help
```

The default `--help` is beginner-focused. Run `apeironcode help developer` or
`apeironcode help advanced` for the full command set.

## 2. Try it with no API key

```bash
apeironcode demo todo-app
```

Demo mode is deterministic and needs no API key, model, or Ollama. See
[demo.md](./demo.md).

## 3. Choose how to run for real

```bash
apeironcode setup
```

`setup` is intent-based — pick how you want to run:

1. **Demo mode only** — `apeironcode demo`
2. **Free local model with Ollama** — `apeironcode local setup`
3. **Cheap cloud model** — `apeironcode setup --provider github-models`
4. **Best coding model** — `apeironcode setup --provider anthropic`
5. **Bring my own OpenAI-compatible endpoint** — `apeironcode setup --provider openaiCompatible`

Local OpenAI-compatible endpoints (localhost/127.0.0.1/0.0.0.0) do **not** need
an API key. See [providers.md](./providers.md).

Check your environment any time:

```bash
apeironcode doctor
```

## 4. The four workflows

```bash
apeironcode fix                    # detect failures, propose fixes, rerun checks
apeironcode new "a todo app"       # create a new app from a template
apeironcode build "a CRM dashboard"# build also creates apps
apeironcode improve "premium UI"   # improve UI or code quality
apeironcode review                 # review the current changes
```

`apeironcode new` creates a small app from a deterministic template (no API key
needed); see [build-apps.md](./build-apps.md). `apeironcode fix` runs the repair
loop: detect checks → run → propose an approval-gated patch → apply → rerun. Try
`apeironcode fix --dry-run` first. See [fix-code.md](./fix-code.md).

Every write and command is approval-gated. See [safety.md](./safety.md).
