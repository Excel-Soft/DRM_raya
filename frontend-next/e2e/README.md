# Browser E2E (Playwright)

Requires **Next.js** (dev `:3000` or standalone `:3001` after `npm run build:standalone`) and **Express on :5001** (`BACKEND_URL`).

Standalone must include copied static assets — `npm run build` runs `postbuild` to copy into `.next/standalone/.next/static`. **Restart** `node .next/standalone/server.js` after every build (running server will 404 new chunk hashes until restart). Do not run `server.js` after `next build` without that copy step.

```bash
cd frontend-next
npm install
npx playwright install chromium
npm run test:e2e
```

Optional authenticated flows (never commit values):

```bash
export E2E_EMAIL='your-test-user@example.com'
export E2E_PASSWORD='your-test-password'
# Optional second user without audit-log viewer role:
export E2E_EMAIL_RESTRICTED='…'
export E2E_PASSWORD_RESTRICTED='…'
PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
```

Credentials must come from an approved secure channel, not from production discovery.
