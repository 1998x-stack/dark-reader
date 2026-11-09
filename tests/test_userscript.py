"""Browser integration contract tests with a mocked DarkReader API.

These assert our controller behavior, not the actual upstream rendering engine.
Use playwright install chromium webkit to run both engines.
"""
from __future__ import annotations

import contextlib
import http.server
import pathlib
import os
import socketserver
import threading
import unittest
from playwright.sync_api import sync_playwright

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'safari-dark-reader.user.js'
MOCK_LIBRARY = r"""
window.__drCalls = [];
window.DarkReader = {
  enable(theme) { window.__drCalls.push({ action: 'enable', theme }); },
  disable() { window.__drCalls.push({ action: 'disable' }); },
  setFetchMethod(fn) { window.__drCalls.push({ action: 'setFetchMethod', available: typeof fn === 'function' }); }
};
"""
HTML = '''<!doctype html><html><head><meta charset="utf-8"><title>Test page</title>
<style>html,body{color-scheme:light}body{background:#fff;color:#161616}main{padding:8px}</style>
</head><body><main><input id="entry" placeholder="Input"><h1>Readable fixture</h1></main></body></html>'''
NATIVE = '''<!doctype html><html><head><style>html{color-scheme:dark}body{background:#15171d;color:#eee}</style>
</head><body><h1>Native mode</h1></body></html>'''

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        content = (NATIVE if self.path.startswith('/native') else HTML).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)
    def log_message(self, *args):
        pass

@contextlib.contextmanager
def local_server():
    with socketserver.ThreadingTCPServer(('127.0.0.1', 0), Handler) as server:
        server.daemon_threads = True
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_address[1]}'
        finally:
            server.shutdown()

class ScriptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.webserver = local_server()
        cls.url = cls.webserver.__enter__()
        cls.browsers = []
        for name in ['chromium', 'webkit']:
            try:
                browser = getattr(cls.playwright, name).launch(headless=True, **({'executable_path': '/usr/bin/chromium', 'args': ['--no-sandbox']} if name == 'chromium' and pathlib.Path('/usr/bin/chromium').exists() else {}))
                cls.browsers.append((name, browser))
            except Exception as error:
                if os.environ.get('REQUIRE_WEBKIT') == '1' and name == 'webkit':
                    raise RuntimeError('WebKit required by CI but not installed') from error
                print(f'NOT RUN {name}: {error}')
        if not cls.browsers:
            raise RuntimeError('No browser available for regression tests')

    @classmethod
    def tearDownClass(cls):
        for _, browser in cls.browsers:
            browser.close()
        cls.webserver.__exit__(None, None, None)
        cls.playwright.stop()

    def open_page(self, browser, scheme='dark', path='/light', library=True, seed=None):
        context = browser.new_context(color_scheme=scheme)
        page = context.new_page()
        page.set_content(NATIVE if path == '/native' else HTML)
        page.evaluate('''seed => { const store = new Map(Object.entries(seed || {})); Object.defineProperty(window,'localStorage',{ configurable:true, value: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k,v) => store.set(k,String(v)) } }); }''', seed or {})
        if library:
            page.add_script_tag(content=MOCK_LIBRARY)
        page.add_script_tag(path=str(SCRIPT))
        page.wait_for_function('document.getElementById("sdr-control-host") !== null')
        return context, page

    def test_default_dark_on_and_cycle_recovery(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                # Default On must start dark even when macOS prefers light.
                ctx, page = self.open_page(browser, scheme='light')
                self.assertEqual(page.evaluate('window.__drCalls.filter(x => x.action === "enable").length'), 1)
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).theme.brightness'), 100)
                self.assertEqual(page.locator('#sdr-control-host .bar button').first.get_attribute('data-mode'), 'on')
                self.assertIsNone(page.evaluate('localStorage.getItem("safari-dark-reader:v2:site:")'))
                page.keyboard.press('Alt+Shift+d')  # On -> Off
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'disable')
                self.assertEqual(page.evaluate('JSON.parse(localStorage.getItem("safari-dark-reader:v2:site:"))'), 'off')
                page.keyboard.press('Alt+Shift+d')  # Off -> Auto
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'disable')
                page.emulate_media(color_scheme='dark')
                page.wait_for_timeout(80)
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                page.keyboard.press('Alt+Shift+d')  # Auto -> On
                self.assertEqual(page.locator('#sdr-control-host .bar button').first.get_attribute('data-mode'), 'on')
                ctx.close()

    def test_native_dark_protection_and_manual_override(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser, path='/native')
                # On explicitly overrides native-dark protection, including by default.
                self.assertEqual(page.evaluate('window.__drCalls.filter(x => x.action === "enable").length'), 1)
                page.keyboard.press('Alt+Shift+d')  # On -> Off
                page.keyboard.press('Alt+Shift+d')  # Off -> Auto
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'disable')
                self.assertEqual(page.evaluate('window.__drCalls.filter(x => x.action === "enable").length'), 1)
                page.keyboard.press('Alt+Shift+d')  # Auto -> On
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                ctx.close()

    def test_system_light_and_persistent_site_setting(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser, scheme='light')
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                page.keyboard.press('Alt+Shift+d')  # On -> Off
                stored = page.evaluate('localStorage.getItem("safari-dark-reader:v2:site:")')
                self.assertEqual(stored, '"off"')
                ctx.close()
                # A saved Off preference survives script upgrades and initial startup.
                ctx, page = self.open_page(browser, scheme='light', seed={
                    'safari-dark-reader:v2:site:': stored,
                })
                self.assertEqual(page.evaluate('window.__drCalls.filter(x => x.action === "enable").length'), 0)
                self.assertEqual(page.locator('#sdr-control-host .bar button').first.get_attribute('data-mode'), 'off')
                page.keyboard.press('Alt+Shift+d')  # Off -> Auto
                self.assertEqual(page.evaluate('window.__drCalls.filter(x => x.action === "enable").length'), 0)
                page.emulate_media(color_scheme='dark')
                page.wait_for_timeout(80)
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                ctx.close()

    def test_input_focus_keeps_keyboard_shortcuts(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser)
                page.locator('#entry').focus()
                page.keyboard.press('Alt+Shift+d')
                self.assertIsNone(page.evaluate('localStorage.getItem("safari-dark-reader:v2:site:")'))
                ctx.close()

    def test_settings_and_debounce(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser)
                page.locator('#sdr-control-host button[aria-label="打开设置"]').click()
                self.assertTrue(page.locator('#sdr-settings').is_visible())
                page.locator('#sdr-settings input[aria-label="亮度"]').evaluate("el => { el.value='115'; el.dispatchEvent(new Event('input',{bubbles:true})); }")
                page.wait_for_timeout(220)
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).theme.brightness'), 115)
                self.assertEqual(page.evaluate('JSON.parse(localStorage.getItem("safari-dark-reader:v2:theme")).brightness'), 115)
                page.locator('#sdr-settings button[data-mode="off"]').click()
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'disable')
                self.assertFalse(page.locator('#sdr-control-host .bar button[aria-pressed="true"]').count())
                ctx.close()

    def test_system_theme_changes_without_duplicate_runs(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser)
                page.emulate_media(color_scheme='light')
                page.wait_for_timeout(80)
                # Explicit On must not turn off when macOS changes appearance.
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                page.keyboard.press('Alt+Shift+d')  # On -> Off
                page.keyboard.press('Alt+Shift+d')  # Off -> Auto
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'disable')
                page.emulate_media(color_scheme='dark')
                page.wait_for_timeout(80)
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                before = page.evaluate('window.__drCalls.length')
                page.emulate_media(color_scheme='dark')
                page.wait_for_timeout(80)
                self.assertEqual(page.evaluate('window.__drCalls.length'), before)
                ctx.close()

    def test_cmd_shortcut_and_corrupt_preferences(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                seed = {
                    'safari-dark-reader:v2:site:': '"invalid"',
                    'safari-dark-reader:v2:theme': '{"brightness":500,"contrast":2,"sepia":-50}',
                }
                ctx, page = self.open_page(browser, seed=seed)
                last = page.evaluate('window.__drCalls.at(-1).theme')
                self.assertEqual(last, {'brightness': 125, 'contrast': 70, 'sepia': 0})
                page.keyboard.press('Meta+Shift+b')
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'disable')
                page.keyboard.press('Meta+Shift+b')
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                ctx.close()

    def test_gm_storage_preferred_over_site_localstorage(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx = browser.new_context(color_scheme='light')
                page = ctx.new_page()
                page.set_content(HTML)
                page.add_script_tag(content=MOCK_LIBRARY)
                page.add_script_tag(content="window.__gmStore = {}; window.GM = { async getValue(key, fallback) { return key.endsWith('site:') ? 'on' : fallback; }, async setValue(key, value) { window.__gmStore[key] = value; } };")
                page.add_script_tag(path=str(SCRIPT))
                page.wait_for_function('document.getElementById("sdr-control-host") !== null')
                self.assertEqual(page.evaluate('window.__drCalls.at(-1).action'), 'enable')
                page.keyboard.press('Alt+Shift+d')
                page.wait_for_function('window.__gmStore["safari-dark-reader:v2:site:"] === "off"')
                ctx.close()

    def test_throwing_darkreader_fails_closed(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser)
                page.keyboard.press('Alt+Shift+d')  # On -> Off
                page.evaluate("() => { window.DarkReader.enable = () => { throw Error('theme failed') } }")
                page.keyboard.press('Alt+Shift+d')  # Off -> Auto attempts enable and fails
                self.assertIn('错误', page.locator('#sdr-control-host .bar button').first.inner_text())
                ctx.close()

    def test_missing_library_is_visible_not_uncaught(self):
        for name, browser in self.browsers:
            with self.subTest(browser=name):
                ctx, page = self.open_page(browser, library=False)
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.keyboard.press('Alt+Shift+d')
                self.assertFalse(errors)
                self.assertIn('sdr-control-host', page.content())
                ctx.close()

if __name__ == '__main__':
    unittest.main(verbosity=2)
