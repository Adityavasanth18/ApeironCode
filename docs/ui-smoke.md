# UI smoke (`apeironcode test-ui`)

`apeironcode test-ui` opens a generated app in a real browser and checks it
actually renders — not just that files exist. No API key or model is required.

```bash
apeironcode test-ui ./premium-todo-app
apeironcode test-ui --json
apeironcode test-ui --screenshot
apeironcode test-ui --port 4173 --timeout 30000
```

## What it checks

- **page loads** without a navigation error
- **no missing assets** (CSS/JS that 404 or fail to load)
- **no console errors** / page errors
- **title** and **main heading** are present
- a **screenshot** is saved
- **template-specific interactions**, e.g. for a todo app: type a task, click
  Add, and confirm the list grows

Results are saved under the app's `.apeironcode/ui-smoke/` (a `latest.json`
pointer plus timestamped runs and a screenshot). These artifacts are gitignored.
Secrets are redacted and large logs are truncated.

## Requirements

The smoke uses [Playwright](https://playwright.dev). It is **optional** — if
Chromium is not installed, the smoke is reported as **skipped**, never as a fake
pass:

```
UI smoke: skipped — Chromium is not installed
Run: npx playwright install chromium
```

To enable real browser runs:

```bash
npm install playwright
npx playwright install chromium
```

## App builder integration

`apeironcode new` / `apeironcode build` can run the smoke after creating an app:

```bash
apeironcode new "todo app" --ui-smoke --yes          # run it; skip honestly if no browser
apeironcode new "todo app" --require-ui-smoke --yes  # fail if it cannot run or does not pass
apeironcode new "todo app" --no-ui-smoke --yes       # don't run it
```

The build report shows the result honestly:

```
Validation:
  ✓ static files
  ✓ JavaScript syntax
  ✓ design checklist
  ○ UI smoke skipped: Chromium not installed
```

## Limitations

UI smoke is **not a full QA replacement** and does not catch every UI bug or
judge visual quality. It catches obviously-broken renders: missing assets,
console errors, and failed core interactions. Vite apps require installed
dependencies; this phase does not auto-install or run their dev server.
