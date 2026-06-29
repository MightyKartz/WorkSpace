# Local Kitsu Lite Design Direction

Selected source: Airtable from `VoltAgent/awesome-design-md`.

Use this as a structured-data production workspace, not a marketing site. The app should feel like a quiet asset database with task ownership: dense, readable, and fast to scan.

## Visual Style

- Canvas: warm white or very light gray.
- Surfaces: white panels with thin gray borders.
- Primary action: near-black or deep green, used sparingly.
- Secondary actions: white buttons with gray borders.
- Status color only carries workflow meaning: blue for active, amber for review, green for done, red for destructive.
- Avoid decorative gradients, oversized hero sections, nested cards, and illustration-heavy layouts.

## Layout

- Keep the main asset view as a table plus right inspector.
- Keep schedule as compact status lanes.
- Filters and search sit above the data surface, not in a separate sidebar.
- Prefer full-width work areas over floating page sections.
- Use stable dimensions for thumbnails, lanes, toolbar controls, and status pills.

## Typography

- Use system sans: `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `PingFang SC`, `sans-serif`.
- Body text: 14px.
- Captions and metadata: 12px.
- Section titles: 14-18px, medium weight.
- No negative letter spacing. No viewport-scaled font sizes.

## Components

- Tables use fixed columns where possible and truncate long asset names.
- Tags are small neutral pills.
- Status pills are small, color-coded, and text-first.
- Buttons use 6-8px radius.
- Cards are only for repeated task items, modals, and individual settings blocks.
- The inspector should prioritize preview, editable metadata, and related tasks.

## Interaction

- Asset row click selects the inspector item.
- Task claim should be one click and move the task to `进行中`.
- Forms should use native controls: file input, date input, select, textarea.
- Empty states should be plain operational text, not promotional copy.

## Do Not Add

- Authentication UI unless the app gains auth.
- Complex role dashboards.
- Custom date pickers.
- Extra charting or analytics panels before users ask for them.
