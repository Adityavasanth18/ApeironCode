# Fixing code with `apeironcode fix`

`apeironcode fix` is ApeironCode's core repair workflow. The runtime owns the
loop; the model only proposes small patches.

```bash
apeironcode fix              # detect checks, run them, propose approval-gated fixes
apeironcode fix --dry-run    # preview: detect project + checks, run/change nothing
apeironcode fix --safe       # only edit files referenced by errors; max 2 attempts
apeironcode fix --all        # also run build/e2e; allow more attempts
apeironcode fix --until-green # keep attempting until checks pass (up to 10)
```

## What it does

1. Detects the project type, package manager (npm/pnpm/yarn/bun), and the
   available check scripts (typecheck, lint, test, build, e2e).
2. Runs checks in order: typecheck → lint → test → build → e2e
   (build/e2e only with `--all` / `--until-green`).
3. Parses failures into structured issues (TypeScript errors, ESLint errors,
   failing tests, module-not-found, …) and selects a focused context packet.
4. Asks the configured provider for a **minimal** file plan, parsed robustly
   (markdown/fenced/tool-call output is tolerated) and validated against a
   schema. One correction attempt is made if the plan is invalid.
5. Shows a **single approval bundle** (issues + files + commands + risk) with a
   redacted **diff preview** (old vs planned content) so you see the change
   before approving. Each command shows risk, sandbox, and network policy.
   High-risk and blocked commands are stripped and never auto-approved.
6. On approval, creates a checkpoint, applies the change through the
   ToolRegistry, and reruns the failed checks.
7. Repeats up to a mode-based limit, then prints an honest final report.

## Safety

- **Approval is required before any change.** In `ask` mode you confirm the
  bundle; in `bypass`/`trusted` mode it is auto-approved.
- **`--safe`** restricts edits to files referenced by the error and forbids
  delete/rename and dependency installs.
- **`--dry-run`** never runs checks or writes files.
- High-risk commands (`rm -rf`, `sudo`, `curl | sh`, `npm publish`, `git push`,
  …) are blocked from the auto-applied bundle.
- Checks use Docker in `auto` mode when it is genuinely available; native
  fallback is reported honestly and is not OS-isolated.
- A checkpoint is created before applying; a failed apply is rolled back so the
  workspace is never left half-changed. Checkpoints live under
  `.apeironcode/checkpoints/` (gitignored).

## Honest limitations (alpha)

- This is alpha. It does not fix every repo, and it is not fully autonomous —
  you review and approve changes.
- Repair quality depends on the configured provider/model. A weak model may
  return plans that do not fix the issue; the loop stops safely after the
  attempt limit.
- The `mock`/demo provider is deterministic and is **not** a real coding model;
  use Ollama or a cloud provider for real repairs.
- `--commit` is planned for a later phase and is not active yet.
