```sql
WITH data AS (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS starting_point,

    LEAD((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), 1)
      OVER session AS step_1,

    LEAD((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), 2)
      OVER session AS step_2,

    LEAD((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), 3)
      OVER session AS step_3
  FROM `<your-gcp-project>.<your-dataset>.events_*`
  WHERE event_name = 'page_view'
  WINDOW session AS (
    PARTITION BY
      user_pseudo_id,
      (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')
    ORDER BY event_timestamp ASC
  )
)
SELECT
  starting_point, step_1, step_2, step_3,
  COUNT(*) AS n
FROM data
WHERE starting_point = 'https://shop.googlemerchandisestore.com/asearch.html'
GROUP BY starting_point, step_1, step_2, step_3
ORDER BY n DESC;
```

cool. This path exploration code seems equivalent to a funnel exploration's code, except, of course, we'd be interested in the "users" per step of the funnel

Yep — they’re the same family of analysis, but they answer slightly different questions:

Path exploration: “What pages happened next?” (many possible next steps, branching)

Funnel: “How many users progressed through these specific steps?” (one defined sequence)

To make your query behave more like a funnel, you typically change two things:

Replace the branching step_1/2/3 outputs with boolean “did they hit step N?” checks for a defined set of step pages/events.

Count distinct users (or sessions) at each step, not just rows.

How to think about “users per step”

A funnel metric is usually one of these (pick based on your intended meaning):

Users per step: COUNT(DISTINCT user_pseudo_id)

Sessions per step: COUNT(DISTINCT CONCAT(user_pseudo_id, ga_session_id)) (or a struct)

Conversions per step: depends on event model

In GA4 BigQuery exports, funnels are often better measured at the session level if you care about ordering within a session (which funnels usually do).

Mapping your current approach to funnel counts

Your current query produces sequences like:

starting_point

step_1

step_2

step_3

That’s great for “what happens next,” but not great for “how many users reached step 2,” because:

A user can appear in multiple rows (multiple pageviews)

COUNT(*) is counting occurrences of that starting pageview, not unique users/sessions

To turn it into funnel counts, you’d build something like:

Step 0: started at X

Step 1: reached Y after X (at any later timestamp in same session)

Step 2: reached Z after Y

etc.

Then compute:

users_step0, users_step1, users_step2, …

The key trick: “first time they hit each step” in a session

In GA4 BigQuery, a common pattern is:

Filter to relevant events (page_view or specific events)

For each session, compute the timestamp of the first occurrence of each funnel step

A session “reached step N” if stepN_ts IS NOT NULL

A session “reached step N in order” if stepN_ts > step(N-1)_ts

That gives you clean funnel progression.

Example shape (no need to copy/paste yet)

Conceptually:

session_id = (user_pseudo_id, ga_session_id)

step0_ts = MIN(timestamp where page_location = start)

step1_ts = MIN(timestamp where page_location = step1 and timestamp > step0_ts)

step2_ts = MIN(timestamp where page_location = step2 and timestamp > step1_ts)

Then counts:

users at step0 = distinct users where step0_ts not null

users at step1 = distinct users where step1_ts not null

users at step2 = distinct users where step2_ts not null

One nuance: funnels don’t have to be page paths

Your path query is page-based. Funnel steps can be:

specific pages (page_location)

specific events (event_name)

a mix (e.g., page then purchase)

Same mechanics either way—just change what qualifies a step.

---

If you tell me your funnel steps (e.g., Start page → PDP → Cart → Checkout → Purchase), I can rewrite your query into a funnel-style query that returns distinct users per step (and optionally sessions), with ordering enforced.
