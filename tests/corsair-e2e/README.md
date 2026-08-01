# Corsair E2E Tests

Playwright end-to-end tests that run against the Corsair Next.js dev server.

## Running locally

```bash
# Start the Corsair dev server with Square sandbox env vars
NEXT_PUBLIC_SQUARE_APPLICATION_ID=sandbox-sq0idb-... \
NEXT_PUBLIC_SQUARE_LOCATION_ID=L...                  \
NEXT_PUBLIC_SQUARE_ENVIRONMENT=sandbox               \
pnpm --filter corsair-source dev

# In a second terminal, run the e2e suite
CLIENT_E2E_BASE_URL=http://localhost:3000 \
  pnpm exec playwright test --config tests/corsair-e2e/playwright.config.ts
```

## Required environment variables

### `CLIENT_E2E_BASE_URL`

Base URL of the running Corsair dev server.  Defaults to `http://localhost:3000`
when omitted.  Tests that require a live server are skipped automatically when
the URL is not reachable.

### Square sandbox credentials (build-time)

Several tests — including `group-registration-flag.spec.ts` — exercise the
BookingForm payment step.  The form reads the following variables **at build
time** (they are compiled into the Next.js bundle via `NEXT_PUBLIC_` prefix):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SQUARE_APPLICATION_ID` | Square application ID (sandbox or production) |
| `NEXT_PUBLIC_SQUARE_LOCATION_ID`    | Square location ID matching the application |
| `NEXT_PUBLIC_SQUARE_ENVIRONMENT`    | `sandbox` or `production` (defaults to `production`) |

If these variables are **not set when the dev server starts**, BookingForm
renders *"Payment system is not configured"* on step 3 and the Pay button
remains permanently disabled.

Tests that require a configured Square bundle detect this state via the
`data-square-ready="unconfigured"` attribute on the step-3 container and
**skip with a clear message** rather than timing out.  This is intentional:
the tests are not broken, the server just needs to be restarted with the
correct env vars.

### CI / GitHub Actions example

```yaml
- name: Start Corsair dev server
  env:
    NEXT_PUBLIC_SQUARE_APPLICATION_ID: ${{ secrets.SQUARE_SANDBOX_APP_ID }}
    NEXT_PUBLIC_SQUARE_LOCATION_ID:    ${{ secrets.SQUARE_SANDBOX_LOCATION_ID }}
    NEXT_PUBLIC_SQUARE_ENVIRONMENT:    sandbox
  run: pnpm --filter corsair-source dev &

- name: Wait for server
  run: npx wait-on http://localhost:3000 --timeout 60000

- name: Run Corsair E2E tests
  env:
    CLIENT_E2E_BASE_URL: http://localhost:3000
  run: pnpm exec playwright test --config tests/corsair-e2e/playwright.config.ts
```

> **Note:** Use Square *sandbox* credentials in CI — never production keys.
> Sandbox transactions are free and never charge real cards.
