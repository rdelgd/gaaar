

<!-- REFFY:START -->
# Reffy Instructions

These instructions are for AI assistants working in this project.

Always open `@/.references/AGENTS.md` when the request:
- Mentions early-stage ideation, exploration, brainstorming, or raw notes
- Needs context before drafting specs or proposals
- Refers to "reffy", "references", "explore", or "context layer"

Use `@/.references/AGENTS.md` to learn:
- Reffy workflow and artifact conventions
- How Reffy and OpenSpec should be sequenced
- How to store and consume ideation context in `.references/`

Keep this managed block so `reffy init` can refresh the instructions.

<!-- REFFY:END -->

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## gaaar — docs and developer notes

This repository contains a small CLI utility (single-file) for interacting with
Google Analytics 4 (GA4) and BigQuery. The entry point is `index.mjs` and the
CLI exposes three main subcommands: `channels`, `reports`, and `bq`.

This document describes current behavior, flags, examples, configuration,
and implementation notes so contributors and users can run and maintain the
tool.

## Summary of commands

- `admin` — Manage GA4 resources from a JSON spec file.
- `reports` — Run GA4 Data API reports from a JSON spec (standard/pivot/realtime).
- `bq` — Run BigQuery SQL against a GA4 export; optionally write results to a table.

All commands are invoked via the top-level script:

```bash
# from the repo root
node index.mjs <command> [options]
```

## 1) admin

Purpose: find a non-system channel group by display name and append missing
AI-source grouping rules defined in a JSON spec file.

Key flags / env:
- `-p, --property <propertyId>` — GA4 property id, e.g. `properties/123456789`.
	Can also be provided via `GA4_PROPERTY_ID` env var.
- `-s, --spec <path>` — required. Path to the JSON spec that defines the admin task.

Behavior:
- Uses the Analytics Admin API (`@google-analytics/admin` v1alpha) to list
	channel groups on the property and match the display name case-insensitively.
- Skips system-defined groups.
- Compares existing grouping rules to the rules in the spec file and only
	appends rules that are missing (avoids duplicates).
- Prints added channels on success.

Example:

```bash
# append AI channels to "Custom Channel Group" on property
node index.mjs admin -p properties/123456789 -s config/channel_group.json
```

Notes:
- The AI channel specs now live in `config/channel_group.json`.
- If `--spec` is a relative path, the CLI defaults to looking in `config/`.

## 2) reports

Purpose: run GA4 Data API reports defined as JSON specs (everything-as-code).

Key flags / spec fields:
- `-s, --spec <path>` — required. Path to the JSON spec that defines the report.
- `-p, --property <propertyId>` — GA4 property id, can also be set in the spec
	(spec.property) or via `GA4_PROPERTY_ID` env var.
- `-f, --format <fmt>` — one of `csv|json|ndjson|table` (default: `table`).
- `-o, --out <path>` — write output to a file instead of stdout.

Supported report types (set `reportType` in the spec):
- `standard` (default) — paginated `runReport` with dimensions/metrics/filters.
- `pivot` — runs `runPivotReport` and returns the raw pivot response.
- `realtime` — runs `runRealtimeReport` for minute ranges and activeUsers.

Behavior / output formats:
- `csv` — prints a CSV with dimension and metric columns.
- `json` — pretty-printed JSON response.
- `ndjson` — newline-delimited JSON records (one object per row).
- `table` — human-friendly ASCII table printed to stdout.

Example:

```bash
node index.mjs reports -s specs/weekly_kpis.json -p properties/123456789 -f csv -o out/kpis.csv
```

Tip: If `property` is present in the spec JSON, you can omit `-p`.
If `--spec` is a relative path, the CLI defaults to looking in `specs/`.

## 3) bq

Purpose: run SQL against a BigQuery dataset (commonly the GA4 export dataset)
and optionally write results into a destination table.

Key flags:
- `--project <projectId>` — GCP project id (required).
- `--dataset <dataset>` — BigQuery dataset name (required).
- `--sql <path>` or `--query <text>` — one of these is required.
- `--dest <table>` — optional destination table name to materialize results.
- `--write <mode>` — `append|truncate|empty` (default: `append`).
- `--create <mode>` — `ifneeded|never` (default: `ifneeded`).
- `--location <loc>` — dataset location (default: `US`).
- `--from <YYYY-MM-DD>` / `--to <YYYY-MM-DD>` — helper params used to
	construct `_TABLE_SUFFIX` params for templated SQL.
- `--include-intraday` — informational hint to the user about intraday tables.
- `--param <k=v>` — repeatable; adds named parameters available as `@k` in SQL.
- `--dry-run` — validate & estimate bytes without running.

Behavior:
- Supports reading an SQL file and performing simple template replacements:
	`{{project}}` and `{{dataset}}` are substituted from CLI flags.
- Adds `from_sfx` and `to_sfx` params (YYYYMMDD) when `--from`/`--to` are used
	to make it easier to query `events_*` wildcard tables.
- When `--dest` is supplied, creates a destination table (CREATE TABLE AS SELECT)
	using the provided `--write` and `--create` options.

Example:

```bash
node index.mjs bq --project my-proj --dataset ga4_export --sql sql/ai_sources_daily.sql --from 2025-09-01 --to 2025-09-21 --dest my_temp.table_name
```
If `--sql` is a relative path, the CLI defaults to looking in `sql/`.

## Environment and auth

- `GOOGLE_APPLICATION_CREDENTIALS` — path to service account key JSON (optional if
	using Application Default Credentials). Required for both Admin API and BigQuery
	client auth when not using ADC.
- `GA4_PROPERTY_ID` — optional default GA4 property id (format `properties/NNN`).

Ensure the service account has the necessary roles and that the account email
is granted Editor (or equivalent) on the GA4 property for Admin API calls.

## Development / contributor notes

- Entry point: `index.mjs` — small procedural CLI implemented with `commander`.
- Dependencies are declared in `package.json` — run `npm install` to set up.
- The repository contains a few example spec files in `specs/` and an example
	SQL in `sql/` to show how the `bq` command is expected to be used.

Quick start:

```bash
npm install
# set GOOGLE_APPLICATION_CREDENTIALS and (optionally) GA4_PROPERTY_ID
node index.mjs channels -p properties/123456789
```

Small improvements you can contribute:
- Add unit tests for CSV/NDJSON/pretty table formatting functions.
- Split commands into modules for easier testing and extension.
- Add clearer exit codes and error types for CI-friendly automation.

## Files of interest

- `index.mjs` — CLI and implementation.
- `specs/` — JSON report specs used by the `reports` command.
- `sql/` — example SQL used by the `bq` command.
