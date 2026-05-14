## Why

`gaaar` currently produces useful analysis outputs as files, but reviewing those outputs still depends on opening files manually in an editor. For completed artifacts such as `vpd_leads_funnel.md`, a small local server would make sharing, browsing, and validating analysis much easier without introducing a larger web application.

This also fits the project’s existing “analytics as code” model:
- SQL and specs remain source-controlled inputs
- analysis artifacts remain source-controlled outputs
- the new server is only a local presentation layer for those outputs

## What Changes

Add a local server capability to `gaaar` so completed analysis reports under `reports/` can be served in a browser during local review.

Initial scope:
- add a new `serve` CLI command
- serve files from `reports/` exclusively
- provide a simple directory index for discoverability
- render markdown artifacts as HTML for browser viewing
- serve non-markdown files directly
- reject path traversal outside the configured root

Expected command shape:

```bash
gaaar serve
gaaar serve --host 127.0.0.1
gaaar serve --port 4173
```

Expected behavior:
- default root is `reports/`
- server prints the local URL on startup
- visiting the root shows a simple index of files
- visiting a markdown artifact shows rendered HTML

## Impact

Benefits:
- faster local review of completed analysis artifacts
- easier browsing of `reports/` output
- no need to introduce a larger dashboard or app stack

Constraints:
- this is a local-only review feature, not a hosted reporting surface
- the initial implementation should stay lightweight and close to the current single-file CLI architecture
- the served root is fixed to `reports/`, not `.reffy/artifacts/` or arbitrary repo directories

Non-goals:
- authentication or remote hosting
- write APIs or browser-based editing
- artifact generation
- a full reporting application

## Reffy References
- `vpd_leads_funnel.md` - example of a completed analysis artifact that would benefit from browser-based viewing
- `funnel_query_reflection.md` - example of a reusable analysis note that should be easy to browse locally
