# TH First-Time Buyer Giveaway Funnel

Date range: 2026-05-19 to 2026-06-15

Source query:

```bash
node index.mjs bq --project servco-ga-prod --dataset analytics_313176086 --sql th_giveaway_funnel.sql --from 2026-05-19 --to 2026-06-15
```

## Sessions

| Funnel | Step 1 Sessions | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|
| TH First-Time Buyer Giveaway | 10,531 | 2,119 | 20.12% | 8,412 | 79.88% |

## Users

| Funnel | Step 1 Users | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|
| TH First-Time Buyer Giveaway | 9,608 | 2,099 | 21.85% | 7,509 | 78.15% |

## Funnel Semantics

- Closed same-session funnel.
- Step 1 counts sessions where the first page view contains `/first-time-buyer-giveaway.html`.
- Step 2 counts a later page view in the same session containing `/first-time-buyer-program-confirmation.html`.
- Sessions that reach the confirmation page without starting on the giveaway landing page are excluded.

## Summary

- 2,119 of 10,531 qualifying giveaway landing sessions reached the confirmation page in the same session.
- The user completion rate is slightly higher than the session completion rate, indicating some users had multiple qualifying landing sessions.
