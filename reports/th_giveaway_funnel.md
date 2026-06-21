# TH First-Time Buyer Giveaway Funnel

Date range: 2026-05-21 to 2026-06-17

Source query:

```bash
node index.mjs bq --project servco-ga-prod --dataset analytics_313176086 --sql th_giveaway_funnel.sql --from 2026-05-21 --to 2026-06-17
```

## Sessions

| Funnel | Step 1 Sessions | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|
| TH First-Time Buyer Giveaway | 11,399 | 2,182 | 19.14% | 9,217 | 80.86% |

## Users

| Funnel | Step 1 Users | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|
| TH First-Time Buyer Giveaway | 10,371 | 2,161 | 20.84% | 8,210 | 79.16% |

## Funnel Semantics

- Closed same-session funnel.
- Step 1 counts sessions where the first page view contains `/first-time-buyer-giveaway.html`.
- Step 2 counts a later page view in the same session containing `/first-time-buyer-program-confirmation.html`.
- Sessions that reach the confirmation page without starting on the giveaway landing page are excluded.

## Summary

- 2,182 of 11,399 qualifying giveaway landing sessions reached the confirmation page in the same session.
- The user completion rate is slightly higher than the session completion rate, indicating some users had multiple qualifying landing sessions.
