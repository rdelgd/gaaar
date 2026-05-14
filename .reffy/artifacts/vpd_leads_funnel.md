# VDP Leads Funnel (New and Returning User Segments) - servcotoyota.com

Date range: 2026-02-14 to 2026-05-14

Source query:

```bash
node index.mjs bq --project servco-ga-prod --dataset analytics_308676209 --sql sql/servco_toyota_lead_funnels.sql --from 2026-02-14 --to 2026-05-14
```

## Sessions

| Funnel | User Type | Step 1 Sessions | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|---:|
| New VDP | New | 104,304 | 293 | 0.28% | 104,011 | 99.72% |
| New VDP | Returning | 87,479 | 571 | 0.65% | 86,908 | 99.35% |
| Used VDP | New | 36,036 | 183 | 0.51% | 35,853 | 99.49% |
| Used VDP | Returning | 37,803 | 297 | 0.79% | 37,506 | 99.21% |

## Users

| Funnel | User Type | Step 1 Users | Step 2 Completions | Completion % | Dropoff | Dropoff % |
|---|---:|---:|---:|---:|---:|---:|
| New VDP | New | 101,190 | 293 | 0.29% | 100,897 | 99.71% |
| New VDP | Returning | 32,161 | 491 | 1.53% | 31,670 | 98.47% |
| Used VDP | New | 34,401 | 183 | 0.53% | 34,218 | 99.47% |
| Used VDP | Returning | 15,223 | 276 | 1.81% | 14,947 | 98.19% |
