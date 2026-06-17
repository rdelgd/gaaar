# th-giveaway-funnel-report Specification

## Purpose
TBD - created by archiving change add-th-giveaway-funnel-report. Update Purpose after archive.

## Requirements
### Requirement: TH Giveaway Funnel SQL

The repo MUST include reusable BigQuery SQL for calculating the TH first-time buyer giveaway funnel from the GA4 BigQuery export.

#### Scenario: Run giveaway funnel query
- Given the user runs the giveaway funnel SQL through `gaaar bq`
- And the project is `servco-ga-prod`
- And the dataset is `analytics_313176086`
- And the date range is `2026-05-19` through `2026-06-15`
- When the query completes
- Then it returns one overall funnel result row
- And the row includes step 1 sessions, step 2 sessions, session completion rate, session dropoff, and session dropoff rate
- And the row includes step 1 users, step 2 users, user completion rate, user dropoff, and user dropoff rate
### Requirement: Same-Session Closed Funnel Semantics

The giveaway funnel MUST count only sessions that start on the giveaway landing page and later reach the confirmation page in the same session.

#### Scenario: Exclude confirmation without giveaway landing start
- Given a session reaches `/first-time-buyer-program-confirmation.html`
- But the first page view in that session does not contain `/first-time-buyer-giveaway.html`
- When the funnel query runs
- Then that session is excluded from the funnel

#### Scenario: Count confirmation after giveaway landing start
- Given a session's first page view contains `/first-time-buyer-giveaway.html`
- And a later page view in the same session contains `/first-time-buyer-program-confirmation.html`
- When the funnel query runs
- Then that session is counted as completing step 2
### Requirement: Rendered Giveaway Funnel Report

The repo MUST include a Markdown report under `reports/` for browser review through `gaaar serve`.

#### Scenario: Review report locally
- Given `reports/th_giveaway_funnel.md` exists
- When the user runs `gaaar serve`
- Then the report is listed in the local report index
- And opening it renders the source command, funnel table, and funnel semantics notes
