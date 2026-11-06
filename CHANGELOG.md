# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-alpha.1] - 2026-11-07

### Changed

- Shorter README, in English and French, focused on setup.
- `package.json` links to the GitHub repository, homepage and issue tracker.

## [0.1.0-alpha.0] - 2026-11-06

First public alpha, extracted from a production Payload 3 multi-site backoffice.

### Added

- `previewClickPlugin`: adds the click-to-edit listener to the edit view of chosen collections.
- `PreviewClickListener` client component (`payload-preview-click/client`): opens the clicked block, array row or
  field in the form (expands collapsed rows, scrolls, flashes, focuses) and opens linked documents of the same
  collection, after waiting for autosave.
- Message protocol (`payload-preview-click/message`): `payload-preview-click` and `payload-preview-navigate`
  messages, builders, origin checks and strict validation of paths, ids and locales.
- Preview script (`payload-preview-click/preview`, and `preview.global.js` for a plain script tag): hover outline,
  click to select and go one level down, Escape to go up, ⌘/Ctrl + click on links, blocked links and form
  submissions, kept scroll position and selection across reloads, localizable labels.
- Markers for the preview page: `blockMarker`/`BLOCKS_END` comments, `blockAttributes`, `editable` field attributes.
- Link resolution helpers: `pageLinks`, `pageResolver`, `linkPath`.

[Unreleased]: https://github.com/raphaelApard/payload-preview-click/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/raphaelApard/payload-preview-click/compare/v0.1.0-alpha.0...v0.1.0-alpha.1
[0.1.0-alpha.0]: https://github.com/raphaelApard/payload-preview-click/releases/tag/v0.1.0-alpha.0
