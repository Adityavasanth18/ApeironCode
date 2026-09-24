# Terminal UX: progress, approvals, diffs, rollback

ApeironCode's workflows (`fix`, `new`/`build`, `test-ui`, `improve`, `review`)
render a shared, compact progress board and approval UX.

**Where you'll see this today:**

- `apeironcode new`/`build` show the approval bundle + **diff preview** of the
  files to be created, then a **Plan** checklist and completion panel.
- `apeironcode fix` shows the repair approval bundle with a **diff preview**
  (old vs planned content), strips high-risk commands, and ends with a
  completion/failure panel that lists next actions (incl. `rollback --last`).
- `apeironcode test-ui` and `apeironcode review` print their own status panels.

The interactive Ink agent chat keeps its existing compact status line; the live
in-chat progress board is a follow-up.

## Progress board

```
Task: Build CRM dashboard

Plan
  ✓ Analyze request
  ✓ Select template
  ✓ Create files
  → Run static validation
  ○ Run UI smoke

Files
  + index.html  +20/-0
  + styles.css  +30/-0

Commands
  ✓ node --check app.js  1.2s
  ✗ npm test  3.8s (exit 1)
      Failing test: should add task

Status: failed
```

Symbols: `✓` passed · `→` running · `○` pending · `✗` failed · `–` skipped.
Normal mode stays compact (no raw logs or giant JSON). Run with `--verbose` or
`APEIRONCODE_DEBUG=1` for full command output.

## Approval bundle

Writes and commands are approval-gated. You see one compact bundle:

```
ApeironCode wants to fix detected failures:

Create 1 file
Modify 1 file
Run 2 commands

Risk: medium

Files:
  ~ styles.css
Commands:
  - npm run build
    risk: safe | sandbox: auto/docker when available | network: off
  - npm install
    risk: medium | sandbox: auto/docker when available | network: ask

Options: [Approve all] [View diff] [Files only] [Reject]
```

High-risk and blocked commands (`rm -rf`, `sudo`, `curl | sh`, `npm publish`,
`git push --force`, broad `chmod -R`/`chown -R`) are **never** bundled or
auto-approved — even with `--yes`/trusted/bypass. In a non-interactive terminal,
the default is to reject unless `--yes` (or trusted/bypass mode) is set.

## Diff preview

`[View diff]` shows a redacted per-file summary: additions/deletions and the
first changed lines. Binary and very large files are summarized, secrets are
redacted, and full diffs are available in verbose/debug mode.

## Rollback

`apeironcode fix` creates a checkpoint before applying changes. Recover with:

```bash
apeironcode rollback list      # show checkpoints (newest first)
apeironcode rollback --last    # restore the most recent checkpoint
apeironcode rollback <id>      # restore a specific checkpoint
```

Rollback only touches files recorded in the checkpoint (never foreign files) and
asks for confirmation unless `--yes`. No checkpoint is handled gracefully.

## UI smoke artifacts

After a UI smoke, the report surfaces the screenshot and report paths and a
`apeironcode test-ui <app>` next step. A skipped smoke is clearly *skipped*,
never a pass. See [ui-smoke.md](./ui-smoke.md).

## Non-interactive behavior

Direct commands (`fix --dry-run`, `new … --yes`, `test-ui --json`, `review`,
`rollback list`) print plain text and never require the interactive TUI.
`--yes` approves normal bundles but still cannot approve blocked high-risk
commands.

## Honest limits

Approval-gated does **not** mean OS-sandboxed. The browser smoke is not full QA.
ApeironCode is not fully autonomous — you review and approve changes.
