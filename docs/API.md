# Jyotish Arogya API Contract

Base URL for the local prototype:

```text
http://localhost:4174
```

All endpoints return JSON and include permissive CORS for embedding during prototype development.

## Core

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/config` | Theme, language, tier, and safety config |
| GET | `/api/safety` | Sprint 0 safety policy, disclaimer rules, escalation rules, and language rollout |
| GET | `/api/localization?language=Hindi` | Localized planet names, safety copy, and coverage metadata |
| GET | `/api/schemas` | Versioned HVI, DRS, and TIA response schemas |
| POST | `/api/content/validate` | Preflight health copy against blocked safety patterns |
| GET | `/api/onboarding/options` | Birth profile, ayanamsha, timezone, signs, and dosha questionnaire options |
| GET | `/api/provider/status` | External astrology provider configuration and endpoint status |
| GET | `/api/health-kundli?userId=demo` | Create Health Kundli payload, chart, provider status, and health analysis |
| GET | `/api/health-kundli.svg?userId=demo` | Render Health Kundli as SVG image |
| GET | `/api/dashboard-summary?userId=demo` | MVP dashboard status, current Dasha, next critical window, acceptance flags |
| GET | `/api/critical-windows?userId=demo` | 3-month Critical Health Window calendar |
| GET | `/api/openapi.json` | OpenAPI-style contract |
| GET | `/api/embed/manifest` | Embed script, custom element, and snippet |

## Profile and Onboarding

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/profile/:userId` | Fetch birth profile |
| POST | `/api/profile` | Create or update profile |
| POST | `/api/onboarding` | Submit birth data and dosha inputs |

Example:

```bash
curl -X POST http://localhost:4174/api/onboarding \
  -H "content-type: application/json" \
  -d '{"id":"meera","name":"Meera","birthDate":"1992-11-08","birthTime":"05:25","birthPlace":"Pune, India","timezone":"Asia/Kolkata","ayanamsha":"Lahiri","lagna":"Virgo","moonSign":"Cancer","doshaAnswers":{"body_frame":"Vata","skin_temperature":"Pitta","digestion":"Pitta","stress_response":"Vata","sleep":"Vata","energy":"Pitta"}}'
```

Profile responses include an encrypted-at-rest birth-data flag, separated analytics ID, onboarding completion state, and an authorized client view of birth fields. The encrypted ciphertext itself is not returned by `/api/profile/:userId`.

## Dashboard Intelligence

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard?userId=demo` | Full embeddable dashboard payload |
| GET | `/api/hvi/:userId` | Health Vulnerability Index |
| GET | `/api/dasha/:userId` | Dasha risk and future windows |
| GET | `/api/transits?userId=demo` | Active Gochara alerts |
| GET | `/api/nudges/today?userId=demo` | Morning health nudge |
| POST | `/api/nudges/checklist` | Update daily nudge checklist completion |
| GET | `/api/nudges/streak?userId=demo` | Nudge completion, streak, and engagement metrics |
| POST | `/api/nudges/rate` | Nudge rating and feedback |
| GET | `/api/weekly-forecast?userId=demo` | Seven-day health forecast |

## Remedies, Reports, Notifications

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/remedies?userId=demo` | Active remedy plan with 90-day plan envelope |
| GET | `/api/remedies/plan?userId=demo` | 90-day remedy plan with PharmEasy search recommendations, price, SLA, and safety gates |
| GET | `/api/remedies/products?userId=demo` | Product-only recommendation feed for host-app commerce integrations |
| POST | `/api/remedies/checkin` | Mark remedy step complete |
| GET | `/api/reports/constitution?userId=demo` | Constitution report metadata |
| GET | `/api/reports/remedy-plan?userId=demo` | Remedy-plan report metadata and JSON payload |
| GET | `/api/reports/physician-summary?userId=demo` | Physician-facing remedy safety summary |
| POST | `/api/notifications/preferences` | Nudge time, language, detail level |

Sprint 4 product recommendation objects include `provider`, `searchQuery`, `name`, `brand`, `price`, `sourceUrl`, `priceLastChecked`, `reason`, `dosageGuardrail`, and `sla`. Fulfillment SLA is pincode-dependent because PharmEasy delivery time, stock, and substitutions need a live checkout/pincode check.

## Safety Requirements

- Always frame outputs as health tendencies, not diagnoses.
- Critical alerts must recommend qualified medical care for persistent or urgent symptoms.
- Gemstone recommendations must include qualified Jyotishi review language.
- Mental distress flows must show India-first resources: 112 for immediate danger, Tele-MANAS 14416 / 1800-89-14416, KIRAN 1800-599-0019, and iCALL +91 9152987821.
- Never expose death prediction, terminal illness timing, or fear-based copy.

## Health Kundli

The prototype includes a provider adapter for a KundliAPI-compatible external astrology API. Set `KUNDLI_API_KEY` to enable external calls. Without a key, `/api/health-kundli` returns a local fallback chart so the app remains testable.

```bash
curl http://localhost:4174/api/health-kundli?userId=demo
curl http://localhost:4174/api/health-kundli.svg?userId=demo
```

The analysis focuses on health-sensitive houses: Lagna, 6th, 8th, and 12th, with Dasha/HVI support and safety disclaimers.

## Copy Validation

```bash
curl -X POST http://localhost:4174/api/content/validate \
  -H "content-type: application/json" \
  -d '{"content":"A high Mars day may raise inflammation tendencies. Rest, hydrate, and consult a physician for persistent symptoms."}'
```

Responses include `policyVersion`, `status`, `issueCount`, and issue IDs without echoing unsafe copy.

## Localization

Dashboard, remedy-plan, nudge, transit, safety, and product-guardrail payloads now include `localization`. Stable keys such as `planetKey`, `tier`, `id`, and `categoryKey` remain machine-readable, while display fields are localized from the active profile language.

Supported real-user locales in this prototype:

| Language | Locale | Status |
| --- | --- | --- |
| English | `en-IN` | Production-ready |
| Hindi | `hi-IN` | Production-ready |
| Tamil | `ta-IN` | Pilot-ready |
| Telugu | `te-IN` | Pilot-ready |

Production release still requires human linguist and clinical review for every localized safety string.
