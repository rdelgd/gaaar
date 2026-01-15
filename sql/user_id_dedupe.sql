-- The effective_user_id is calculated using a window function that partitions the data by a combination of user_pseudo_id and session_id. The ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING ensures that the FIRST_VALUE window function captures the first non-null user_id from the current row onward within the partition. This logic stops populating effective_user_id with the user_id once the user logs out because, after the logout event, the subsequent rows no longer have a valid user_id within the remaining partition, causing the COALESCE function to revert to user_pseudo_id, effectively resetting the default cookie-based identifier for the rest of the session.


-- Add temporary function to easily access ga4EventParams
SELECT
  event_timestamp,
  event_name,
  user_id,
  user_pseudo_id,
  COALESCE( FIRST_VALUE(user_id IGNORE NULLS) OVER (PARTITION BY CONCAT(user_pseudo_id, ga4EventParams('ga_session_id', event_params).value)
    ORDER BY
      event_timestamp ROWS BETWEEN CURRENT ROW
      AND UNBOUNDED FOLLOWING), user_pseudo_id) AS effective_user_id,
  ga4EventParams('ga_session_id',
    event_params).value AS raw_session_id,
  CONCAT( COALESCE( FIRST_VALUE(user_id IGNORE NULLS) OVER (PARTITION BY CONCAT(user_pseudo_id, ga4EventParams('ga_session_id', event_params).value)
      ORDER BY
        event_timestamp ROWS BETWEEN CURRENT ROW
        AND UNBOUNDED FOLLOWING), user_pseudo_id ), ga4EventParams('ga_session_id',
      event_params).value ) AS effective_session_id
FROM
  `<your-project-id>.analytics_<your-property-id>.events_*`
WHERE
  _TABLE_SUFFIX BETWEEN '<your-start-date>'
  AND '<your-end-date>'
  AND user_pseudo_id = '2030451950.1721832151' -- select a specific user for testing
ORDER BY
  event_timestamp ASC
