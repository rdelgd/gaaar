# Servco Toyota Lead Funnels - spec

--project "servco-ga-prod"
--dataset "analytics_313176086"

We need to write BigQuery SQL to create a submissions funnel for the giveaway page performance.

## Here's what we need: 

- The funnels should measure dropoff users who complete step_1 (Viewed Giveaway Landing Page) start sessions on the Giveaway page, then complete a step_2 (submission event). 

## Here's some more specific GA4 funnel logic: 

## Give away page funnel: 

step_1:
Page path + query string CONTAINS "/first-time-buyer-giveaway.html"

step_2:
Page path + query string CONTAINS "/first-time-buyer-program-confirmation.html"

