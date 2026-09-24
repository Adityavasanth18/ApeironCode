# Safety

ApeironCode Agent treats safety as a first-class runtime concern.

Approval modes:

- `ask`: explicit approvals when a tool requests them.
- `auto-read`: low-risk project reads can proceed automatically.
- `trusted`: in-project reads and writes can auto-approve, but commands and git actions still require approval.
- `bypass`: normal approvals are skipped for trusted automation. It does not
  override high-risk manual confirmation or blocked command policy.

Guardrails:

- External paths and sensitive files require approval.
- Diffs are shown before file writes and edits.
- Commands are checked for blocked and high-risk patterns before execution.
- `sudo`, `curl | sh`, `wget | sh`, `npm publish`, forced/mirrored pushes,
  workspace escapes, and direct sensitive metadata mutation are blocked.
- High-risk commands require manual confirmation; `--yes` does not approve them.
- Command logs and output redact common token/key formats.
- Docker is selected only when available/configured. Native fallback is
  approval-gated but not OS-isolated.

The design goal is simple: no silent mutation, no silent execution, and no secret access without user visibility.
