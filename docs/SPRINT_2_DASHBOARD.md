# Sprint 2: MVP Health Dashboard

Sprint 2 makes the first screen useful in under 30 seconds: users can see their current health signal, why it is elevated, which transit matters, and what preparation window is next.

## Delivered

- HVI component breakdown with score, max weight, tone, and plain-language insight.
- Current Dasha-Antardasha card with DRS, period label, and health domain.
- Top 3 active transit alerts with tiered priority.
- 3-month Critical Health Window calendar combining Dasha and Gochara events.
- Dashboard summary contract for native, web, and embedded clients.

## APIs

- `GET /api/dashboard-summary?userId=demo`
- `GET /api/critical-windows?userId=demo`
- Existing `GET /api/dashboard?userId=demo` now includes:
  - `dashboardSummary`
  - `criticalWindows`
  - richer `hvi.breakdown`
  - `hvi.topDrivers`
  - `dasha.currentPeriod`
  - `dasha.healthDomain`

## Acceptance

The `dashboardSummary.acceptance` object reports:

- `hviBreakdown`
- `dashaDisplay`
- `topThreeTransits`
- `criticalWindowCalendar`

All must be true for Sprint 2 to pass.
