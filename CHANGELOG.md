# Changelog

## 2.0.1 — 2026-11-09

- Default new and unset sites to **On**, enabling dark appearance immediately regardless of macOS light/dark mode.
- Preserve existing per-site Auto / On / Off preferences and keep Auto's system-following behavior unchanged.
- Update documentation and controller regression tests for default-on startup and persisted overrides.

## 2.0.0 — 2026-11-09

- Replace ad hoc DOM-wide color rewriting with the upstream Dark Reader 4.9.135 API.
- Add per-site Auto / On / Off plus macOS appearance sync and original dark-theme protection.
- Add bottom-left Shadow DOM controls, keyboard shortcuts, and brightness/contrast/sepia settings.
- Prefer Tampermonkey GM storage; validate inputs and serialize updates.
- Add graceful error handling, site exclusions, tests, CI, architecture notes, and gotchas.

**Release gate:** Full Safari/Tampermonkey and real Dark Reader integration is not yet validated.
