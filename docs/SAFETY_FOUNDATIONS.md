# Sprint 0 Safety Foundations

Sprint 0 converts the PRD's ethical guidelines into product, API, and QA controls that every later sprint must use.

## Active Contracts

| Contract | Version | Purpose |
| --- | --- | --- |
| API | `0.2.0-sprint0` | Partner and app payload version |
| Safety | `safety.v1` | Content rules, disclaimers, escalation, language rollout |
| HVI | `hvi.v1` | Health Vulnerability Index response shape |
| DRS | `drs.v1` | Dasha Risk Score response shape |
| TIA | `tia.v1` | Transit Impact Algorithm response shape |

## Safety Rules

- Medical care first: the app must never discourage physician care, urgent care, medication review, or mental health support.
- Tendency, not certainty: health astrology copy must describe tendencies, windows, and preparation prompts.
- Gemstone gate: gemstone guidance always requires qualified Jyotishi review and cannot be framed as treatment.
- Mental health escalation: distress copy must surface India-first professional resources: 112 for immediate danger, Tele-MANAS 14416 / 1800-89-14416, KIRAN 1800-599-0019, and iCALL +91 9152987821.
- No fear language: critical alerts need calm next steps and practical care guidance.
- Auditability: HVI, DRS, TIA, and safety payloads carry schema/policy versions.
- No morbid timing: the app must not generate mortality or terminal-timeline predictions.

## Disclaimer Placement

| Surface | Required Disclaimer |
| --- | --- |
| Daily nudge | Global medical-care disclaimer |
| Tier 1 alert | Global + high-risk alert disclaimer |
| Remedy | Complementary-practice disclaimer |
| Gemstone | Gemstone expert-review + remedy disclaimer |
| Mental health | Professional support resources + global disclaimer |
| Report | Report-context + global disclaimer |

## Escalation Rules

| Trigger | App Behavior |
| --- | --- |
| Tier 1 transit alert | Banner, push/email-ready payload, physician-care prompt |
| TIA score above 7 | Add doctor nudge and avoid definitive disease labels |
| Mental distress indicator | Show 112, Tele-MANAS, KIRAN, and iCALL resources |
| Medication or diagnostic uncertainty | Encourage clinician review or second opinion |

## Language Rollout

| Phase | Languages |
| --- | --- |
| Launch | English, Hindi |
| Next | Tamil, Telugu |
| Later | Bengali, Kannada |

Planet names, remedy names, alert copy, and disclaimers must be localized together before a language is marked production-ready.

## Implemented APIs

- `GET /api/safety`
- `GET /api/schemas`
- `POST /api/content/validate`
- All dashboard payloads include `contentSafety`, `apiVersion`, schema versions, and disclaimer metadata.

## QA Gate

Run:

```bash
node --check server.mjs
node --check public/app.js
node --check public/embed.js
node test-api.mjs
```

The smoke test verifies core APIs, safety APIs, dashboard safety status, and safe/unsafe copy validation.
