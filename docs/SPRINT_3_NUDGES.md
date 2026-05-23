# Sprint 3: Daily Nudges and Engagement

Sprint 3 turns the daily nudge into a measurable habit loop.

## Delivered

- Daily nudge now combines:
  - Weekday lord
  - Active hora
  - Moon nakshatra health note
  - Current Dasha modifier
  - Top transit modifier
- Doctor-review nudge appears when TIA is above 7.
- Checklist items now have stable IDs and persisted completion state.
- Engagement metrics include completion percent, streak days, and latest rating.
- Reminder preferences support time, language, detail level, channel, and enabled state.

## APIs

- `GET /api/nudges/today?userId=demo`
- `POST /api/nudges/checklist`
- `GET /api/nudges/streak?userId=demo`
- `POST /api/nudges/rate`
- `POST /api/notifications/preferences`

## Acceptance

- Nudge content is actionable and calm.
- Nudge has weekday, hora, nakshatra, Dasha and transit modules.
- Checklist completion is measurable.
- Rating feedback is captured.
- Doctor nudge appears for high TIA days.
