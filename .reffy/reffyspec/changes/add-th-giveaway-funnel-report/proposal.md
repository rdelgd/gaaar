# Change: Add TH Giveaway Funnel Report

## Why
The Reffy artifact `th_giveaway_funnel.md` defines a GA4 BigQuery dataset and a two-step first-time buyer giveaway funnel, but the repo does not yet have executable SQL or a rendered report that can be reviewed through `gaaar serve`.

This report should follow the existing analytics-as-code workflow: keep the query in `sql/`, run it through the `gaaar bq` command, and save the interpreted result in `reports/` for local browser review.

## What Changes
- Add a reusable BigQuery SQL file for the TH first-time buyer giveaway funnel.
- Query `servco-ga-prod.analytics_313176086` for the last 28 complete days, `2026-05-19` through `2026-06-15`.
- Model the funnel as closed and same-session:
  - Step 1 is a session whose first page view contains `/first-time-buyer-giveaway.html`.
  - Step 2 is a later page view in that same session containing `/first-time-buyer-program-confirmation.html`.
- Add a completed Markdown report at `reports/th_giveaway_funnel.md` with the source command, result table, and funnel semantics notes.

## Impact
- Affected specs: `th-giveaway-funnel-report`
- Affected code: new SQL and report artifacts only; no CLI behavior changes are required.
- BigQuery credentials and dataset access are required to execute the query.
- The generated report is a point-in-time analysis for the selected date range.

## Reffy References
- `th_giveaway_funnel.md` - source dataset and funnel step definitions.
- `funnel_query_reflection.md` - GA4 BigQuery funnel modeling and validation conventions.
