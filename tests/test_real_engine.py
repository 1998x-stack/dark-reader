"""Actual Dark Reader 4.9.135 browser tests, not a mocked API.

Loads the pinned distribution as a regular script (equivalent to successful
@require execution), then runs the real userscript against a white page.
This does NOT emulate Safari extension website permissions or Tampermonkey.
"""
from __future__ import annotations

import os
import pathlib
import unittest

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'safari-dark-reader.user.js'
LIBRARY = pathlib.Path(os.environ.get('DARKREADER_LIBRARY_PATH', ''))
HTML = """<!doctype html><html><head><meta charset="utf-8">
<style>html,body{background:#fff!important;color:#111!important;}body{margin:20px}</style>
</head><body><main id="content">This page starts bright white.</main></body></html>"""


class RealEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.environ.get('DARKREADER_LIBRARY_PATH') or not LIBRARY.is_file():
            raise unittest.SkipTest('DARKREADER_LIBRARY_PATH not set; real engine unavailable')
        cls.playwright = sync_playwright().start()
        cls.browsers = []
        for name in ('chromium', 'webkit'):
            try:
                browser = getattr(cls.playwright, name).launch(headless=True)
                cls.browsers.append((name, browser))
            except Exception as error:
                if name == 'webkit' and os.environ.get('REQUIRE_WEBKIT') == '1':
                    raise RuntimeError('WebKit is required for real-engine integration') from error
                print(f'NOT RUN {name}: {error}')
        if not cls.browsers:
            raise RuntimeError('No browser available for real-engine integration')

    @classmethod
    def tearDownClass(cls):
        for _, browser in cls.browsers:
            browser.close()
        cls.playwright.stop()

    def test_real_engine_changes_light_page(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                context = browser.new_context(color_scheme='light')
                page = context.new_page()
                page.set_content(HTML)
                page.add_script_tag(path=str(LIBRARY))
                self.assertTrue(page.evaluate(
                    'typeof DarkReader !== "undefined" && typeof DarkReader.enable === "function"'
                ), 'Pinned Dark Reader does not expose expected global API')
                page.add_script_tag(path=str(SCRIPT))
                page.wait_for_function(
                    'document.documentElement.getAttribute("data-darkreader-mode") === "dynamic"',
                    timeout=12000
                )
                page.wait_for_function(
                    '''() => {
                      const c = getComputedStyle(document.body).backgroundColor;
                      const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c);
                      return !!m && Math.max(+m[1], +m[2], +m[3]) < 180;
                    }''',
                    timeout=12000
                )
                self.assertTrue(page.locator('#sdr-control-host').count())
                context.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
