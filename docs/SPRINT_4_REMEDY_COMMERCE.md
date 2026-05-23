# Sprint 4 Remedy Commerce

## Scope

Sprint 4 adds a safe 90-day remedy plan and a PharmEasy search-backed recommendation layer that can be embedded into another app.

## Shipped

- `GET /api/remedies/plan?userId=demo`
  - 90-day plan envelope, phases, adherence summary, remedy list, product policy, safety rules, and report links.
- `GET /api/remedies/products?userId=demo`
  - Product-only feed for host commerce surfaces.
- `GET /api/reports/remedy-plan?userId=demo`
  - PDF-ready JSON report payload for the remedy plan.
- `GET /api/reports/physician-summary?userId=demo`
  - Compact product guardrail report for clinician review.
- Remedies tab UI now shows:
  - 90-day summary.
  - price last checked date.
  - pincode-dependent SLA.
  - PharmEasy product source link.
  - supplement/ritual guardrails.
  - gemstone safety gate.

## PharmEasy Recommendation Policy

Prices are search-derived references, not checkout guarantees. Partner apps must refresh price, stock, available substitutes, pincode delivery ETA, and warnings before showing a buy action.

Gemstone remedies are intentionally blocked from product recommendation. The app returns a safety-gated recommendation object instead of a purchasable product because gemstone selection needs a qualified Jyotishi review.

## Acceptance

- Every remedy has a `productRecommendation`.
- Every recommendation has `price`, `sourceUrl`, `priceLastChecked`, and `sla`.
- SLA is explicitly pincode-dependent.
- Gemstone recommendation is blocked until expert review.
- Remedy check-in returns an updated 90-day plan.
