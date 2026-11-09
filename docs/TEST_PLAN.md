# Verification matrix

## Evidence as of 2026-11-09

The v2.0.1 controller regressions and an additional real-engine rendering test passed GitHub Actions on 2026-11-09. Linux WebKit is not equivalent to macOS Safari with the Tampermonkey extension; host permissions and script-world execution still require a manual check.

| Test | Status | Notes |
| --- | --- | --- |
| Node.js syntax check | **PASS (CI)** | `node --check safari-dark-reader.user.js` |
| Chromium mocked controller | **PASS: 10 tests (CI)** | `tests/test_userscript.py` |
| WebKit mocked controller | **PASS: 10 tests (CI)** | `tests/test_userscript.py` |
| Real Dark Reader 4.9.135 rendering | **PASS: 1 test × 2 engines (CI)** | `tests/test_real_engine.py` asserts that a white document is actually rendered dark in Chromium and WebKit |
| macOS Safari + Tampermonkey | **NOT RUN** | User's extension permissions, script injection, and real Safari remain untested |
| Cross-site CSS rendering, CPU, and memory | **NOT RUN** | Needs representative live websites |
| Tampermonkey self-update check | **NOT RUN** | Verify from published default-branch URL |

**Mock API tests alone do not prove real CSS transformation.** The new real-engine test does verify one light fixture on Linux Chromium/WebKit, but it cannot validate Safari extension permissions or production-site compatibility.

## Reproduce

```bash
node --check safari-dark-reader.user.js
python -m pip install playwright==1.57.0
python -m playwright install chromium webkit
REQUIRE_WEBKIT=1 python -m unittest discover -s tests -p 'test_userscript.py' -v
curl -fLSs https://cdn.jsdelivr.net/npm/darkreader@4.9.135/darkreader.js -o /tmp/darkreader-4.9.135.js
DARKREADER_LIBRARY_PATH=/tmp/darkreader-4.9.135.js REQUIRE_WEBKIT=1 python -m unittest discover -s tests -p 'test_real_engine.py' -v
```

Tests cover: default On regardless of system appearance; persisted Off and invalid preference fallback; Auto with light/dark OS appearance; native-dark skip in Auto; manual On override; keyboard toggling and per-site state; inputs protected from shortcut interception; theme sliders and persistence; GM storage; corrupt preference bounds; missing or throwing Dark Reader API; and avoiding redundant theme starts.

## Manual Safari acceptance checklist

Test with stable Safari and separately with Safari 27.3+ where available. Record exact Safari/macOS/Tampermonkey versions, whether WebKit Adaptive Dark is enabled, screenshots and reproducible failures.

Suggested site types: Wikipedia (content), Hacker News (simple), Google Search (SPA-ish UI), GitHub (native dark), Reddit (complex UI), SVG/Canvas/chart pages, form-heavy pages, and a site with a pre-existing dark theme.

Verify initial flash, dark-to-light transitions, per-host persistence, all UI controls, hotkey delivery, image/video integrity, readable SVG icons, undo behavior, scrollbar and text contrast, and scrolling responsiveness. Do not mark this work complete without evidence from a real Safari runtime.
## User-reported Safari entirely white

In macOS Safari, verify that the Tampermonkey extension has permission to access the current website (Safari > Settings > Extensions; use the Safari extension website permission controls). A userscript enabled in Tampermonkey's dashboard is not proof that Safari has injected it. Next, test `https://example.com/` and look for the bottom-left controls. No controls means no successful controller execution or an excluded domain. If controls report a dependency error, verify the pinned CDN is reachable. If the controls say On but the page remains light, inspect console errors and confirm whether Dark Reader injected `data-darkreader-mode` onto `<html>` in the Web Inspector. Saved per-host Auto/Off preferences survive upgrades. Collect Safari/macOS/Tampermonkey versions and the failing page URL before alleging a controller defect.
