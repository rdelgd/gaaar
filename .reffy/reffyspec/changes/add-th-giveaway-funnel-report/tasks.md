## 1. Implementation
- [x] 1.1 Add `sql/th_giveaway_funnel.sql`.
- [x] 1.2 Read GA4 `page_view` events from `{{project}}.{{dataset}}.events_*` using `event_date` filtered by `@from_sfx` and `@to_sfx`.
- [x] 1.3 Build session rows keyed by `user_pseudo_id` and `ga_session_id`, excluding rows with missing session identifiers.
- [x] 1.4 Count step 1 sessions where the first page view contains `/first-time-buyer-giveaway.html`.
- [x] 1.5 Count step 2 sessions where a later page view in the same session contains `/first-time-buyer-program-confirmation.html`.
- [x] 1.6 Return one overall row with step counts, completion rates, dropoff counts, and dropoff rates for sessions and users.
- [x] 1.7 Add `reports/th_giveaway_funnel.md` with the date range, source command, result table, and funnel semantics notes.

## 2. Verification
- [x] 2.1 Run `node index.mjs bq --project servco-ga-prod --dataset analytics_313176086 --sql th_giveaway_funnel.sql --from 2026-05-19 --to 2026-06-15 --dry-run`.
- [x] 2.2 Run the same `gaaar bq` command without `--dry-run` and confirm one aggregate row is returned.
- [x] 2.3 Confirm `step_2_sessions <= step_1_sessions` and `step_2_users <= step_1_users`.
- [x] 2.4 Start `gaaar serve` and confirm `reports/th_giveaway_funnel.md` is listed and renders.
- [x] 2.5 Run `reffy plan validate add-th-giveaway-funnel-report`.
