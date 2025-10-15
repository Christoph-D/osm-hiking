## Development Workflow

- After every task, run "npm run validate" to build the code and run the tests
  and linter.

## Commit Message Guidelines

Follow conventional commit format: `type: description`

**Common Types:**

- `feat:` New features
- `fix:` Bug fixes
- `cleanup:` Code cleanup, refactoring, removing dead code
- `build:` Build system changes, scripts, dependencies
- `test:` Test-related changes

**Style Guidelines:**

- Subject line should describe **what** was done
- Rest of the commit (if needed) should explain **why** it was done
- Use lowercase for the description
- Keep subjects concise and clear
- Use imperative mood (e.g., "Add feature" not "Added feature")
- No period at the end of the subject line
- Never include "Generated with Claude Code" or "Co-Authored-By" in commit
  messages

**Examples:**

- `feat: Recalculate route while dragging a marker`
- `fix: Draw Polyline only if there are at least two points`
- `cleanup: Remove unnecessary function deleteWaypoint`
- `build: Add "validate" script to run the build, tests, linter`
- `test: Fix test for Overpass mock`
