#!/usr/bin/env node

// index.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { GoogleAuth } from "google-auth-library";
import { v1alpha } from "@google-analytics/admin";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { BigQuery } from "@google-cloud/bigquery";
import { Command } from "commander";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveSpecPath(specPath, fallbackDir) {
  const direct = path.resolve(specPath);
  if (fs.existsSync(direct)) return direct;
  if (!path.isAbsolute(specPath)) {
    const fallback = path.resolve(fallbackDir, specPath);
    if (fs.existsSync(fallback)) return fallback;
  }
  return direct;
}

const program = new Command();
program
  .name("gaaar")
  .description("GA4 Admin + Data CLI: channel groups & programmatic reports")
  .version("0.1.0");

/* -----------------------------------------------------------------------------
 * Subcommand: admin
 * ---------------------------------------------------------------------------*/
program
  .command("admin")
  .description("Manage GA4 resources from a JSON spec file.")
  .requiredOption(
    "-p, --property <propertyId>",
    "GA4 property ID (e.g., properties/123456789)",
    process.env.GA4_PROPERTY_ID
  )
  .requiredOption(
    "-s, --spec <path>",
    "Path to admin spec JSON file (defaults to config/ when relative)"
  )
  .action(async (opts) => {
    const PROPERTY_ID = opts.property || process.env.GA4_PROPERTY_ID;
    const SPEC_PATH = resolveSpecPath(opts.spec, "config");

    if (!fs.existsSync(SPEC_PATH)) {
      console.error("Spec file not found:", SPEC_PATH);
      process.exit(1);
    }
    const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));

    if (!PROPERTY_ID) {
      console.error(
        "Missing GA4 property id. Use --property=properties/123456789 or set GA4_PROPERTY_ID."
      );
      process.exit(1);
    }
    if (!PROPERTY_ID.startsWith("properties/")) {
      console.error(
        "GA4 property id must look like 'properties/123456789'. Got:",
        PROPERTY_ID
      );
      process.exit(1);
    }

    try {
      const { resourceType, action, ...config } = spec;
      if (!resourceType || !action) {
        throw new Error(
          'Spec file must contain "resourceType" and "action" fields.'
        );
      }
      switch (resourceType) {
        case "channelGroup":
          await handleChannelGroup(PROPERTY_ID, action, config);
          break;
        case "googleAdsLinks":
          await handleGoogleAdsLinks(PROPERTY_ID, action, config);
          break;
        case "customDimensions":
          await handleCustomDimensions(PROPERTY_ID, action, config);
          break;
        case "customMetrics":
          await handleCustomMetrics(PROPERTY_ID, action, config);
          break;
        default:
          throw new Error(`Unsupported resourceType: ${resourceType}`);
      }
    } catch (err) {
      console.error("Error:", err?.message || err);
      if (err?.response?.data) {
        console.error(
          "Response data:",
          JSON.stringify(err.response.data, null, 2)
        );
      }
      process.exit(1);
    }
  });

// ---- Auth & Admin client (v1alpha) ----
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/analytics.edit"],
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // optional with ADC
});
const adminClient = new v1alpha.AnalyticsAdminServiceClient({
  auth,
  fallback: true,
});

// Build a "source CONTAINS value" rule (shape you validated)
function buildGroupingRule({ displayName, fieldName, matchType, value }) {
  const apiFieldName = fieldName === "source" ? "eachScopeSource" : fieldName;
  const apiMatchType = matchType === "CONTAINS" ? 4 : 1; // CONTAINS=4, EXACT=1

  return {
    displayName,
    expression: {
      andGroup: {
        filterExpressions: [
          {
            orGroup: {
              filterExpressions: [
                {
                  filter: {
                    fieldName: apiFieldName,
                    stringFilter: {
                      matchType: apiMatchType,
                      value,
                      caseSensitive: false,
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
}

async function findTargetChannelGroup(propertyId, targetGroupDisplayName) {
  const [groups] = await adminClient.listChannelGroups({ parent: propertyId });
  return groups.find(
    (g) =>
      !g.systemDefined &&
      (g.displayName || "").toLowerCase() ===
        targetGroupDisplayName.toLowerCase()
  );
}

function hasRuleByDisplayName(rules = [], name) {
  const needle = (name || "").toLowerCase();
  return rules.some((r) => (r.displayName || "").toLowerCase() === needle);
}

async function handleChannelGroup(propertyId, action, config) {
  switch (action) {
    case "update":
      await updateChannelGroup(propertyId, config);
      break;
    default:
      throw new Error(`Unsupported action for channelGroup: ${action}`);
  }
}

async function updateChannelGroup(propertyId, spec) {
  const targetGroupDisplayName = (spec.displayName || "").trim();
  console.log(
    `\n→ Property: ${propertyId}\n→ Channel Group: "${targetGroupDisplayName}"\n`
  );

  const target = await findTargetChannelGroup(
    propertyId,
    targetGroupDisplayName
  );
  if (!target) {
    throw new Error(
      `Channel Group "${targetGroupDisplayName}" not found (or it's system-defined) on ${propertyId}.`
    );
  }

  const currentRules = target.groupingRule || [];
  const desiredRules = (spec.rules || []).map(buildGroupingRule);

  const toAdd = desiredRules.filter(
    (spec) => !hasRuleByDisplayName(currentRules, spec.displayName)
  );

  if (toAdd.length === 0) {
    console.log(
      `No changes: all specified channels already exist in "${target.displayName}".`
    );
    return;
  }

  const mergedRules = [...currentRules, ...toAdd];

  const [resp] = await adminClient.updateChannelGroup({
    channelGroup: { name: target.name, groupingRule: mergedRules },
    updateMask: { paths: ["grouping_rule"] },
  });

  console.log(`Updated "${resp.displayName}" (${resp.name}). Added channels:`);
  toAdd.forEach((r) => console.log(`- ${r.displayName}`));
}

async function handleGoogleAdsLinks(propertyId, action, config) {
  switch (action) {
    case "list":
      const [links] = await adminClient.listGoogleAdsLinks({ parent: propertyId });
      printGoogleAdsLinks(links);
      break;
    default:
      throw new Error(`Unsupported action for googleAdsLinks: ${action}`);
  }
}

function printGoogleAdsLinks(links) {
  if (!links?.length) {
    console.log("No Google Ads links found.");
    return;
  }

  const cols = ["Customer ID", "Can Manage Clients", "Creator Email"];
  const rows = links.map(link => [
    link.adsPersonalizationEnabled,
    link.canManageClients,
    link.creatorEmailAddress,
  ]);

  const widths = cols.map((c, i) =>
    Math.max(c.length, ...rows.map(row => String(row[i] ?? "").length), 6)
  );
  const pad = (str, n) => String(str ?? "").padEnd(n, " ");
  const sep = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";

  console.log(sep);
  console.log(
    "|" + cols.map((c, i) => " " + pad(c, widths[i]) + " ").join("|") + "|"
  );
  console.log(sep);
  for (const r of rows) {
    console.log(
      "|" + r.map((v, i) => " " + pad(v, widths[i]) + " ").join("|") + "|"
    );
  }
  console.log(sep);
}

async function handleCustomDimensions(propertyId, action, config) {
  switch (action) {
    case "list":
      const [dimensions] = await adminClient.listCustomDimensions({ parent: propertyId });
      printCustomDimensions(dimensions);
      break;
    case "create":
      const { dimension } = config;
      if (!dimension) {
        throw new Error('Spec for creating custom dimension must contain a "dimension" field.');
      }
      const [createdDimension] = await adminClient.createCustomDimension({
        parent: propertyId,
        customDimension: dimension,
      });
      console.log("Created custom dimension:");
      printCustomDimensions([createdDimension]);
      break;
    default:
      throw new Error(`Unsupported action for customDimensions: ${action}`);
  }
}

function printCustomDimensions(dimensions) {
  if (!dimensions?.length) {
    console.log("No custom dimensions found.");
    return;
  }

  const cols = ["Name", "Parameter Name", "Scope", "Description"];
  const rows = dimensions.map(dim => [
    dim.name,
    dim.parameterName,
    dim.scope,
    dim.description,
  ]);

  const widths = cols.map((c, i) =>
    Math.max(c.length, ...rows.map(row => String(row[i] ?? "").length), 6)
  );
  const pad = (str, n) => String(str ?? "").padEnd(n, " ");
  const sep = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";

  console.log(sep);
  console.log(
    "|" + cols.map((c, i) => " " + pad(c, widths[i]) + " ").join("|") + "|"
  );
  console.log(sep);
  for (const r of rows) {
    console.log(
      "|" + r.map((v, i) => " " + pad(v, widths[i]) + " ").join("|") + "|"
    );
  }
  console.log(sep);
}

async function handleCustomMetrics(propertyId, action, config) {
  switch (action) {
    case "list":
      const [metrics] = await adminClient.listCustomMetrics({ parent: propertyId });
      printCustomMetrics(metrics);
      break;
    case "create":
      const { metric } = config;
      if (!metric) {
        throw new Error('Spec for creating custom metric must contain a "metric" field.');
      }
      const [createdMetric] = await adminClient.createCustomMetric({
        parent: propertyId,
        customMetric: metric,
      });
      console.log("Created custom metric:");
      printCustomMetrics([createdMetric]);
      break;
    default:
      throw new Error(`Unsupported action for customMetrics: ${action}`);
  }
}

function printCustomMetrics(metrics) {
  if (!metrics?.length) {
    console.log("No custom metrics found.");
    return;
  }

  const cols = ["Name", "Parameter Name", "Measurement Unit", "Description"];
  const rows = metrics.map(metric => [
    metric.name,
    metric.parameterName,
    metric.measurementUnit,
    metric.description,
  ]);

  const widths = cols.map((c, i) =>
    Math.max(c.length, ...rows.map(row => String(row[i] ?? "").length), 6)
  );
  const pad = (str, n) => String(str ?? "").padEnd(n, " ");
  const sep = "+" + widths.map(w => "-".repeat(w + 2)).join("+") + "+";

  console.log(sep);
  console.log(
    "|" + cols.map((c, i) => " " + pad(c, widths[i]) + " ").join("|") + "|"
  );
  console.log(sep);
  for (const r of rows) {
    console.log(
      "|" + r.map((v, i) => " " + pad(v, widths[i]) + " ").join("|") + "|"
    );
  }
  console.log(sep);
}


/* -----------------------------------------------------------------------------
 * Subcommand: reports
 * ---------------------------------------------------------------------------*/
program
  .command("reports")
  .description("Run GA4 Data API reports from a JSON spec (everything-as-code)")
  .requiredOption(
    "-s, --spec <path>",
    "Path to report spec JSON (defaults to specs/ when relative)"
  )
  .option(
    "-p, --property <propertyId>",
    "GA4 property (e.g., properties/123456789)",
    process.env.GA4_PROPERTY_ID
  )
  .option("-f, --format <fmt>", "csv|json|ndjson|table", "table")
  .option("-o, --out <path>", "Write output to file instead of stdout")
  .action(async (opts) => {
    const SPEC_PATH = resolveSpecPath(opts.spec, "specs");
    if (!fs.existsSync(SPEC_PATH)) {
      console.error("Spec file not found:", SPEC_PATH);
      process.exit(1);
    }
    const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"));
    const PROPERTY =
      opts.property || spec.property || process.env.GA4_PROPERTY_ID;

    if (!PROPERTY || !PROPERTY.startsWith("properties/")) {
      console.error(
        "Missing/invalid GA4 property. Use -p properties/123456789 or set GA4_PROPERTY_ID or put `property` in the spec."
      );
      process.exit(1);
    }

    const FORMAT = (opts.format || "table").toLowerCase();
    const OUT_PATH = opts.out ? path.resolve(opts.out) : null;

    try {
      await runReportFromSpec({
        spec,
        property: PROPERTY,
        format: FORMAT,
        outPath: OUT_PATH,
      });
    } catch (err) {
      console.error("\nError:", err?.message || err);
      if (err?.response?.data) {
        console.error(
          "Response data:",
          JSON.stringify(err.response.data, null, 2)
        );
      }
      process.exit(1);
    }
  });

// ─── Data API helpers ─────────────────────────────────────────────────────────
const dataClient = new BetaAnalyticsDataClient();

const toDimObjs = (dims = []) =>
  dims.map((d) => (typeof d === "string" ? { name: d } : d));
const toMetObjs = (mets = []) =>
  mets.map((m) => (typeof m === "string" ? { name: m } : m));

function buildRunReportRequest(property, s) {
  return {
    property,
    dateRanges: s.dateRanges || [
      { startDate: "7daysAgo", endDate: "yesterday" },
    ],
    dimensions: toDimObjs(s.dimensions || []),
    metrics: toMetObjs(s.metrics || []),
    dimensionFilter: s.dimensionFilter,
    metricFilter: s.metricFilter,
    orderBys: s.orderBys,
    keepEmptyRows: !!s.keepEmptyRows,
    limit: s.limit ?? 100000,
    offset: s.offset ?? 0,
    returnPropertyQuota: s.returnPropertyQuota ?? true,
  };
}

function buildRunPivotReportRequest(property, s) {
  return {
    property,
    dateRanges: s.dateRanges || [
      { startDate: "7daysAgo", endDate: "yesterday" },
    ],
    dimensions: toDimObjs(s.dimensions || []),
    metrics: toMetObjs(s.metrics || []),
    pivots: s.pivots || [],
    dimensionFilter: s.dimensionFilter,
    metricFilter: s.metricFilter,
    keepEmptyRows: !!s.keepEmptyRows,
    returnPropertyQuota: s.returnPropertyQuota ?? true,
  };
}

function buildRunRealtimeRequest(property, s) {
  return {
    property,
    dimensions: toDimObjs(s.dimensions || []),
    metrics: toMetObjs(s.metrics || [{ name: "activeUsers" }]),
    minuteRanges: s.minuteRanges,
  };
}

function toCsv(dimHeaders, metHeaders, rows) {
  const dimNames = dimHeaders.map((h) => h.name);
  const metNames = metHeaders.map((h) => h.name);
  const header = [...dimNames, ...metNames].join(",");
  const lines = rows.map((r) => {
    const dims = (r.dimensionValues || []).map((v) => csvEscape(v.value ?? ""));
    const mets = (r.metricValues || []).map((v) => csvEscape(v.value ?? ""));
    return [...dims, ...mets].join(",");
  });
  return [header, ...lines].join("\n");
}

function csvEscape(s) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeOut(content, outPath) {
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, content, "utf8");
    console.log(`\nWrote output → ${outPath}`);
  } else {
    console.log(content);
  }
}

function tablePrint(dimHeaders, metHeaders, rows, maxRows = 50) {
  const dimNames = dimHeaders.map((h) => h.name);
  const metNames = metHeaders.map((h) => h.name);
  const cols = [...dimNames, ...metNames];

  const slice = rows
    .slice(0, maxRows)
    .map((r) => [
      ...(r.dimensionValues || []).map((v) => v.value ?? ""),
      ...(r.metricValues || []).map((v) => v.value ?? ""),
    ]);

  const widths = cols.map((c, i) =>
    Math.max(c.length, ...slice.map((row) => String(row[i] ?? "").length), 6)
  );
  const pad = (str, n) => String(str ?? "").padEnd(n, " ");
  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";

  console.log(sep);
  console.log(
    "|" + cols.map((c, i) => " " + pad(c, widths[i]) + " ").join("|") + "|"
  );
  console.log(sep);
  for (const r of slice) {
    console.log(
      "|" + r.map((v, i) => " " + pad(v, widths[i]) + " ").join("|") + "|"
    );
  }
  console.log(sep);
  if (rows.length > maxRows)
    console.log(`(showing ${maxRows} of ${rows.length} rows)`);
}

async function runReportFromSpec({ spec, property, format, outPath }) {
  const type = (spec.reportType || "standard").toLowerCase();

  if (type === "standard") {
    const req = buildRunReportRequest(property, spec);
    // paginate using limit/offset
    let rows = [];
    let dimHeaders = [];
    let metHeaders = [];
    let fetched = 0;
    let more = true;
    while (more) {
      const [resp] = await dataClient.runReport({
        ...req,
        offset: req.offset + fetched,
      });
      dimHeaders = resp.dimensionHeaders || dimHeaders;
      metHeaders = resp.metricHeaders || metHeaders;
      const batch = resp.rows || [];
      rows = rows.concat(batch);
      const total = Number(resp.rowCount ?? rows.length);
      fetched += batch.length;
      more = fetched < total && batch.length > 0;
    }

    if (format === "csv") {
      writeOut(toCsv(dimHeaders, metHeaders, rows), outPath);
    } else if (format === "json") {
      writeOut(
        JSON.stringify(
          { dimensionHeaders: dimHeaders, metricHeaders: metHeaders, rows },
          null,
          2
        ),
        outPath
      );
    } else if (format === "ndjson") {
      const dimNames = dimHeaders.map((h) => h.name);
      const metNames = metHeaders.map((h) => h.name);
      const lines = rows.map((r) => {
        const obj = {};
        dimNames.forEach(
          (n, i) => (obj[n] = r.dimensionValues?.[i]?.value ?? null)
        );
        metNames.forEach(
          (n, i) => (obj[n] = r.metricValues?.[i]?.value ?? null)
        );
        return JSON.stringify(obj);
      });
      writeOut(lines.join("\n"), outPath);
    } else {
      tablePrint(dimHeaders, metHeaders, rows);
    }
  } else if (type === "pivot") {
    const req = buildRunPivotReportRequest(property, spec);
    const [resp] = await dataClient.runPivotReport(req);
    writeOut(JSON.stringify(resp, null, 2), outPath);
  } else if (type === "realtime") {
    const req = buildRunRealtimeRequest(property, spec);
    const [resp] = await dataClient.runRealtimeReport(req);
    const dimHeaders = resp.dimensionHeaders || [];
    const metHeaders = resp.metricHeaders || [];
    const rows = resp.rows || [];
    if (format === "csv") {
      writeOut(toCsv(dimHeaders, metHeaders, rows), outPath);
    } else if (format === "json") {
      writeOut(JSON.stringify(resp, null, 2), outPath);
    } else if (format === "ndjson") {
      const dimNames = dimHeaders.map((h) => h.name);
      const metNames = metHeaders.map((h) => h.name);
      const lines = rows.map((r) => {
        const obj = {};
        dimNames.forEach(
          (n, i) => (obj[n] = r.dimensionValues?.[i]?.value ?? null)
        );
        metNames.forEach(
          (n, i) => (obj[n] = r.metricValues?.[i]?.value ?? null)
        );
        return JSON.stringify(obj);
      });
      writeOut(lines.join("\n"), outPath);
    } else {
      tablePrint(dimHeaders, metHeaders, rows);
    }
  } else {
    throw new Error(
      `Unknown reportType "${spec.reportType}". Use "standard", "pivot", or "realtime".`
    );
  }
}

/* -----------------------------------------------------------------------------
 * Subcommand: bq  — run SQL on GA4 export and optionally materialize a table
 * ---------------------------------------------------------------------------*/
program
  .command("bq")
  .description(
    "Run BigQuery SQL against GA4 export; optionally write results to a table"
  )
  .requiredOption("--project <projectId>", "GCP project that hosts the dataset")
  .requiredOption(
    "--dataset <dataset>",
    "BigQuery dataset name (e.g., ga4_export)"
  )
  .option(
    "--sql <path>",
    "Path to .sql file to run (defaults to sql/ when relative)"
  ) // one of --sql or --query
  .option("--query <text>", "Inline SQL to run") // one of --sql or --query
  .option(
    "--dest <table>",
    "Destination table name to write results (CREATE TABLE AS SELECT)"
  )
  .option("--write <mode>", "append|truncate|empty", "append") // WRITE_APPEND/WRITE_TRUNCATE/WRITE_EMPTY
  .option("--create <mode>", "ifneeded|never", "ifneeded") // CREATE_IF_NEEDED/CREATE_NEVER
  .option("--location <loc>", "Dataset location, e.g. US/EU", "US")
  .option(
    "--from <YYYY-MM-DD>",
    "Start date to compute _TABLE_SUFFIX (optional)"
  )
  .option("--to <YYYY-MM-DD>", "End date to compute _TABLE_SUFFIX (optional)")
  .option(
    "--include-intraday",
    "Union today's events_intraday_* table if within range",
    false
  )
  .option(
    "--param <k=v...>",
    "Add named parameter (repeatable)",
    collectParams,
    {}
  )
  .option("--dry-run", "Validate & estimate bytes without running", false)
  .action(async (opts) => {
    // --- validate inputs
    if (!opts.sql && !opts.query) {
      console.error('Provide either --sql <file.sql> or --query "..."');
      process.exit(1);
    }
    const bigquery = new BigQuery({ projectId: opts.project });

    // --- read SQL
    let sql = opts.query;
    if (!sql) {
      const SQL_PATH = resolveSpecPath(opts.sql, "sql");
      if (!fs.existsSync(SQL_PATH)) {
        console.error("SQL file not found:", SQL_PATH);
        process.exit(1);
      }
      sql = await fs.promises.readFile(SQL_PATH, "utf8");
    }

    // --- perform template substitution for {{project}} and {{dataset}}
    sql = sql.replace(/\{\{project\}\}/g, opts.project);
    sql = sql.replace(/\{\{dataset\}\}/g, opts.dataset);

    // --- compute optional suffix params for events_* wildcard queries
    const suffixParams = buildSuffixParams(opts.from, opts.to);
    const params = { ...opts.param, ...suffixParams };

    // Prepare destination table reference (optional)
    const datasetRef = bigquery.dataset(opts.dataset);
    const destination = opts.dest ? datasetRef.table(opts.dest) : undefined;

    // map write/create modes
    const writeMap = {
      append: "WRITE_APPEND",
      truncate: "WRITE_TRUNCATE",
      empty: "WRITE_EMPTY",
    };
    const createMap = { ifneeded: "CREATE_IF_NEEDED", never: "CREATE_NEVER" };

    const jobOptions = {
      query: sql,
      params, // named params, use @param in SQL
      location: opts.location,
      useLegacySql: false,
      dryRun: !!opts.dryRun,
      destination,
      writeDisposition: destination ? writeMap[opts.write] : undefined,
      createDisposition: destination ? createMap[opts.create] : undefined,
    };

    try {
      // Dry run path: returns bytes processed estimate
      if (opts.dryRun) {
        const [job] = await bigquery.createQueryJob(jobOptions);
        const bytes = Number(job.metadata.statistics.totalBytesProcessed || 0);
        console.log(
          `✔ Dry run OK. Estimated bytes: ${bytes.toLocaleString()} (${(
            bytes / 1e9
          ).toFixed(2)} GB)`
        );
        process.exit(0);
      }

      // Execute
      const [job] = await bigquery.createQueryJob(jobOptions);
      console.log(
        `Job ${job.id} started in ${opts.location}. Waiting for results...`
      );
      const [rows] = await job.getQueryResults();

      if (destination) {
        // materialized to table; print basic stats
        const totalRows = Number(job.metadata.statistics.query?.totalRows ?? 0);
        console.log(
          `✔ Query finished. Wrote ${totalRows.toLocaleString()} rows to ${
            opts.project
          }.${opts.dataset}.${opts.dest}`
        );
      } else {
        // no destination: print a compact table preview
        printRowsPreview(rows);
      }

      // Optional intraday union helper (documented in SQL example below)
      if (opts.includeIntraday) {
        console.log(
          "Note: include-intraday is a hint for your SQL. Use UNION ALL with events_intraday_* in the query."
        );
      }
    } catch (err) {
      // Surface useful errors
      const meta = err?.errors?.[0];
      console.error("BigQuery error:", meta?.message || err.message || err);
      process.exit(1);
    }
  });

// --- helpers for bq command ---
function collectParams(value, prev) {
  // supports: --param from_sfx=20250901 --param to_sfx=20250930 --param country=US
  const [k, ...rest] = value.split("=");
  const v = rest.join("="); // allow '=' in value
  // try JSON parse (so numbers/bools work), else keep as string
  prev[k] = tryJson(v);
  return prev;
}
function tryJson(v) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}
function buildSuffixParams(fromISO, toISO) {
  // Convert YYYY-MM-DD to 'YYYYMMDD' strings for _TABLE_SUFFIX filters
  const out = {};
  if (fromISO) out.from_sfx = fromISO.replace(/-/g, "");
  if (toISO) out.to_sfx = toISO.replace(/-/g, "");
  return out;
}
function printRowsPreview(rows, limit = 50) {
  if (!rows?.length) {
    console.log("✔ Query finished. 0 rows.");
    return;
  }
  const keys = Object.keys(rows[0] || {});
  const sample = rows.slice(0, limit);
  const widths = keys.map((k) =>
    Math.max(k.length, ...sample.map((r) => String(r[k] ?? "").length), 6)
  );
  const pad = (s, n) => String(s ?? "").padEnd(n, " ");
  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  console.log(sep);
  console.log(
    "|" + keys.map((k, i) => " " + pad(k, widths[i]) + " ").join("|") + "|"
  );
  console.log(sep);
  for (const r of sample) {
    console.log(
      "|" + keys.map((k, i) => " " + pad(r[k], widths[i]) + " ").join("|") + "|"
    );
  }
  console.log(sep);
  if (rows.length > limit)
    console.log(`(showing ${limit} of ${rows.length} rows)`);
}

/* -----------------------------------------------------------------------------
 * Parse args
 * ---------------------------------------------------------------------------*/
program.parseAsync();
