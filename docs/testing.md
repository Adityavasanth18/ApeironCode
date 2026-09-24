# Testing and Validation

ApeironCode is an early CLI alpha. Its default validation is broad, but it is
not a substitute for testing your chosen model and provider on your own code.

## Default CI

Default CI runs TypeScript checks, linting, builds, unit and integration tests,
scripted end-to-end flows, file-size checks, a dependency audit, and an npm
package dry run.

Most agent workflows use deterministic fixtures, mocked network responses, or
the no-key mock provider. Default CI does not call paid model APIs and does not
require real provider credentials.

## Smoke and Dogfood Checks

The repository includes smoke commands for scripted coding, error-fixing, TUI,
and terminal workflows. These verify CLI orchestration and safety behavior with
controlled inputs. They do not prove that every real model will make correct
changes.

Before trusting a provider on important work:

1. Run the relevant smoke commands.
2. Test in a disposable repository.
3. Keep approval mode enabled.
4. Review every diff and command.
5. Report failures with the dogfood issue template.

## Real Providers

Real-provider checks require your own API key or local model service and are not
run in default CI. Provider behavior, availability, pricing, and model quality
can change independently of ApeironCode.

Large-project autonomy and long multi-agent workflows remain experimental.
