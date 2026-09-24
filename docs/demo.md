# Demo mode

`apeironcode demo` is a deterministic, no-key way to see ApeironCode's
plan → write → validate flow in under a minute. It needs no API key, model, or
Ollama.

Demo mode never calls a provider, model, Ollama, or the network. Each scenario
writes real files into a demo workspace (under your OS temp directory) and runs
real local validation (for example `node --check`).

```bash
apeironcode demo            # list the scenarios
apeironcode demo todo-app   # scaffold a working static HTML/CSS/JS todo app
apeironcode demo fix-test   # reproduce a failing test, apply a fix, re-run to green
apeironcode demo improve-ui # turn a plain page into a premium one
apeironcode demo review     # deterministic review of a sample diff
```

## What each scenario does

- **todo-app** — writes `index.html`, `styles.css`, and `app.js`, then validates
  that the JS parses (`node --check app.js`) and that the HTML's linked assets
  exist. Open `index.html` in a browser.
- **fix-test** — writes a tiny project with a deliberate bug and a small test
  runner, runs it (fails), applies the deterministic fix, and re-runs (passes).
- **improve-ui** — writes a plain pricing card, then restyles it with a premium
  dark theme and confirms no CSS/JS references are missing.
- **review** — loads a fixed sample diff and prints deterministic, rule-based
  findings across security, bug risk, and maintainability.

## Honest limitations

- Demo mode is **deterministic local examples, not a model.** It does not use
  AI. The output is fixed.
- The `mock` provider is a deterministic test/demo stub, **not** a real coding
  model. It exists for tests and offline checks.
- For real projects, configure [Ollama or a cloud provider](./providers.md).
