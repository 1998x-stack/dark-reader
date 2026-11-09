# Architecture: Safari Dark Reader v2

## Product decision

The v1 prototype walked every DOM element, computed styles, inserted a growing list of overrides, and watched subtree mutations. This breaks down on CSS variables, complex gradients, pseudo-elements, shadow DOM, canvas, and very large SPAs. The v2 design deliberately stops reimplementing a CSS engine.

The **official Dark Reader 4.9.135 JavaScript API** handles styling. This independent Tampermonkey wrapper handles only preferences, keyboard shortcuts, automatic behavior, accessibility, and failures. Dark Reader is MIT-licensed and remains the upstream project; this repository is **not** the official extension.

## State machine

| Site mode | System | Site originally dark | Result |
| --- | --- | --- | --- |
| Auto | Light | Either | Off |
| Auto | Dark | No | On |
| Auto | Dark | Yes | Off |
| On | Either | Either | On (explicit override) |
| Off | Either | Either | Off |

Site mode is saved per hostname; sliders are global. A theme signature prevents redundant Dark Reader enable calls; sliders are debounced 100 ms. Root class/style changes are watched only when **Auto is disabled**, avoiding redundant subtree scanning. No image pixel extraction, analytics, or custom network requests are added by the controller.

## Reliability

- Pinned `@require`: `darkreader@4.9.135/darkreader.js`; missing dependency produces a visible error rather than claiming darkening succeeded.
- No third-party code is copied into this repository; it is fetched at install time by Tampermonkey. Pinning a version is **not** a substitute for SRI; this version has **no independently verified SHA-256**.
- Shortcuts use `addEventListener`, not replacement of website handlers; editable fields are ignored. Safari can intercept Cmd+Shift+B, so an alternative shortcut and always-visible UI are provided.
- The floating panel lives inside a ShadowRoot to reduce CSS interference. It uses standard buttons, keyboard focus styling, and `aria-pressed`.
- GM storage is preferred. If GM storage fails, preferences may be lost; localStorage is used only when GM APIs are absent.
- Native theme detection is a **heuristic** based on `color-scheme` and root/body luminance. Some SPA theme changes will evade it; site-level Off is the escape hatch.
- Excluded domains include Docs/Sheets/Slides, Maps, Figma, Canva, and Miro because complex editors may break.
- Safari's own Adaptive Dark Mode and other dark-mode extensions should not be combined with this controller.

## Release gates

1. Syntax and browser controller tests.
2. WebKit controller tests in CI (required, not silently skipped).
3. Actual macOS Safari + Tampermonkey + pinned CDN library (not run in this environment).
4. Visual and performance checks on representative live sites (not run in this environment).

See [verification](TEST_PLAN.md) and [gotchas](gotchas.md).