# Sprint 1: Onboarding and Birth Profile

Sprint 1 implements the minimum birth and constitution data required for personalization.

## Delivered

- Mobile Profile tab for name, birth date, exact birth time, birth place, timezone, ayanamsha, Lagna, Moon sign, language, and nudge time.
- Dosha questionnaire with Vata/Pitta/Kapha answers and a chart cross-check against Lagna and Moon sign.
- `GET /api/onboarding/options` for host apps to render the same onboarding experience.
- `POST /api/onboarding` and `POST /api/profile` for profile creation and update.
- `GET /api/profile/:userId` for partner-safe profile reads.
- Birth data encrypted at rest in the prototype server store with AES-256-GCM.
- Analytics identifier separated from birth data.
- Dashboard payloads now include `profileContract` and onboarding completion status.

## Profile Payload Shape

```json
{
  "schemaVersion": "profile.v1",
  "profile": {
    "id": "demo",
    "name": "Aarav Sharma",
    "birthDate": "1990-05-12",
    "birthTime": "06:42",
    "birthPlace": "Varanasi, India",
    "timezone": "Asia/Kolkata",
    "ayanamsha": "Lahiri",
    "dominantDosha": "Pitta-Vata"
  },
  "analytics": {
    "subjectId": "demo",
    "analyticsId": "an_...",
    "containsBirthData": false
  },
  "privacy": {
    "birthDataEncrypted": true,
    "analyticsIdSeparated": true
  }
}
```

The encrypted ciphertext remains server-side. Client payloads only expose the encryption status and algorithm metadata.

## Acceptance Checks

- Profile can be created through `POST /api/onboarding`.
- Profile can be read through `GET /api/profile/:userId`.
- Created profile can render in `GET /api/dashboard?userId=:userId`.
- Birth data is marked encrypted and analytics ID does not contain birth data.
- Mobile Profile tab can update birth details and dosha answers.
