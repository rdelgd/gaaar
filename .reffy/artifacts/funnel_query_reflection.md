# Funnel Query Reflection

This artifact captures the working pattern for building GA4-to-BigQuery funnels in `gaaar`, based on the Servco Toyota VDP-to-lead funnel work.

## What worked

1. Build funnels at the session level first.
   Funnels are about ordered progression. In GA4 export data, that is usually most defensible when the unit is a session, not raw events. Use:
   - `user_pseudo_id`
   - `ga_session_id`
   - a derived `session_key = CONCAT(user_pseudo_id, '.', ga_session_id)`

2. Treat each funnel step as the first qualifying timestamp in a session.
   For each session, calculate:
   - `step_1_ts = MIN(...)`
   - `step_2_ts = MIN(...)`
   - and require `step_2_ts > step_1_ts`

   This avoids overcounting repeated events and keeps the funnel logic aligned with “did the session progress?” rather than “how many times did the event fire?”

3. Separate step qualification from final aggregation.
   The cleanest shape was:
   - raw filtered event set
   - sessionized event set
   - step 1 timestamps by session
   - step 2 timestamps by session after step 1
   - final aggregation by funnel and user segment

   This made validation easier and reduced logic leaks between steps.

4. Keep both session and user outputs.
   Session counts reflect funnel progression best.
   Distinct-user counts are still useful because stakeholders often ask for “users per step.”

   Final output should usually include:
   - `step_1_sessions`
   - `step_2_sessions`
   - `step_2_session_dropoff`
   - `step_2_session_conversion_rate`
   - `step_1_users`
   - `step_2_users`
   - `step_2_user_dropoff`
   - `step_2_user_conversion_rate`

## How to segment New vs Returning

For this property, a practical user-scoped split was:

- `New` when `DATE(TIMESTAMP_MICROS(user_first_touch_timestamp), 'Pacific/Honolulu') = session_date`
- `Returning` otherwise

This is not exactly the GA4 UI’s internal reporting logic in every edge case, but it is a transparent and defensible export-side approximation.

When using this pattern in the future:
- confirm the property timezone
- keep the timezone explicit in SQL
- call out that this is export-derived segmentation

## How to define steps

### Page steps

For page-based steps, use `event_name = 'page_view'` and evaluate `page_location` from `event_params`.

Example pattern:

```sql
MIN(
  IF(
    event_name = 'page_view'
    AND page_location LIKE '%/express/%'
    AND page_location NOT LIKE '%/express/used%',
    event_timestamp,
    NULL
  )
) AS step_1_ts
```

### Lead or conversion steps

For conversion-like steps, first verify whether the value lives in:
- `event_name`
- `event_action`
- another event parameter

In this project, the lead actions were stored in `event_params.key = 'event_action'`, not as `event_name`.

That validation step mattered. Assuming the wrong field would have produced a formally valid query with misleading zeroes.

## Validation workflow that helped

Before finalizing a funnel, run small inspection queries with `gaaar bq`:

1. Confirm the dataset date range.
2. Confirm the relevant page paths actually exist.
3. Confirm the relevant event values actually exist.
4. Confirm the field name that stores the conversion action.
5. Confirm the recent date window being tested actually has traffic.

Useful examples:
- top `event_name` values
- top `page_location` values where `page_location LIKE '%express%'`
- parameter scan for `event_action` values

This is faster than debugging the whole funnel query after the fact.

## Failure mode to remember

The first version used:

```sql
WHERE _TABLE_SUFFIX BETWEEN @from_sfx AND @to_sfx
```

That compiled, but in this setup the parameterized suffix filter produced empty results during validation. Replacing it with an `event_date` filter fixed the issue:

```sql
WHERE PARSE_DATE('%Y%m%d', event_date) BETWEEN PARSE_DATE('%Y%m%d', @from_sfx)
    AND PARSE_DATE('%Y%m%d', @to_sfx)
```

Future guidance:
- prefer `event_date` filtering when using `gaaar` named params unless there is a clear reason to rely on `_TABLE_SUFFIX`
- dry run is not enough; also execute against a known-active date range

## Recommended build order for future funnels

1. Write down the business definition of each step in plain language.
2. Identify whether each step is page-based, event-based, or mixed.
3. Validate the actual export fields that represent each step.
4. Build session-level step timestamps.
5. Enforce ordering with timestamp comparison.
6. Aggregate by the reporting segments needed by stakeholders.
7. Run a live query on a recent range and inspect for plausible counts.
8. Only then save the SQL and artifact the results.

## Recommended artifact/output pattern

For future funnel work in this repo:
- put reusable SQL in `sql/`
- store the interpreted result table in `.reffy/artifacts/`
- include the exact `gaaar bq` command used
- include the date range
- include completion and dropoff percentages

This keeps the SQL reusable and the analytical result auditable.
