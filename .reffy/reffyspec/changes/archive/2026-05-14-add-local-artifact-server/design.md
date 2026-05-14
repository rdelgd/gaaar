## Design Notes

The server should stay aligned with the current architecture:
- single-file CLI entry point
- minimal abstraction
- no unnecessary framework or frontend runtime

## Command Shape

Recommended initial interface:

```bash
gaaar serve [options]
```

Options:
- `--port <number>`: default `4173`
- `--host <host>`: default `127.0.0.1`

The served root should be fixed to `reports/`. This command should not accept an arbitrary directory because the feature is intended to expose review-ready reports only, not the broader Reffy artifact workspace.

## Rendering Strategy

Markdown rendering should be intentionally basic:
- convert headings, paragraphs, code blocks, inline code, lists, and tables well enough for analysis review
- wrap output in a minimal HTML shell
- preserve readable monospace formatting for code and SQL

If a small markdown dependency is needed later, that can be considered separately, but the preferred first pass is minimal and local.

## Safety

The server must:
- resolve all paths against the fixed `reports/` root
- reject traversal attempts outside that root
- avoid exposing `.reffy/artifacts/` or the rest of the repository

## Why This Scope

This gives `gaaar` a practical artifact-review surface without changing the tool into a larger application. It also keeps the feature close to the repository’s current workflow around `.reffy/artifacts/`.
This gives `gaaar` a practical report-review surface without changing the tool into a larger application. It also keeps the feature close to the repository’s current workflow around `reports/`.
