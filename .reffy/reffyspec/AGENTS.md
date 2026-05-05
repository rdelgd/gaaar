# ReffySpec Instructions

These instructions are for AI assistants working in this project.

## TL;DR Checklist

- Read the relevant current specs in `.reffy/reffyspec/specs/` before changing behavior.
- Review active changes in `.reffy/reffyspec/changes/` before drafting or implementing new work.
- Use ReffySpec change proposals for new capabilities, breaking changes, or architecture shifts.
- Keep current truth in `.reffy/reffyspec/specs/` and proposed deltas in `.reffy/reffyspec/changes/`.

## ReffySpec Workflow

1. Read `.reffy/reffyspec/project.md` for project conventions.
2. Inspect current specs in `.reffy/reffyspec/specs/`.
3. Inspect active changes in `.reffy/reffyspec/changes/`.
4. Draft or update proposal/design/tasks/spec files under `.reffy/reffyspec/changes/<change-id>/`.
5. Use native Reffy commands for routine planning workflow:
   - `reffy plan create`
   - `reffy plan validate`
   - `reffy plan list`
   - `reffy plan show`
   - `reffy plan archive`
   - `reffy spec list`
   - `reffy spec show`

## Directory Model

- `.reffy/reffyspec/changes/` contains active proposed changes.
- `.reffy/reffyspec/changes/archive/` contains historical archived changes.
- `.reffy/reffyspec/specs/` contains current truth for each capability.

## Proposal Rules

- Use a unique verb-led `change-id` in kebab-case.
- Include `proposal.md`, `tasks.md`, optional `design.md`, and delta specs per affected capability.
- Delta specs must use `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`.
- Each requirement must include at least one `#### Scenario:`.

## Reffy Relationship

- Reffy owns the runtime and artifact workflow.
- ReffySpec is the canonical planning/spec surface.
- Reffy artifacts in `.reffy/` should inform proposal/design content without duplicating the full planning files.
