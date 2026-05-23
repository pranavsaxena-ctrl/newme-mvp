# Localization Readiness

## Scope

This pass prepares the prototype for real users by localizing the health-critical copy that users act on:

- Planetary names
- Transit alerts
- Daily nudges
- Remedy names, cadence, details, and safety copy
- Product guardrails and pincode-dependent SLA copy
- Global, high-risk, remedy, gemstone, mental-health, and report disclaimers

## Supported Locales

| Language | Locale | Status |
| --- | --- | --- |
| English | `en-IN` | Production-ready |
| Hindi | `hi-IN` | Production-ready |
| Tamil | `ta-IN` | Pilot-ready |
| Telugu | `te-IN` | Pilot-ready |

## Contract Rules

- Machine keys remain stable: `planetKey`, `tier`, `categoryKey`, `id`, and `schemaVersion`.
- Display fields localize based on profile language.
- `/api/localization?language=Hindi` returns a standalone localization envelope for host apps.
- Dashboard, remedies, safety, and Health Kundli payloads include `localization`.

## Safety Notes

Localized medical safety copy still needs human linguist and clinical review before production release.

Mental-health escalation copy now uses current India-first resources:

- Emergency danger: `112`
- Tele-MANAS: `14416` / `1800-89-14416`
- KIRAN: `1800-599-0019`
- iCALL: `+91 9152987821`
