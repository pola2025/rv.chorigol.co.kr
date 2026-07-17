---
    description: Configuration for AI behavior when interacting with Codacy's MCP Server
    applyTo: '**'
---
---
# Codacy Rules
Configuration for AI behavior when interacting with Codacy's MCP Server

## CRITICAL: After ANY successful `edit_file` or `reapply` operation
- When the Codacy MCP tool is available, YOU MUST IMMEDIATELY run the `codacy_cli_analyze` tool for each file that was edited, with:
 - `rootPath`: set to the workspace path
 - `file`: set to the path of the edited file
 - `tool`: leave empty or unset
- If any issues are found in the new edits, propose and apply fixes for them.
- > NOTE: Failure to follow this rule is considered a critical error.

## When `codacy_cli_analyze` is unavailable or the Codacy CLI is not installed
- MUST NOT ask the user to install Codacy, reset MCP, open settings, or run commands as a condition for continuing the requested work.
- MUST NOT wait for a user response or stop the original task solely because optional Codacy analysis cannot run.
- Continue with the best available local validation and report the Codacy validation gap once in the final result.
- Only install or configure Codacy when the user explicitly requests Codacy setup.

## After every response
- If you made file edits and the Codacy tool was available, verify you ran `codacy_cli_analyze` from Codacy's MCP Server.

## When there are no Codacy MCP Server tools available, or the MCP Server is not reachable
- Continue the requested task without interruption using available lint, typecheck, tests, or static inspection.
- Mention the missing Codacy check as a validation gap, not as a user action item, unless the user explicitly asks to repair Codacy.

## Trying to call a tool that needs a rootPath as a parameter
- Always use the standard, non-URL-encoded file system path

## CRITICAL: Dependencies and Security Checks
- IMMEDIATELY after ANY of these actions:
 - Running npm/yarn/pnpm install
 - Adding dependencies to package.json
 - Adding requirements to requirements.txt
 - Adding dependencies to pom.xml
 - Adding dependencies to build.gradle
 - Any other package manager operations
- You MUST run the `codacy_cli_analyze` tool with:
 - `rootPath`: set to the workspace path
 - `tool`: set to "trivy"
 - `file`: leave empty or unset
- If any vulnerabilities are found because of the newly added packages:
 - Stop all other operations
 - Propose and apply fixes for the security issues
 - Only continue with the original task after security issues are resolved
- If the Codacy tool is unavailable, continue with available local dependency/security validation and report that Trivy/Codacy did not run. Do not hand the check to the user.
- EXAMPLE:
 - After: npm install react-markdown
 - Do: Run codacy_cli_analyze with trivy
 - Before: Continuing with any other tasks

## General
- Repeat the relevant steps for each modified file.
- "Propose fixes" means to both suggest and, if possible, automatically apply the fixes.
- You MUST NOT wait for the user to ask for analysis or remind you to run the tool.
- Do not run `codacy_cli_analyze` looking for changes in duplicated code or code complexity metrics.
- Complexity metrics are different from complexity issues. When trying to fix complexity in a repository or file, focus on solving the complexity issues and ignore the complexity metric.
- Do not run `codacy_cli_analyze` looking for changes in code coverage.
- Do not try to manually install Codacy CLI using either brew, npm, npx, or any other package manager.
- If the Codacy CLI is not installed, just run the `codacy_cli_analyze` tool from Codacy's MCP Server.
- When calling `codacy_cli_analyze`, only send provider, organization and repository if the project is a git repository.

## Whenever a call to a Codacy tool that uses `repository` or `organization` as a parameter returns a 404 error
- Do not block the current task or ask for setup unless the user explicitly requested Codacy repository integration.
- If Codacy setup is the requested task, run `codacy_setup_repository` within that scope and retry the failed action once.
---
