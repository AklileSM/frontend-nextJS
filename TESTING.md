# Testing

> **There are currently no automated tests in this repo.** The app is verified manually against the dev backend.

This document is here to (a) acknowledge that, and (b) give you a starting point if you want to add tests now.

## Current state

```
package.json     → no "test" script
__tests__/       → does not exist
vitest.config.*  → does not exist
playwright.*     → does not exist
```

The only quality gates today are:

- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

Both are advisory. CI does not exist either.

## What you'd test (if you started today)

| Tier | Tool | What to cover |
|---|---|---|
| Unit | Vitest | Pure utilities in `lib/` (`hashFile`, `observationReportFlags`, `formatDate`, `engineeringReportPdf` shape) |
| Component | Vitest + Testing Library | `ReportBuilder` form validation, `RoomFilterMenu` filtering, `FileGrid` empty state |
| Integration | Playwright | Login → upload → annotate → publish; admin sees the admin tab; viewer cannot upload |
| Visual | Playwright trace + diff | Optional — viewer pages, especially panorama and pointcloud |

Don't aim for 100% coverage. Aim for the tests that catch the bugs you've already seen.

## Recommended setup — Vitest + Testing Library

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),  // mirror Next.js paths
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';

// Stub Next.js navigation hooks that components import.
import { vi } from 'vitest';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Stub localStorage in jsdom (it exists but is fragile across tests).
beforeEach(() => localStorage.clear());
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:run": "vitest run"
  }
}
```

### Example unit test

```ts
// lib/observationReportFlags.test.ts
import { describe, it, expect } from 'vitest';
import { flagsFromObservationBooleans } from './observationReportFlags';

describe('flagsFromObservationBooleans', () => {
  it('returns the correct strings for all-true', () => {
    expect(flagsFromObservationBooleans(true, true, true)).toEqual([
      'safety_concern',
      'quality_concern',
      'schedule_delayed',
    ]);
  });
  it('omits unset flags', () => {
    expect(flagsFromObservationBooleans(false, true, false)).toEqual(['quality_concern']);
  });
});
```

### Example component test

```tsx
// components/explorer/RoomFilterMenu.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { RoomFilterMenu } from './RoomFilterMenu';

describe('RoomFilterMenu', () => {
  it('filters as the user types', async () => {
    const onPick = vi.fn();
    render(
      <RoomFilterMenu
        rooms={[
          { id: '1', slug: 'lobby',   name: 'Lobby',   project_id: 'x', sort_order: 0, floor_plan_coordinates: null },
          { id: '2', slug: 'kitchen', name: 'Kitchen', project_id: 'x', sort_order: 1, floor_plan_coordinates: null },
        ]}
        onPick={onPick}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/filter rooms/i), 'lob');
    expect(screen.getByText('Lobby')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen')).not.toBeInTheDocument();
  });
});
```

### Mocking the API client

Don't hit a real backend in unit/component tests. Mock the module:

```ts
import { vi } from 'vitest';
vi.mock('@/services/apiClient', () => ({
  listProjects: vi.fn().mockResolvedValue([{ id: '1', slug: 'a6-stern', name: 'A6 Stern', /* … */ }]),
}));
```

The api-client tests themselves (network behavior, error parsing, 401 redirect) belong in their own file and can use `vi.fn()` for `fetch`.

## Recommended setup — Playwright (integration)

```bash
npm install -D @playwright/test
npx playwright install --with-deps
```

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

E2E tests need a real backend. Two options:

- **Local stack** — run `docker compose up -d` from `deployment/` and point `BACKEND_URL=http://localhost:3002`.
- **Disposable backend** — wrap `docker compose up -d db backend` in a fixture that resets the DB between runs.

Smoke test:

```ts
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('login redirects to /app', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app/);
});
```

## What NOT to test

- Three.js render output (mocking WebGL is more work than it's worth — verify viewers manually).
- The PDF byte content (test the input shape passed to `buildFieldObservationPdf`, not the bytes).
- Animation timings (`framer-motion` — its own concerns).
- The Next.js framework (route resolution, rewrites — assume they work).

## CI suggestion (when you're ready)

GitHub Actions, `.github/workflows/test.yml`:

```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:run
```

Add Playwright as a separate job if/when you wire it up — it needs the backend stack and is too slow to run on every push.

## Where the code lives (when it exists)

| Concern | File |
|---|---|
| Unit / component tests | `__tests__/` next to the file, or `<file>.test.ts(x)` co-located |
| Vitest config | `vitest.config.ts`, `vitest.setup.ts` |
| Playwright tests | `e2e/` |
| Playwright config | `playwright.config.ts` |
| CI config | `.github/workflows/test.yml` |
