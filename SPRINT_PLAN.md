# Jyotish Arogya Sprint Plan

Small, chunked plan for taking the PRD from prototype to MVP.

## Sprint 0: Product Safety and Foundations

Goal: Lock the ethical and medical-safety guardrails before scaling features.

- Convert PRD safety principles into content rules, escalation rules, and QA checks.
- Define HVI, DRS, TIA response schemas and versioning.
- Set disclaimer placement rules for every nudge, alert, report, and remedy.
- Decide language rollout order: English + Hindi first, then Tamil, Telugu, Bengali, Kannada.
- Acceptance: all health content has "tendency, not diagnosis" framing and no death/terminal prediction paths.

## Sprint 1: Onboarding and Birth Profile

Goal: Collect the minimum birth and constitution data required for personalization.

- Build date, exact time, place, timezone, and Lahiri ayanamsha capture.
- Add dosha self-assessment cross-check.
- Store birth data encrypted and separated from analytics identifiers.
- Return a profile payload usable by native app, web app, and embedded widget.
- Acceptance: profile can be created, read, updated, and rendered in the app shell.

## Sprint 2: MVP Health Dashboard

Goal: Make the first useful daily experience.

- Implement HVI component breakdown.
- Show current Dasha-Antardasha and DRS indicator.
- Display top 3 transit alerts with tiered severity.
- Add upcoming Critical Health Windows calendar.
- Acceptance: user can understand today's health signal in under 30 seconds.

## Sprint 3: Daily Nudges and Engagement

Goal: Build the 5:30 AM habit loop.

- Generate weekday, hora, nakshatra, Dasha, and transit-informed nudge.
- Add checklist completion, streaks, ratings, and reminder preference APIs.
- Include doctor nudge when TIA is high.
- Acceptance: nudge content is actionable, calm, non-fearful, and measurable.

## Sprint 4: Remedy Plans and Reports

Goal: Turn insight into safe action.

- Create 90-day remedy plan with mantra, diet, lifestyle, dana, and expert-review categories.
- Gate gemstones behind expert-consult disclaimers.
- Generate constitution and physician-summary report metadata, then PDF service.
- Acceptance: every remedy has safety copy and completion tracking.

## Sprint 5: Embed SDK and Partner APIs

Goal: Make Jyotish Arogya portable inside another app.

- Ship custom element, JS mount API, CORS, and OpenAPI docs.
- Add host app theming and compact mode.
- Add auth handoff for partner apps.
- Acceptance: host app can embed the widget with one script and one element.

## Sprint 6: Localization and Observability

Goal: Prepare for real users.

- Localize planetary names, remedies, safety copy, and alerts.
- Add event telemetry for nudge views, action completion, alert opens, and report generation.
- Add uptime, latency, and queue monitoring for time-critical health alerts.
- Acceptance: 99.9% alert SLA target has operational dashboards and test coverage.
