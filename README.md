# Google Analytics Administration, Analysis and Reporting (`gaaar`)

CLI tool to programmatically administer GA4 properties, run custom reports, and analyze BigQuery data with an "[everything-as-code](https://mitchellh.com/writing/as-code)" approach.

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Install globally: `npm link`

Now you can use the `gaaar` command from anywhere!

## Commands

### Admin

Administer GA4 resources from a JSON spec file. 

```bash
# Show help for admin command
gaaar admin --help

# Target a specific property and spec file
gaaar admin --property properties/123456789 --spec channel_group.json

# Use short flags
gaaar admin -p properties/123456789 -s channel_group.json

# Relative path defaults to config/ directory
gaaar admin -p properties/123456789 -s channel_group_update.json

# Use environment variable
export GA4_PROPERTY_ID="properties/123456789"
gaaar admin -s channel_group.json
```

The tool will only add channels that don't already exist in your target channel group.

### Reports

Run GA4 Data API reports from JSON specifications for repeatable, version-controlled reporting.

```bash
# Show help for reports command
gaaar reports --help

# Run a report from a spec file
gaaar reports --spec weekly_kpis.json

# Relative path defaults to specs/ directory
gaaar reports -s weekly_kpis.json

# Specify property (overrides spec and env var)
gaaar reports -s weekly_kpis.json -p properties/123456789

# Output formats: table (default), csv, json, ndjson
gaaar reports -s weekly_kpis.json -f csv

# Save output to file
gaaar reports -s weekly_kpis.json -f csv -o reports/weekly_kpis.csv
```


#### Report example:

**Standard Reports** - Regular GA4 reports with dimensions and metrics
```json
{
  "reportType": "standard",
  "dimensions": ["sessionDefaultChannelGroup", "source"],
  "metrics": ["sessions", "totalUsers", "conversions"],
  "dateRanges": [{ "startDate": "7daysAgo", "endDate": "yesterday" }],
  "orderBys": [{ "metric": { "metricName": "sessions" }, "desc": true }],
  "limit": 100000
}
```

See the `specs` directory for more examples.

### BigQuery Analysis

Run SQL queries against your GA4 BigQuery export data with advanced templating and parameterization.

```bash
# Show help for bq command
gaaar bq --help

# Run a SQL file against GA4 export
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql

# Relative path defaults to sql/ directory
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql

# Use inline SQL query
gaaar bq --project my-project --dataset ga4_export --query "SELECT event_date, COUNT(*) as events FROM \`{{project}}.{{dataset}}.events_*\` WHERE _TABLE_SUFFIX BETWEEN '20240901' AND '20240930' GROUP BY event_date ORDER BY event_date"

# Add date range parameters (automatically creates @from_sfx and @to_sfx params)
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql --from 2024-09-01 --to 2024-09-30

# Add custom named parameters
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql --param needle="chatgpt" --param country="US"

# Save results to a BigQuery table
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql --dest ai_traffic_daily

# Overwrite existing table
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql --dest ai_traffic_daily --write truncate

# Dry run to estimate query cost
gaaar bq --project my-project --dataset ga4_export --sql ai_sources_daily.sql --dry-run
```

#### SQL Template Features

**Project & Dataset Substitution** - Use `{{project}}` and `{{dataset}}` placeholders in your SQL:
```sql
FROM `{{project}}.{{dataset}}.events_*`
```

**Named Parameters** - Use `@parameter_name` in SQL with `--param` flags:
```sql
WHERE _TABLE_SUFFIX BETWEEN @from_sfx AND @to_sfx
  AND LOWER(source) LIKE CONCAT('%', LOWER(@needle), '%')
```

**Date Range Automation** - `--from` and `--to` flags automatically create suffix parameters:
- `--from 2024-09-01 --to 2024-09-30` creates `@from_sfx="20240901"` and `@to_sfx="20240930"`

**Table Management Options**:
- `--write append` (default) - Add rows to existing table
- `--write truncate` - Replace all table data
- `--create ifneeded` (default) - Create table if it doesn't exist
- `--create never` - Fail if table doesn't exist

### Global Options

```bash
# Show version
gaaar --version

# Show help
gaaar --help
```

## Requirements

- Node.js 18+
- Google Cloud Platform project with the following APIs enabled:
  - Google Analytics Admin API (for `channels` command)
  - Google Analytics Data API (for `reports` command)
  - BigQuery API (for `bq` command)
- Service account with appropriate permissions
- A GA4 property with a custom channel group (for channels command)
- Access to GA4 BigQuery export dataset (for bq command)

**Important:** See the `.env.example` file for detailed instructions on how to set up the required Google Cloud Platform (GCP) configurations, including service account setup, API enablement, and authentication credentials.
