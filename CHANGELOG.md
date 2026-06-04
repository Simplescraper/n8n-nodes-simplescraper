# Changelog

All notable changes to `n8n-nodes-simplescraper` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-06-03

### Fixed
- Codex `categories` no longer includes the unsupported value "Developer Tools" (flagged in n8n verification manual review). Now `["Development", "Data & Storage"]` - both valid n8n categories.

## [0.1.3] - 2026-06-03

### Added
- Example workflow in the README showing the Extract URLs → Split Out → Filter → Extract Data pattern for content audits and RAG corpus building.
- Post-publish run of `@n8n/scan-community-package` in the GitHub Actions workflow, mirroring the verification check n8n runs during Creator Portal review.

### Changed
- `author.name` aligned with the npm publishing identity (`simplescraperapp`) and `author.email` corrected to `mike@simplescraper.io`. No functional change.

## [0.1.2] - 2026-06-03

### Changed
- Node and credential icons updated to the Simplescraper brand mark (four-square logo in `#4a76ec` and `#93B1F6`). Previously a placeholder square.
- Publishing migrated from a long-lived npm `NPM_TOKEN` secret to an OIDC Trusted Publisher. Future releases authenticate via the GitHub Actions OIDC handshake; no token rotation required. No user-visible change.

## [0.1.1] - 2026-06-02

### Changed
- README rewritten to focus on install, credential setup, and operations. The previous version included build / publish / verification sections that belonged in maintainer notes, not the user-facing readme.

## [0.1.0] - 2026-06-02

### Added
- Initial release.
- Resource: **Recipe** with operations `Run`, `Get Latest Results`, `Get History`.
- Resource: **Page** with operations `Extract Data`, `AI Extract`, `Screenshot`.
- Resource: **URL** with operation `Extract URLs`.
- Simplescraper API credential with `Test` button that hits `GET /recipes` to verify the key.
- Recipe dropdown paginates (50 per page) so accounts with many recipes work correctly.
- Long-running scrapes return immediately with `results_id` for async polling against `GET /v1/results/:resultsId`.

[0.1.4]: https://github.com/simplescraper/n8n-nodes-simplescraper/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/simplescraper/n8n-nodes-simplescraper/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/simplescraper/n8n-nodes-simplescraper/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/simplescraper/n8n-nodes-simplescraper/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/simplescraper/n8n-nodes-simplescraper/releases/tag/v0.1.0
