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
- Insert a blank line between the subject line and the body
- Write the body using Markdown formatting without paragraph wrapping
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

## Debugging

### E2E Test Debugging

To see console logs from the page during Playwright e2e tests, add this to your
test:

```javascript
page.on('console', (msg) => console.log('PAGE: ', msg.text()))
```

This will output all console messages from the page to your test output, helping
you debug what's happening in the browser.
