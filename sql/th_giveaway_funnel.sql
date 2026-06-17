-- sql/th_giveaway_funnel.sql
-- TH first-time buyer giveaway funnel.
--
-- Expected named params:
--   @from_sfx, @to_sfx  (YYYYMMDD date range helpers from gaaar --from/--to)
--
-- Identifiers rendered by CLI:
--   {{project}} . {{dataset}} . events_*
--
-- Notes:
-- - This query measures a closed same-session funnel.
-- - Step 1 requires the first page_view in a session to contain the giveaway path.
-- - Step 2 requires a later page_view in the same session to contain the confirmation path.
-- - Both session and user counts are returned as one overall aggregate row.

WITH page_events AS (
  SELECT
    event_timestamp,
    user_pseudo_id,
    CAST(
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')
      AS INT64
    ) AS ga_session_id,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location
  FROM `{{project}}.{{dataset}}.events_*`
  WHERE PARSE_DATE('%Y%m%d', event_date) BETWEEN PARSE_DATE('%Y%m%d', @from_sfx)
      AND PARSE_DATE('%Y%m%d', @to_sfx)
    AND event_name = 'page_view'
),
valid_page_events AS (
  SELECT
    event_timestamp,
    user_pseudo_id,
    ga_session_id,
    CONCAT(user_pseudo_id, '.', CAST(ga_session_id AS STRING)) AS session_key,
    page_location
  FROM page_events
  WHERE user_pseudo_id IS NOT NULL
    AND ga_session_id IS NOT NULL
    AND page_location IS NOT NULL
),
session_pages AS (
  SELECT
    user_pseudo_id,
    session_key,
    ARRAY_AGG(
      STRUCT(
        event_timestamp AS event_timestamp,
        page_location AS page_location
      )
      ORDER BY event_timestamp
      LIMIT 1
    )[OFFSET(0)] AS first_page,
    ARRAY_AGG(
      STRUCT(
        event_timestamp AS event_timestamp,
        page_location AS page_location
      )
      ORDER BY event_timestamp
    ) AS pages
  FROM valid_page_events
  GROUP BY user_pseudo_id, session_key
),
funnel_sessions AS (
  SELECT
    user_pseudo_id,
    session_key,
    first_page.event_timestamp AS step_1_ts,
    (
      SELECT MIN(page.event_timestamp)
      FROM UNNEST(pages) AS page
      WHERE page.event_timestamp > first_page.event_timestamp
        AND page.page_location LIKE '%/first-time-buyer-program-confirmation.html%'
    ) AS step_2_ts
  FROM session_pages
  WHERE first_page.page_location LIKE '%/first-time-buyer-giveaway.html%'
)
SELECT
  'TH First-Time Buyer Giveaway' AS funnel,
  COUNT(*) AS step_1_sessions,
  COUNTIF(step_2_ts IS NOT NULL) AS step_2_sessions,
  COUNT(*) - COUNTIF(step_2_ts IS NOT NULL) AS step_2_session_dropoff,
  SAFE_DIVIDE(COUNTIF(step_2_ts IS NOT NULL), COUNT(*)) AS step_2_session_conversion_rate,
  COUNT(DISTINCT user_pseudo_id) AS step_1_users,
  COUNT(DISTINCT IF(step_2_ts IS NOT NULL, user_pseudo_id, NULL)) AS step_2_users,
  COUNT(DISTINCT user_pseudo_id)
    - COUNT(DISTINCT IF(step_2_ts IS NOT NULL, user_pseudo_id, NULL)) AS step_2_user_dropoff,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(step_2_ts IS NOT NULL, user_pseudo_id, NULL)),
    COUNT(DISTINCT user_pseudo_id)
  ) AS step_2_user_conversion_rate
FROM funnel_sessions;
