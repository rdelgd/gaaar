# artifact-server Specification

## Purpose
TBD - created by archiving change add-local-artifact-server. Update Purpose after archive.

## Requirements
### Requirement: Serve Local Analysis Artifacts

`gaaar` MUST provide a CLI command that starts a local HTTP server for browsing completed analysis artifacts.

#### Scenario: Start server with defaults

- Given the user runs `gaaar serve`
- When the command starts successfully
- Then it serves files from `reports/`
- And it prints the local listening URL
### Requirement: Render Markdown Artifacts for Browser Review

The local artifact server MUST render markdown files as HTML so completed analysis can be reviewed in a browser.

#### Scenario: Open markdown artifact

- Given the server is running
- And `reports/vpd_leads_funnel.md` exists under the served root
- When the user requests that markdown file in a browser
- Then the response is HTML
- And the markdown content is readable as a formatted report page
### Requirement: Provide Artifact Discovery

The local artifact server MUST provide a simple index for browsing files under the configured root.

#### Scenario: Browse root directory

- Given the server is running
- When the user requests the root path `/`
- Then the response lists available files and directories under the served root
- And each listed entry is linked for navigation
### Requirement: Prevent Path Traversal Outside Root

The local artifact server MUST reject requests that resolve outside the configured root directory.

#### Scenario: Reject traversal attempt

- Given the server is running
- When the user requests a path such as `/../.env`
- Then the server returns an error response
- And it does not expose the requested file
