# Health Kundli API Integration

This feature creates a health-focused Kundli image and a plain-language health analysis for the active profile.

## Provider Adapter

The server has a provider adapter for Prokerala's Astrology API. Authentication uses OAuth client credentials on the server, then calls Prokerala's Kundli, chart, planet-position, dasha, Sade Sati, and Mangal Dosha endpoints.

Environment variables:

```bash
ASTROLOGY_PROVIDER=Prokerala
PROKERALA_CLIENT_ID=...
PROKERALA_CLIENT_SECRET=...
PROKERALA_CLIENT_TYPE=Web Application
PROKERALA_API_BASE_URL=https://api.prokerala.com/v2
PROKERALA_TOKEN_URL=https://api.prokerala.com/token
PROKERALA_AYANAMSA=1
```

If Prokerala credentials are missing or the provider cannot be reached, the API returns a local deterministic fallback chart and marks the provider source as `local-fallback` or `external-api-error-fallback`. The client secret is never returned by the API or embedded app.

## Endpoints

- `GET /api/provider/status`
- `GET /api/health-kundli?userId=demo`
- `GET /api/health-kundli.svg?userId=demo`
- `/health-kundli.html?userId=demo` for the app page

## Analysis Scope

The health analysis focuses on:

- 1st house: constitution, vitality, immunity
- 6th house: acute illness, infection, metabolic load
- 8th house: chronic risk, surgery watch, deep transformation
- 12th house: sleep, feet, hidden vitality drain and hospitalization indicators
- HVI, DRS, dosha cross-check, and health-sensitive planet organ mapping

All analysis remains complementary wellness guidance and does not diagnose, treat, or replace medical care.
