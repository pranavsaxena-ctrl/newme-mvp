# Health Kundli API Integration

This feature creates a health-focused Kundli image and a plain-language health analysis for the active profile.

## Provider Adapter

The server has a provider adapter for an external KundliAPI-compatible astrology API.

Environment variables:

```bash
KUNDLI_API_KEY=...
KUNDLI_API_BASE_URL=https://kundliapi.com
KUNDLI_LAGNA_CHART_ENDPOINT=/api/charts/lagna_chart
KUNDLI_PLANETS_ENDPOINT=/api/planets/all
KUNDLI_DASHA_ENDPOINT=/api/dasha/maha_dasha
KUNDLI_SADHESATI_ENDPOINT=/api/dosha/sadhesati
```

If `KUNDLI_API_KEY` is missing, the API returns a local deterministic fallback chart and marks the provider source as `local-fallback`.

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
