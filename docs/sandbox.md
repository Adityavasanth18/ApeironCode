# Sandbox and command policy

ApeironCode evaluates every supported project command through a central command
policy before execution. The policy classifies risk, network access, workspace
scope, approval requirements, and whether Docker isolation is suitable.

```bash
apeironcode sandbox status
apeironcode sandbox doctor
apeironcode --sandbox auto fix
apeironcode --sandbox docker fix
apeironcode --sandbox native fix
```

Modes are `auto` (default), `docker`, `native`, and `none`. Set the mode with
`--sandbox` or `APEIRONCODE_SANDBOX`.

- `auto`: use Docker for suitable validation/build/test commands when Docker
  and its daemon are actually available; otherwise use native fallback.
- `docker`: require Docker and fail clearly when unavailable.
- `native`: run approval-gated commands on the host.
- `none`: disable isolation selection; command policy and blocking remain on.

Docker mounts only the workspace at `/workspace`, does not mount the host home
or Docker socket, drops capabilities, uses a read-only container root, and
keeps network off unless policy explicitly permits it. Secrets are not passed
to Docker by default.

Native fallback prints: `Running natively. Approval-gated, but not
OS-sandboxed.` This is not a claim of process isolation.

Current limits:

- Docker isolation applies only to commands that actually run in Docker.
- Native execution is not OS-isolated.
- No per-subagent credential isolation.
- No cloud or distributed execution.
- This is defense in depth, not a guarantee that arbitrary code cannot escape.

## Command policy

Safe validation commands default to network off. Installs and other network-on
operations are shown as `network: ask`. High-risk commands require manual
confirmation and cannot be approved by `--yes`. Blocked commands, including
`npm publish`, `sudo`, pipe-to-shell downloads, forced/mirrored pushes, direct
`.git` mutation, `.env` mutation, and detectable workspace escapes, never reach
the child process.
