# VDP Leads Funnel (New and Returning User Segments) - servcotoyota.com

Date range: 2026-02-14 to 2026-05-14

Source query:

```bash
node index.mjs bq --project servco-ga-prod --dataset analytics_308676209 --sql sql/servco_toyota_lead_funnels.sql --from 2026-02-14 --to 2026-05-14
```

## Sessions

| Funnel | User Type | Step 1 Sessions | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|---:|
| New VDP | New | 127,621 | 553 | 0.43% | 127,068 | 99.57% |
| New VDP | Returning | 66,819 | 496 | 0.74% | 66,323 | 99.26% |
| Used VDP | New | 46,443 | 324 | 0.70% | 46,119 | 99.30% |
| Used VDP | Returning | 28,284 | 311 | 1.10% | 27,973 | 98.90% |

## Users

| Funnel | User Type | Step 1 Users | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|---:|
| New VDP | New | 98,371 | 504 | 0.51% | 97,867 | 99.49% |
| New VDP | Returning | 26,151 | 422 | 1.61% | 25,729 | 98.39% |
| Used VDP | New | 32,519 | 304 | 0.93% | 32,215 | 99.07% |
| Used VDP | Returning | 12,737 | 268 | 2.10% | 12,469 | 97.90% |

## Summary Analysis

- Returning users materially outperform new users: 1.61% vs. 0.51% on New VDPs and 2.10% vs. 0.93% on Used VDPs.
- New VDP / New is the largest audience segment at 98,371 users and 504 leads, but it is also the least efficient.
- Used VDP traffic is smaller, but it converts more efficiently across both user types, indicating stronger purchase intent.
- Used VDP / Returning is the strongest segment in the funnel at 2.10%, making repeat used-vehicle shoppers a high-value audience.
- The clearest opportunity is improving lead capture on high-volume first-time New VDP traffic while continuing to retarget and nurture returning visitors.
