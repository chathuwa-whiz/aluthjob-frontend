# AluthJob web app

The browser front end for the AluthJob API in `../server`. React 19, Vite, TypeScript, TanStack Query,
React Router. No UI framework: the design system is a few hundred lines of CSS in `src/styles/`.

What a person can do here: create an account and confirm their email, upload a CV and correct what was read from
it, search vacancies, read a match, edit a cover letter, approve it, confirm an email address that was read from
a picture, connect their own mailbox, send applications, and follow what happened to each one.

## Run it in development

```bash
# terminal 1: the API (see ../server/.env.example)
cd ../server && npm run dev

# terminal 2: this app, on http://localhost:3000
npm install
npm run dev
```

The API's `.env` needs `FRONTEND_URL=http://localhost:3000`. In development the API prints confirmation and
password-reset emails to its own console (no mail server needed): copy the link from there.

The browser only ever talks to its own origin. Vite forwards `/api` to the API on `127.0.0.1:4000`
(`vite.config.ts`), so the session cookie is first-party and there is no cross-origin setup to get wrong.

## Tests

```bash
npm test            # 112 tests: logic, and every screen against a fake API
npm run typecheck
```

The screen tests render the real app with the real providers and replace only `fetch` (`src/test/harness.tsx`),
so they exercise the same code paths as the browser. A route a test did not define answers 404 and is recorded,
so a test cannot silently lean on an endpoint it forgot about.

## Put it on a server

Build the static files and let a reverse proxy serve them and forward `/api` to the API. Both halves must be on
the **same origin**, over **https** (the session cookie is `Secure` in production).

```bash
npm run build      # writes dist/
```

Example for nginx (adjust the domain and paths):

```nginx
server {
    listen 443 ssl http2;
    server_name jobs.example.com;
    # ssl_certificate ...; ssl_certificate_key ...;

    root /var/www/aluthjob/client/dist;

    # strict policy: the app loads nothing from anywhere else
    add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy same-origin always;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 6m;      # CV uploads are limited to 5 MB
        proxy_read_timeout 600s;      # reading a CV and writing a letter can take minutes on a small CPU model
    }

    location / {
        try_files $uri /index.html;   # client-side routes
    }

    # fingerprinted files never change
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
}
```

Then in the API's `.env`: `NODE_ENV=production`, `FRONTEND_URL=https://jobs.example.com`, `TRUST_PROXY=1`, and the
`SYSTEM_SMTP_*` settings (otherwise nobody can register: confirmation emails cannot be sent).

## How it is organised

```
src/
  api/         the HTTP client (one place), endpoint functions, data shapes, query hooks
  auth/        session provider, and the "active CV" an account is working with
  components/  Button, fields, Alert, Tabs, toasts, layouts: one vocabulary used everywhere
  pages/       one file per screen
  lib/         pure helpers: formatting, safe URLs, profile cleaning
  styles/      tokens (colour, type, space), base, components, layout
  test/        the fake API and fixtures
```

## Decisions worth knowing

- **Links from adverts are untrusted.** Job pages are scraped, so any address could be `javascript:...`. Only
  plain `http(s)` addresses become links (`src/lib/url.ts`); everything else is dropped.
- **What is approved is what is on screen.** The approve and send buttons are disabled while the letter has
  unsaved edits, and the email preview always shows the saved text.
- **Addresses read from a picture are confirmed by typing them back**, after looking at the original advert.
- **A 401 is not always "signed out".** A wrong password on the Account page also answers 401; calls like that
  are marked `answers401` so they show an error instead of ending the session (`src/api/client.ts`).
- **One-time links** (email confirmation, password reset) carry their token in the URL fragment, are used once
  even when React mounts a page twice, and are removed from the address bar immediately.
- **Slow work is shown honestly.** Reading a CV or writing a letter takes from half a minute to a few minutes on
  a local model, so those screens show a running clock and say why, rather than a bare spinner.
- **Dark mode** follows the system setting. Colours are OKLCH tokens in `src/styles/tokens.css`; every text and
  control pair was checked against WCAG AA in both themes.
- **Designed for longer text.** Layouts wrap and never assume a text length, so Sinhala and Tamil can be added
  later (the font stack already lists fonts for both scripts). There is no translation layer yet.

The product and design intent is written down in `../PRODUCT.md`.
