# Publishing

## Local release checklist

1. Run `npm install`.
2. Run `npm run typecheck`.
3. Run `npm run test`.
4. Run `npm run build`.
5. Verify the binary locally with `node dist/cli/index.js --help`.
6. Verify one-shot mode with `node dist/cli/index.js "explain this repo"`.

## npm publishing notes

The intended public package name is `apeironcode`. Registry checks returned no
published version as of June 8, 2026, but npm availability is only confirmed
when a publish succeeds. The maintainer must authenticate with npm before
release.

The package is configured for global install with:

```json
{
  "name": "apeironcode",
  "bin": {
    "apeironcode": "./dist/cli/index.js"
  }
}
```

Publish flow:

1. Bump the version in `package.json`.
2. Build the package.
3. Confirm `dist/` contains the CLI bundle.
4. Run `npm publish --access public --tag alpha` from a trusted environment.

The CI workflow already validates install, typecheck, test, and build on Node 18, 20, and 22.
