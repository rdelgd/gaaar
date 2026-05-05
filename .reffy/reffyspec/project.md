# Project Context

## Purpose
`gaaar` is a small Node.js CLI for working with Google Analytics 4 and GA4
BigQuery exports. It treats operational analytics work as code:

- `admin` manages GA4 property resources from JSON specs.
- `reports` runs GA4 Data API reports from JSON specs.
- `bq` runs parameterized BigQuery SQL, optionally materializing results to a
  destination table.

The current implementation is intentionally lightweight and centered around a
single entry file, `index.mjs`.

## Tech Stack
- Node.js with ESM modules (`"type": "module"` in `package.json`)
- JavaScript, primarily in a single source file: `index.mjs`
- CLI framework: `commander`
- Environment loading: `dotenv/config`
- Google auth: `google-auth-library`
- Google Analytics Admin API client: `@google-analytics/admin`
- Google Analytics Data API client: `@google-analytics/data`
- BigQuery client: `@google-cloud/bigquery`
- JSON spec files under `specs/`
- SQL files under `sql/`

## Project Conventions

### Code Style
- ESM imports, double quotes, semicolons, 2-space indentation.
- Procedural style in a single entry file; helper functions are grouped by
  subcommand.
- Minimal abstraction. The code favors straightforward command handlers and
  small helper functions over class-based structure.
- User-facing failures print to stderr with `console.error(...)` and exit
  non-zero via `process.exit(1)`.
- Human-readable CLI output is preferred for interactive use: ASCII tables for
  previews/listing, with JSON/CSV/NDJSON available where appropriate.

### Architecture Patterns
- Single CLI entry point (`index.mjs`) with three top-level subcommands:
  `admin`, `reports`, and `bq`.
- Spec-driven architecture:
  - JSON specs define GA4 Admin operations and GA4 Data API report requests.
  - SQL files define BigQuery queries, with simple token replacement for
    `{{project}}` and `{{dataset}}`.
- Path resolution follows a fallback convention:
  - `admin` specs resolve relative paths against `config/`
  - `reports` specs resolve relative paths against `specs/`
  - `bq` SQL files resolve relative paths against `sql/`
- Output formatting is handled by small local helpers such as CSV escaping,
  ASCII table printing, and file/stdout routing.
- `reports` standard reports paginate through GA4 Data API results and combine
  all pages before formatting output.
- `bq` builds named query parameters from CLI flags, including `from_sfx` and
  `to_sfx` helpers derived from `--from` and `--to`.

### Testing Strategy
- No automated test suite currently.
- `package.json` does not define real tests yet; `npm test` is a placeholder.
- Validation is currently manual:
  - run commands against real GA4 / BigQuery environments
  - use sample report specs in `specs/`
  - use sample queries in `sql/`
- Good future test targets are pure helpers such as CSV formatting, NDJSON row
  shaping, table rendering, path resolution, and request-building functions.

### Git Workflow
- Not specified. (Add branch/commit conventions if you have them.)

## Domain Context
- GA4 property IDs use `properties/NNN` format.
- The `admin` command currently supports multiple resource types through JSON
  specs:
  - `channelGroup` with `update`
  - `googleAdsLinks` with `list`
  - `customDimensions` with `list` and `create`
  - `customMetrics` with `list` and `create`
- Channel-group updates are additive. The CLI finds a non-system channel group
  by display name and appends only missing rules based on rule display name.
- `reports` supports `standard`, `pivot`, and `realtime` report types from
  JSON specs.
- Standard GA4 reports support dimensions, metrics, filters, ordering, paging,
  empty-row behavior, and quota return flags.
- `reports` output formats are `table`, `csv`, `json`, and `ndjson`.
- `bq` supports SQL templates with `{{project}}` and `{{dataset}}`, named
  parameters via repeated `--param`, optional `_TABLE_SUFFIX` helpers via
  `--from` / `--to`, dry runs, and optional writes to destination tables.
- The included SQL examples focus on GA4 export analysis, especially AI-source
  traffic labeling and user/session identity handling.

## Important Constraints
- Requires valid Google credentials, either through
  `GOOGLE_APPLICATION_CREDENTIALS` or Application Default Credentials.
- `admin` uses edit-scoped GA4 access and expects the service account to have
  sufficient permissions on the GA4 property.
- Relevant Google APIs must be enabled for the target project/property:
  - GA4 Admin API
  - GA4 Data API
  - BigQuery API
- The tool is network-dependent and designed to operate against live Google
  services rather than local mocks.
- Because there is no persistence layer or application server, most operational
  correctness depends on spec validity, CLI flag validation, and upstream API
  responses.

## External Dependencies
- GA4 Admin API for property administration tasks such as channel groups,
  Google Ads links, custom dimensions, and custom metrics
- GA4 Data API for report execution
- BigQuery for querying GA4 export datasets and writing destination tables
- Local JSON and SQL files as the configuration/spec surface
