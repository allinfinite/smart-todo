# Client Work Portal Template

Static client portal template for collecting work requests, showing compact task cards, displaying completion screenshots, and letting clients create follow-up todo items from completed work.

This frontend is template-ready. You can brand it and point it at any compatible API entirely through env vars at build time.

## How it works

- The app loads `portal.config.js` before `app.js`.
- `portal.config.js` is generated from env vars by `scripts/render-config.mjs`.
- If you do nothing, the app uses generic defaults and still runs.
- If you set env vars, the generated config overrides branding, copy, API endpoints, waiting messages, and theme colors.

## Quick start

```bash
npm run build
python3 -m http.server 8123
```

Open `http://127.0.0.1:8123`.

To customize locally:

```bash
cp .env.example .env.local
npm run build
```

## Primary env path

The easiest way to customize everything is one env var:

- `PORTAL_TEMPLATE_CONFIG_JSON`

Example:

```json
{
  "portalTitle": "Acme Client Portal",
  "storageNamespace": "acme-portal",
  "apiBase": "https://api.example.com",
  "requestsPath": "/api/portal/acme/requests",
  "repliesPath": "/api/portal/acme/replies",
  "heroEyebrow": "Acme Delivery Portal",
  "heroTitle": "Send work, watch it move, and keep the list growing.",
  "composerTitle": "Send work to the Acme team",
  "boardTitle": "Acme work board",
  "waitingMessages": [
    "It is in motion. You can add another item to the list while this moves."
  ],
  "theme": {
    "accent": "#0f766e",
    "accentDark": "#115e59",
    "ok": "#15803d",
    "warn": "#a16207",
    "fail": "#b91c1c"
  }
}
```

## Optional individual env vars

You can also override pieces individually:

- `PORTAL_TITLE`
- `PORTAL_STORAGE_NAMESPACE`
- `PORTAL_API_BASE`
- `PORTAL_REQUESTS_PATH`
- `PORTAL_REPLIES_PATH`
- `PORTAL_HERO_EYEBROW`
- `PORTAL_HERO_TITLE`
- `PORTAL_HERO_COPY`
- `PORTAL_COMPOSER_TITLE`
- `PORTAL_BOARD_TITLE`
- `PORTAL_THEME_JSON`
- `PORTAL_WAITING_MESSAGES_JSON`

See [.env.example](/Users/daniellevy/Code/Cowork/gray-portal/.env.example) for the broader list.

## GitHub Pages deployment

This repo includes an optional Pages workflow at [.github/workflows/deploy-pages.yml](/Users/daniellevy/Code/smart-todo/.github/workflows/deploy-pages.yml).

Set these GitHub repository variables:

- `ENABLE_GITHUB_PAGES=1`
- `PORTAL_TEMPLATE_CONFIG_JSON`
- optionally `PORTAL_THEME_JSON`
- optionally `PORTAL_WAITING_MESSAGES_JSON`

Then enable GitHub Pages with GitHub Actions as the source. If `ENABLE_GITHUB_PAGES` is not set to `1`, the workflow exits cleanly without trying to configure Pages.

## Vercel deployment

Set the same env vars in Vercel and use:

- Build command: `npm run build`
- Output directory: `.`

## Backend contract

This template expects a compatible API that serves:

- `GET <requestsPath>`
- `POST <requestsPath>`
- `POST <repliesPath>`

The response/request shapes match the current Gray portal contract already used by this app.
