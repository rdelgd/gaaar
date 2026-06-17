## Context
This report uses the same GA4 BigQuery export workflow as the existing VDP funnel report, but the requested funnel is narrower: one giveaway landing page and one confirmation page in a single dataset.

### Problem Summary
- Dataset: `servco-ga-prod.analytics_313176086`.
- Step 1: page path and query string contains `/first-time-buyer-giveaway.html`.
- Step 2: page path and query string contains `/first-time-buyer-program-confirmation.html`.
- Date range: last 28 complete days, `2026-05-19` through `2026-06-15`.

## Goals / Non-Goals
- Goals:
  - Produce reusable SQL under `sql/`.
  - Produce a browser-renderable Markdown report under `reports/`.
  - Make the funnel semantics explicit in the report.
  - Keep the implementation compatible with the current `gaaar bq` command.
- Non-Goals:
  - Add a new CLI command or change `index.mjs`.
  - Add segmentation unless requested later.
  - Compare results against the GA4 UI.

## Decisions
- Decision: Use a closed same-session funnel.
  - Rationale: The brief says sessions start on the giveaway page and then complete the submission step.
- Decision: Match page steps using `page_location` from GA4 event parameters.
  - Rationale: Both funnel steps are defined as page path and query string contains rules.
- Decision: Filter by `event_date` using `@from_sfx` and `@to_sfx`.
  - Rationale: Prior project work found this more reliable with `gaaar` named parameters than `_TABLE_SUFFIX` filtering.
- Decision: Return one overall result row.
  - Rationale: The requested report is overall giveaway performance, and the user selected no New/Returning segmentation.

## Reffy Inputs
- funnel_query_reflection.md
- th_giveaway_funnel.md

## Open Questions
- None yet.
