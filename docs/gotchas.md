# Gotchas — root cause, mitigation, evidence

| Priority | Issue | Mitigation | Evidence |
| --- | --- | --- | --- |
| P0 | `document.body.append()` at document-start can throw before `body` exists | Defer mount until DOMContentLoaded | Chromium PASS |
| P0 | `document.onkeyup = handler` overwrites existing page event handlers | `addEventListener` with editable-field protection | Chromium PASS |
| P0 | A missing CDN script makes `DarkReader.enable()` throw | API check plus visible error and safe failure state | Mock Chromium PASS; real CDN NOT RUN |
| P0 | Custom v1 DOM scanning can saturate CPU / cause infinite mutation loops | Delegate CSS parsing and dynamic updates to mature upstream renderer; watch only root attributes when Auto off | Architecture fixed; real performance NOT RUN |
| P1 | `@require` of upstream v4.9.58 is old and unreviewed | Exact pin to v4.9.135 | Pinned; integrity hash not independently verified |
| P1 | Site already has native dark theme | Auto skip heuristic; explicit On override | Mock Chromium PASS; live SPA NOT RUN |
| P1 | Async `GM.setValue` can race during rapid toggles | Serialized per-site writes | Implemented; delayed-write race test pending |
| P1 | Preference fallback leaks into site-origin localStorage | Prefer scoped GM storage; localStorage only fallback | Mock Chromium PASS |
| P1 | Safari reserves Cmd+Shift+B | Alternative Option+Shift+D and floating control | Safari NOT RUN |
| P1 | Docs/Maps/editor apps become unusable when darkening | Excluded by userscript metadata and hostname guard | Real sites NOT RUN |
| P1 | Safari Adaptive Dark doubles rendering effects | Do not run both solutions simultaneously | Safari NOT RUN |
| P2 | Page CSS hides/changes floating buttons | ShadowRoot, independent CSS, very high z-index | Mock Chromium PASS |

When adding issues, record the URL, Safari/macOS/Tampermonkey version, expected/actual result, screenshots if possible, steps to reproduce, a regression test, and rollback steps. Never describe a skipped check as passing.