# Funnel Query Reflection

This artifact captures the working pattern for building GA4-to-BigQuery funnels in `gaaar`, based on the Servco Toyota VDP-to-lead funnel work.

## What worked

1. Start from the business definition of the GA4 exploration, not from a default SQL pattern.
   The biggest correction in this project was realizing the target exploration was:
   - user-based
   - closed
   - ordered
   - not constrained to the same session for later steps

   The first SQL version was session-first, which made the logic tidy but did not match the GA4 funnel closely enough.

2. Build the funnel at the user level first, then add session outputs as a secondary view.
   For each funnel:
   - identify the user's first qualifying `step_1_ts`
   - identify the user's first qualifying `step_2_ts` where `step_2_ts > step_1_ts`
   - aggregate users from that progression

   Session counts can still be included, but they should be derived from the user-based funnel definition rather than treated as the primary truth.

3. Treat each funnel step as the first qualifying timestamp at the scope that matches the business question.
   For this funnel, that meant:
   - first qualifying step 1 timestamp per user
   - first qualifying step 2 timestamp per user after step 1

   This avoids overcounting repeated activity and keeps the query aligned with "did the user progress through the funnel?" rather than "how many times did events fire?"

4. Separate step qualification from final aggregation.
   The cleanest shape was:
   - raw filtered event set
   - tagged event set with step flags
   - step 1 rows
   - step 2 candidate rows
   - per-user funnel progression
   - final aggregation by funnel and user segment

   This made validation easier and reduced logic leaks between steps.

5. Keep both session and user outputs.
   The final business comparison was centered on users because the GA4 exploration was user-based.
   Session outputs were still worth keeping because they provide an additional operational lens and can help explain repeated visitation patterns.

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

For this property, a practical export-side split was:

- `New` when `DATE(TIMESTAMP_MICROS(user_first_touch_timestamp), 'Pacific/Honolulu') = first_step_1_date`
- `Returning` otherwise

This is a transparent approximation, not a guarantee of perfect parity with GA4 UI reporting identity or audience classification.

When using this pattern in the future:
- confirm the property timezone
- keep the timezone explicit in SQL
- call out that this is export-derived segmentation
- expect some residual variance versus GA4 if the UI is using reporting identity features not present in the export logic

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

## Closed funnel guidance

For a closed funnel:
- the population begins with entities that reached step 1
- later steps only count if they occur after step 1
- users who complete step 2 without step 1 should not enter the funnel

For this project, "closed" did not mean "same session." It meant ordered progression after entry into the funnel, even if the lead happened in a later session within the analysis window.

That distinction mattered. Requiring the lead event to happen in the same session materially undercounted completions relative to the intended funnel definition.

## Validation workflow that helped

Before finalizing a funnel, run small inspection queries with `gaaar bq`:

1. Confirm the dataset date range.
2. Confirm the relevant page paths actually exist.
3. Confirm the relevant event values actually exist.
4. Confirm the field name that stores the conversion action.
5. Confirm the recent date window being tested actually has traffic.
6. Confirm whether the intended funnel is user-based or session-based.
7. Confirm whether the funnel is open or closed.
8. Confirm whether later steps must occur in the same session.

Useful examples:
- top `event_name` values
- top `page_location` values where `page_location LIKE '%express%'`
- parameter scan for `event_action` values

This is faster than debugging the whole funnel query after the fact.

Also compare the SQL output to the GA4 UI carefully:
- compare user counts to user-based explorations
- compare session counts only if the UI exploration is session-based
- check whether the exploration shows a sampling warning before assuming the UI is the source of truth

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

Another failure mode from this work:
- matching the UI loosely is not enough; the SQL can look logically sound while still disagreeing with GA4 because the scope assumptions are wrong
- "session-based by default" was the wrong assumption for this funnel
- "same-session completion" was also too restrictive for the stated business definition

## Recommended build order for future funnels

1. Write down the business definition of each step in plain language.
2. Identify whether each step is page-based, event-based, or mixed.
3. Confirm the funnel scope:
   - user-based or session-based
   - open or closed
   - same-session or cross-session step completion
4. Validate the actual export fields that represent each step.
5. Build first-occurrence timestamps at the correct scope.
6. Enforce ordering with timestamp comparison.
7. Aggregate by the reporting segments needed by stakeholders.
8. Run a live query on a recent range and inspect for plausible counts.
9. Cross-check against GA4 UI, but account for sampling before treating differences as logic bugs.
10. Only then save the SQL and artifact the results.

## Recommended artifact/output pattern

For future funnel work in this repo:
- put reusable SQL in `sql/`
- store the interpreted result table in `.reffy/artifacts/`
- include the exact `gaaar bq` command used
- include the date range
- include completion and dropoff percentages
- note the intended funnel semantics explicitly:
  - user vs session
  - open vs closed
  - same-session vs cross-session
- note whether the GA4 comparison view was sampled

This keeps the SQL reusable and the analytical result auditable.
