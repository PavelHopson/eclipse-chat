# Eclipse Chat training media recovery QA

Date: 2026-08-30

## Source state

- User reference: `C:\Users\garaa\AppData\Local\Temp\codex-clipboard-0704316d-a37f-4b7f-afa7-efdfeeda39ea.png`
- Failure shown: uploaded MP4 cards render, while multiple YouTube cards show empty black or generic unavailable frames.

## Implemented state

- Local preview: `http://127.0.0.1:4322/?workspace-preview=1`
- Desktop viewport: 1536 x 887, no horizontal overflow, six media cards visible.
- Mobile viewport: 390 x 844, no horizontal overflow, two-column media grid retained.
- Browser console: no warnings or errors in the verified preview state.
- Motion: poster hover motion is disabled by `prefers-reduced-motion: reduce`.

## Product and interaction checks

- YouTube cards render an authenticated, server-cached poster before creating an iframe.
- Only the selected card mounts a YouTube iframe; changing cards unloads the previous player.
- Poster, player, and uploaded-file failure states expose retry and direct-source recovery.
- Loading, unavailable, keyboard-focus, mobile, and reduced-motion states are explicit.
- Existing training sections, titles, uploads, editing, and deletion behavior remain unchanged.

## Security checks

- Thumbnail access requires JWT authentication and workspace membership.
- The server derives the upstream URL from a strict 11-character YouTube ID and a hard-coded `i.ytimg.com` origin.
- Redirects are rejected; response type, body size, decoded pixel count, and output format are bounded.
- The route is rate-limited and returns generic upstream errors.

## Verification evidence

- Workspace UI contract: 7 passed.
- Thumbnail unit tests: 4 passed.
- Server suite serialized: 76 files passed, 408 tests passed, 6 skipped.
- Security profile: 22 passed.
- Web and server typechecks: passed.
- Production build: passed.

## Visual comparison result

Status: partially verified.

The local demo fixture contains uploaded MP4 records but no YouTube record, so the shared card grid and recovery styling were verified visually at desktop and mobile sizes, while the YouTube-specific poster-to-player transition is covered by component contracts and server tests. A final same-record visual comparison should be repeated against production-like YouTube data before release.
