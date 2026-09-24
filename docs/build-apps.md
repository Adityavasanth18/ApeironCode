# Building apps with `apeironcode new`

ApeironCode builds small apps from **deterministic templates** — no API key or
model is required for template generation. AI customization (via a configured
provider) is an optional layer on top.

```bash
apeironcode new "premium todo app"
apeironcode new "CRM dashboard" --stack dashboard
apeironcode new "landing page for an AI startup" --style premium-saas
apeironcode new "a React task app" --stack vite --dir my-app
apeironcode build "create a premium todo app"     # build also creates apps
```

`apeironcode new` and `apeironcode build` run the same app-builder engine:
parse the idea → pick a template → show an approval bundle **with a diff preview
of the files to be created** → create real files → run validation → print a
**Plan** checklist and completion panel with how to open the app.

## Supported templates

| Stack | Template | Notes |
| --- | --- | --- |
| `static` | static todo | HTML/CSS/JS. **Most reliable today** — no install, always works. |
| `static` | static landing | Premium landing page with a mock waitlist. |
| `dashboard` | static dashboard | Responsive, frontend-only dashboard with local sample data. |
| `vite` | Vite + React (TypeScript) | Alpha. Requires `npm install` to run; the CLI does not auto-install. |

Next.js is not available yet; a Next.js request downgrades to Vite + React and
says so honestly.

## What's a mock, and what's real

This phase builds **frontend prototypes**. To stay honest:

- "login", "auth", "sign in" → a **mock login** UI only (no real backend).
- "CRM", "customers", "orders" → **local sample data** rendered in the browser.
- "billing", "payments" → a **mock** UI only.

ApeironCode does not create real authentication, databases, or billing in this
phase, and the final report says so.

## Validation

After creating files, ApeironCode validates the app:

- **Static apps**: files exist, the HTML's linked CSS/JS exist, `node --check`
  passes on the JS, and a design checklist (title, viewport, labels, responsive
  rules, no obvious overflow) passes. No network required.
- **Vite apps**: `npm run build` / `npm run typecheck` are detected. The CLI
  does **not** auto-install or run them; run `npm install && npm run dev`
  yourself. They are reported as *skipped*, never as a fake pass.

If a static app fails validation, the report shows exactly which check failed —
it never claims a broken app passed.

## Browser UI smoke

After creating a static app you can open it in a real browser and verify it
actually renders:

```bash
apeironcode test-ui ./my-app
apeironcode new "todo app" --ui-smoke --yes          # run during creation
apeironcode new "todo app" --require-ui-smoke --yes  # fail if it can't run/pass
```

It checks page load, missing assets, console errors, takes a screenshot, and
runs template-specific interactions (e.g. add a todo and confirm the list
grows). It needs Chromium (`npx playwright install chromium`); without a
browser it reports **skipped**, never a fake pass. See
[ui-smoke.md](./ui-smoke.md). UI smoke is not a full QA replacement.

## Safety

- App creation is **approval-gated**: you see a bundle (directory + files +
  validation) before anything is written. Auto-approved only in bypass/trusted
  mode or with `--yes`.
- A **non-empty directory** is never written into without `--overwrite`, and
  even then **existing files are never replaced** — only new files are added.
- Files are only ever written inside the chosen app directory; `.git` and
  `.env` are never written.
- Validation commands use the central command policy. Network is off by
  default, Docker is used when available/configured, and native fallback is not
  described as OS-isolated.
- `--dry-run` shows the plan and writes nothing.

## Limitations (alpha)

- Static templates are the most reliable. Vite is alpha and needs a manual
  install/build. Next.js is not implemented yet.
- These are prototypes, not production apps. Use `apeironcode improve` and
  `apeironcode fix` to iterate.
