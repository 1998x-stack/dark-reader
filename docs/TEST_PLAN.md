# Verification matrix

## Evidence as of 2026-11-09

The original PASS counts below are from 2.0.0. After changing the default to On in 2.0.1, the controller tests have been updated and must be rerun in CI before making a new PASS claim.

| Test | Status | Notes |
| --- | --- | --- |
| Node.js syntax check | PASS | `node --check safari-dark-reader.user.js` locally |
| Chromium mocked Dark Reader controller E2E | **PASS: 10 tests** | `python tests/test_userscript.py` |
| WebKit controller E2E | **NOT RUN locally** | Binary unavailable. CI requires installation. |
| macOS Safari + Tampermonkey | **NOT RUN** | Requires real Safari and userscript manager |
| Actual external Dark Reader 4.9.135 runtime | **NOT RUN** | Container cannot fetch CDN |
| Cross-site CSS rendering, CPU, and memory | **NOT RUN** | Needs real runtime and representative websites |
| Tampermonkey self-update check | **NOT RUN** | Verify from published default-branch URL |

**Mock API tests are not evidence of real CSS transformation quality.**

## Reproduce

```bash
node --check safari-dark-reader.user.js
python -m pip install playwright==1.57.0
python -m playwright install chromium webkit
REQUIRE_WEBKIT=1 python -m unittest discover -s tests -v
```

Tests cover: default On regardless of system appearance; persisted Off and invalid preference fallback; Auto with light/dark OS appearance; native-dark skip in Auto; manual On override; keyboard toggling and per-site state; inputs protected from shortcut interception; theme sliders and persistence; GM storage; corrupt preference bounds; missing or throwing Dark Reader API; and avoiding redundant theme starts.

## Manual Safari acceptance checklist

Test with stable Safari and separately with Safari 27.3+ where available. Record exact Safari/macOS/Tampermonkey versions, whether WebKit Adaptive Dark is enabled, screenshots and reproducible failures.

Suggested site types: Wikipedia (content), Hacker News (simple), Google Search (SPA-ish UI), GitHub (native dark), Reddit (complex UI), SVG/Canvas/chart pages, form-heavy pages, and a site with a pre-existing dark theme.

Verify initial flash, dark-to-light transitions, per-host persistence, all UI controls, hotkey delivery, image/video integrity, readable SVG icons, undo behavior, scrollbar and text contrast, and scrolling responsiveness. Do not mark this work complete without evidence from a real Safari runtime.