# Jyotish Arogya Mobile App

Mobile-first prototype for the Jyotish Arogya PRD: constitutional health profile, HVI score, Dasha risk, Gochara alerts, daily nudges, remedy adherence, reports, and embeddable APIs.

## Run

```bash
node server.mjs
```

Open `http://localhost:4174`.

## Prokerala Astrology API

Health Kundli supports Prokerala through server-side OAuth client credentials. Set these environment variables on the server or in Vercel, never in browser code:

```bash
ASTROLOGY_PROVIDER=Prokerala
PROKERALA_CLIENT_ID=your-client-id
PROKERALA_CLIENT_SECRET=your-client-secret
PROKERALA_CLIENT_TYPE=Web Application
PROKERALA_API_BASE_URL=https://api.prokerala.com/v2
PROKERALA_TOKEN_URL=https://api.prokerala.com/token
PROKERALA_AYANAMSA=1
```

The public app and embed APIs expose only provider status, requested birth parameters, Kundli output, SVG chart image, and health analysis. They do not expose the client secret.

## What Is Included

- Mobile PWA shell with PharmEasy-inspired teal, mint, saffron, and clinical white palette.
- Daily morning nudge engine with safety notes and checklists.
- HVI, DRS, TIA, transit alerts, remedy plan, weekly forecast, and report metadata.
- Sprint 1 onboarding with encrypted birth data, separate analytics ID, timezone/ayanamsha capture, and dosha cross-check.
- Health Kundli creation with external astrology provider adapter, SVG output image, and health-focused Kundli analysis.
- Sprint 4 remedy commerce layer with 90-day plan APIs, PharmEasy search recommendations, price references, pincode-dependent SLA, and physician/Jyotishi safety gates.
- Real-user localization layer for planet names, remedies, safety copy, alerts, nudges, and product guardrails across English, Hindi, Tamil, and Telugu.
- REST API server with CORS for host-app integration.
- Shadow-DOM embed SDK via `public/embed.js`.
- OpenAPI-style contract at `/api/openapi.json`.
- Sprint 0 safety foundation with policy, disclaimer rules, schema versions, escalation rules, and copy validation.

## Embed Snippet

```html
<script src="http://localhost:4174/embed.js" defer></script>
<jyotish-arogya-app user-id="demo" api-base="http://localhost:4174"></jyotish-arogya-app>
```

Or mount with JavaScript:

```html
<div id="jyotish-widget"></div>
<script src="http://localhost:4174/embed.js"></script>
<script>
  window.JyotishArogya.mount("#jyotish-widget", {
    userId: "demo",
    apiBase: "http://localhost:4174",
    compact: true
  });
</script>
```

## API Docs

See [docs/API.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/API.md) or call:

```bash
curl http://localhost:4174/api/openapi.json
```

If your shell has npm available, `npm start` and `npm run check` are also defined.

## Sprint 0 Safety

See [docs/SAFETY_FOUNDATIONS.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/SAFETY_FOUNDATIONS.md).

## Sprint 1 Onboarding

See [docs/SPRINT_1_ONBOARDING.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/SPRINT_1_ONBOARDING.md).

## Health Kundli

See [docs/HEALTH_KUNDLI.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/HEALTH_KUNDLI.md).

## Sprint 2 Dashboard

See [docs/SPRINT_2_DASHBOARD.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/SPRINT_2_DASHBOARD.md).

## Sprint 3 Nudges

See [docs/SPRINT_3_NUDGES.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/SPRINT_3_NUDGES.md).

## Sprint 4 Remedy Commerce

See [docs/SPRINT_4_REMEDY_COMMERCE.md](/Users/pranav.saxena/Documents/Codex/2026-05-23/files-mentioned-by-the-user-jyotish/docs/SPRINT_4_REMEDY_COMMERCE.md).
