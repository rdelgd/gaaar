-- sql/servco_toyota_lead_funnels.sql
-- Servco Toyota lead funnels for new vs returning users.
--
-- Expected named params:
--   @from_sfx, @to_sfx  (YYYYMMDD for _TABLE_SUFFIX range)
--
-- Identifiers rendered by CLI:
--   {{project}} . {{dataset}} . events_*
--
-- Notes:
-- - Step 1 is session-based and uses page_view + page_location path rules.
-- - Step 2 is the first qualifying lead event_action after step 1 in the same session.
-- - "New" vs "Returning" is derived from user_first_touch_timestamp relative to
--   the session date in Pacific/Honolulu. Adjust the timezone if the property differs.

WITH source_events AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    event_timestamp,
    user_pseudo_id,
    user_first_touch_timestamp,
    CAST(
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')
      AS INT64
    ) AS ga_session_id,
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_action') AS event_action
  FROM `{{project}}.{{dataset}}.events_*`
  WHERE PARSE_DATE('%Y%m%d', event_date) BETWEEN PARSE_DATE('%Y%m%d', @from_sfx)
      AND PARSE_DATE('%Y%m%d', @to_sfx)
    AND (
      event_name = 'page_view'
      OR (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'event_action') IN (
        'R-purchase-placed',
        'R-saved-express-car',
        'R-trade-estimate',
        'R-test-drive',
        'R-general-inquiry'
      )
    )
),
sessionized AS (
  SELECT
    event_date,
    event_timestamp,
    user_pseudo_id,
    user_first_touch_timestamp,
    ga_session_id,
    CONCAT(user_pseudo_id, '.', CAST(ga_session_id AS STRING)) AS session_key,
    event_name,
    page_location,
    event_action
  FROM source_events
  WHERE ga_session_id IS NOT NULL
),
step_1_sessions AS (
  SELECT
    session_key,
    user_pseudo_id,
    ga_session_id,
    DATE(TIMESTAMP_MICROS(MIN(event_timestamp)), 'Pacific/Honolulu') AS session_date,
    DATE(TIMESTAMP_MICROS(ANY_VALUE(user_first_touch_timestamp)), 'Pacific/Honolulu') AS first_touch_date,
    MIN(
      IF(
        event_name = 'page_view'
        AND page_location LIKE '%/express/%'
        AND page_location NOT LIKE '%/express/used%',
        event_timestamp,
        NULL
      )
    ) AS new_vdp_step_1_ts,
    MIN(
      IF(
        event_name = 'page_view'
        AND page_location LIKE '%/express/used%',
        event_timestamp,
        NULL
      )
    ) AS used_vdp_step_1_ts
  FROM sessionized
  GROUP BY session_key, user_pseudo_id, ga_session_id
),
step_2_sessions AS (
  SELECT
    s.session_key,
    MIN(
      IF(
        e.event_action IN (
          'R-purchase-placed',
          'R-saved-express-car',
          'R-trade-estimate',
          'R-test-drive',
          'R-general-inquiry'
        )
        AND s.new_vdp_step_1_ts IS NOT NULL
        AND e.event_timestamp > s.new_vdp_step_1_ts,
        e.event_timestamp,
        NULL
      )
    ) AS new_vdp_step_2_ts,
    MIN(
      IF(
        e.event_action IN (
          'R-purchase-placed',
          'R-saved-express-car',
          'R-trade-estimate',
          'R-test-drive',
          'R-general-inquiry'
        )
        AND s.used_vdp_step_1_ts IS NOT NULL
        AND e.event_timestamp > s.used_vdp_step_1_ts,
        e.event_timestamp,
        NULL
      )
    ) AS used_vdp_step_2_ts
  FROM step_1_sessions s
  JOIN sessionized e
    ON e.session_key = s.session_key
  GROUP BY s.session_key
),
session_progress AS (
  SELECT
    s.session_key,
    s.user_pseudo_id,
    s.session_date,
    CASE
      WHEN s.first_touch_date = s.session_date THEN 'New'
      ELSE 'Returning'
    END AS user_type,
    s.new_vdp_step_1_ts,
    t.new_vdp_step_2_ts,
    s.used_vdp_step_1_ts,
    t.used_vdp_step_2_ts
  FROM step_1_sessions s
  JOIN step_2_sessions t
    ON t.session_key = s.session_key
),
funnel_rows AS (
  SELECT
    'new_vdp' AS funnel_key,
    'New VDP page funnel' AS funnel_name,
    user_type,
    session_key,
    user_pseudo_id,
    new_vdp_step_1_ts AS step_1_ts,
    new_vdp_step_2_ts AS step_2_ts
  FROM session_progress
  WHERE new_vdp_step_1_ts IS NOT NULL

  UNION ALL

  SELECT
    'used_vdp' AS funnel_key,
    'Used VDP page funnel' AS funnel_name,
    user_type,
    session_key,
    user_pseudo_id,
    used_vdp_step_1_ts AS step_1_ts,
    used_vdp_step_2_ts AS step_2_ts
  FROM session_progress
  WHERE used_vdp_step_1_ts IS NOT NULL
)
SELECT
  funnel_key,
  funnel_name,
  user_type,
  COUNT(*) AS step_1_sessions,
  COUNTIF(step_2_ts IS NOT NULL) AS step_2_sessions,
  COUNT(*) - COUNTIF(step_2_ts IS NOT NULL) AS step_2_session_dropoff,
  SAFE_DIVIDE(COUNTIF(step_2_ts IS NOT NULL), COUNT(*)) AS step_2_session_conversion_rate,
  COUNT(DISTINCT user_pseudo_id) AS step_1_users,
  COUNT(DISTINCT IF(step_2_ts IS NOT NULL, user_pseudo_id, NULL)) AS step_2_users,
  COUNT(DISTINCT user_pseudo_id) - COUNT(DISTINCT IF(step_2_ts IS NOT NULL, user_pseudo_id, NULL)) AS step_2_user_dropoff,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(step_2_ts IS NOT NULL, user_pseudo_id, NULL)),
    COUNT(DISTINCT user_pseudo_id)
  ) AS step_2_user_conversion_rate
FROM funnel_rows
GROUP BY funnel_key, funnel_name, user_type
ORDER BY funnel_key, CASE user_type WHEN 'New' THEN 1 ELSE 2 END;
