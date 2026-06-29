# Repository Guidelines

## Project Structure & Module Organization

This is a small dependency-free Node.js web app.

- `server.js` owns the HTTP server, JSON persistence, upload handling, and API routes.
- `public/index.html`, `public/styles.css`, and `public/app.js` contain the browser UI.
- `test/*.test.js` contains Node test runner tests.
- `data/` is runtime storage for `db.json` and uploaded files. Treat it as local/NAS data, not source.
- `output/playwright/` and `.playwright-cli/` are QA artifacts.

Keep changes in the fewest files that own the behavior. Prefer existing helpers in `server.js` or `public/app.js` before adding new ones.

## Build, Test, and Development Commands

Run from the repository root:

```bash
npm start
```

Starts the local LAN server on `HOST=0.0.0.0` and `PORT=4173` by default.

```bash
npm test
```

Runs all tests with Node’s built-in test runner.

```bash
LOCAL_KITSU_DATA_DIR=/Volumes/YourNAS/studio-board npm start
```

Runs against a NAS-mounted data directory.

## Coding Style & Naming Conventions

Use modern JavaScript ES modules, 2-space indentation, semicolons, and `const` by default. Use `camelCase` for variables and functions, `PascalCase` only for future classes or constructors, and kebab-case for generated/static filenames.

There is no formatter or linter configured. Match the existing style and keep UI strings concise. Avoid adding dependencies unless the standard library cannot reasonably do the job.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`. Name test files `*.test.js` under `test/`.

Add one focused test for non-trivial server behavior, especially uploads, persistence, validation, and destructive actions. Browser-only UI changes should be manually checked with Playwright or a real browser and documented in the PR.

## Commit & Pull Request Guidelines

No Git history is present in this workspace, so use simple imperative commit messages such as `Add asset tag filtering` or `Fix task claim state`.

Pull requests should include:

- What changed and why.
- How it was tested, including `npm test`.
- Screenshots for visible UI changes.
- Any storage or configuration impact, especially `LOCAL_KITSU_DATA_DIR`, `PORT`, `HOST`, or upload limits.

## Security & Configuration Tips

This app is intended for trusted local networks. Do not expose it directly to the public internet without adding authentication and stricter upload controls.
