# Project Context

## Purpose
CLI for administrating GA4 properties, running GA4 Data API reports, and querying
GA4 BigQuery export data using an "everything-as-code" approach via JSON/SQL
specs.

## Tech Stack
- Node.js 18+ (ESM modules)
- JavaScript (single-file CLI in `index.mjs`)
- commander for CLI parsing
- Google APIs: `@google-analytics/admin`, `@google-analytics/data`,
  `@google-cloud/bigquery`
- `google-auth-library` for auth, `dotenv` for env loading

## Project Conventions

### Code Style
- ESM imports, double quotes, semicolons, 2-space indentation.
- Procedural style in a single entry file; helper functions grouped by command.
- User-facing errors print to stderr and exit with non-zero status.

### Architecture Patterns
- Single CLI entry point (`index.mjs`) with subcommands: `admin`, `reports`, `bq`.
- JSON specs drive GA4 Admin/Data API behavior; SQL templates drive BigQuery.
- Small pure helpers for formatting (CSV/NDJSON/table) and request building.

### Testing Strategy
- No automated tests currently; manual validation via CLI commands and example
  specs/SQL in `specs/` and `sql/`.

### Git Workflow
- Not specified. (Add branch/commit conventions if you have them.)

## Domain Context
- GA4 property IDs use `properties/NNN` format.
- `admin` operates on non-system channel groups and appends missing rules only.
- `reports` supports `standard`, `pivot`, and `realtime` report types from JSON.
- `bq` supports SQL templates with `{{project}}`/`{{dataset}}` and named params
  via `--param`; optional `_TABLE_SUFFIX` helpers via `--from`/`--to`.

## Important Constraints
- Requires Google Cloud credentials (`GOOGLE_APPLICATION_CREDENTIALS` or ADC).
- APIs must be enabled: GA4 Admin API, GA4 Data API, BigQuery API.
- Service account must have access to the GA4 property and BigQuery dataset.

## External Dependencies
- GA4 Admin API (channel groups, custom dimensions/metrics, ads links)
- GA4 Data API (reporting)
- BigQuery (GA4 export dataset queries)
