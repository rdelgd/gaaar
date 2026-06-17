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
-- - This query approximates a GA4 user-based closed funnel.
-- - Step 1 uses page_view + page_location path rules.
-- - Step 2 is the first qualifying lead event_action after step 1 anywhere in the
--   date range; it does not need to happen in the same session.
-- - Session counts are derived from the user-based progression so they can still be
--   compared alongside user counts.
-- - "New" vs "Returning" is derived from user_first_touch_timestamp relative to the
--   user's first qualifying step-1 date in Pacific/Honolulu. Adjust the timezone if
--   the property differs.

WITH source_events AS (
  SELECT
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
tagged_events AS (
  SELECT
    event_timestamp,
    user_pseudo_id,
    user_first_touch_timestamp,
    ga_session_id,
    CONCAT(user_pseudo_id, '.', CAST(ga_session_id AS STRING)) AS session_key,
    DATE(TIMESTAMP_MICROS(user_first_touch_timestamp), 'Pacific/Honolulu') AS first_touch_date,
    event_name,
    page_location,
    event_action,
    event_name = 'page_view'
      AND page_location LIKE '%/express/%'
      AND page_location NOT LIKE '%/express/used%' AS is_new_vdp_step_1,
    event_name = 'page_view'
      AND page_location LIKE '%/express/used%' AS is_used_vdp_step_1,
    event_action IN (
      'R-purchase-placed',
      'R-saved-express-car',
      'R-trade-estimate',
      'R-test-drive',
      'R-general-inquiry'
    ) AS is_lead_step_2
  FROM source_events
  WHERE ga_session_id IS NOT NULL
),
step_1_events AS (
  SELECT
    'new_vdp' AS funnel_key,
    'New VDP page funnel' AS funnel_name,
    user_pseudo_id,
    session_key,
    first_touch_date,
    event_timestamp AS step_1_ts
  FROM tagged_events
  WHERE is_new_vdp_step_1

  UNION ALL

  SELECT
    'used_vdp' AS funnel_key,
    'Used VDP page funnel' AS funnel_name,
    user_pseudo_id,
    session_key,
    first_touch_date,
    event_timestamp AS step_1_ts
  FROM tagged_events
  WHERE is_used_vdp_step_1
),
lead_events AS (
  SELECT
    user_pseudo_id,
    session_key,
    event_timestamp AS step_2_ts
  FROM tagged_events
  WHERE is_lead_step_2
),
funnel_users AS (
  SELECT
    funnel_key,
    funnel_name,
    user_pseudo_id,
    MIN(step_1_ts) AS first_step_1_ts,
    ANY_VALUE(first_touch_date) AS first_touch_date,
    CASE
      WHEN ANY_VALUE(first_touch_date) = DATE(TIMESTAMP_MICROS(MIN(step_1_ts)), 'Pacific/Honolulu') THEN 'New'
      ELSE 'Returning'
    END AS user_type,
    COUNT(DISTINCT session_key) AS step_1_sessions
  FROM step_1_events
  GROUP BY funnel_key, funnel_name, user_pseudo_id
),
funnel_step_2 AS (
  SELECT
    u.funnel_key,
    u.funnel_name,
    u.user_pseudo_id,
    u.user_type,
    MIN(l.step_2_ts) AS first_step_2_ts,
    COUNT(DISTINCT l.session_key) AS step_2_sessions
  FROM funnel_users u
  LEFT JOIN lead_events l
    ON l.user_pseudo_id = u.user_pseudo_id
   AND l.step_2_ts > u.first_step_1_ts
  GROUP BY u.funnel_key, u.funnel_name, u.user_pseudo_id, u.user_type
)
SELECT
  u.funnel_key,
  u.funnel_name,
  u.user_type,
  SUM(u.step_1_sessions) AS step_1_sessions,
  SUM(IF(s.first_step_2_ts IS NOT NULL, s.step_2_sessions, 0)) AS step_2_sessions,
  SUM(u.step_1_sessions) - SUM(IF(s.first_step_2_ts IS NOT NULL, s.step_2_sessions, 0)) AS step_2_session_dropoff,
  SAFE_DIVIDE(
    SUM(IF(s.first_step_2_ts IS NOT NULL, s.step_2_sessions, 0)),
    SUM(u.step_1_sessions)
  ) AS step_2_session_conversion_rate,
  COUNT(*) AS step_1_users,
  COUNTIF(s.first_step_2_ts IS NOT NULL) AS step_2_users,
  COUNT(*) - COUNTIF(s.first_step_2_ts IS NOT NULL) AS step_2_user_dropoff,
  SAFE_DIVIDE(
    COUNTIF(s.first_step_2_ts IS NOT NULL),
    COUNT(*)
  ) AS step_2_user_conversion_rate
FROM funnel_users u
LEFT JOIN funnel_step_2 s
  ON s.funnel_key = u.funnel_key
 AND s.user_pseudo_id = u.user_pseudo_id
GROUP BY u.funnel_key, u.funnel_name, u.user_type
ORDER BY u.funnel_key, CASE u.user_type WHEN 'New' THEN 1 ELSE 2 END;
