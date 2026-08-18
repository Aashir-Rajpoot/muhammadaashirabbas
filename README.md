# Aashir X — Digital Universe

A living interface for Muhammad Aashir Abbas. Real local time, live weather and approximate location drive a continuously shifting atmosphere (color, particles, lighting), while six existing projects are presented as explorable "portals" that open in a new tab.

## Structure
```
index.html          Boot sequence, hero, portals, about, closing, system panel
style.css            All styling — CSS custom properties driven live by app.js
app.js               RealityEngine and its submodules (see below)
manifest.json        PWA manifest
service-worker.js    Offline shell caching (never caches live weather)
assets/
  aashir-profile.jpeg   Profile photo — hero identity + favicon source
robots.txt
```

## Architecture — RealityEngine
A single shared state object (`Reality`) plus focused modules that read/write it:

- **ThemeEngine** — writes `--environment-primary/secondary/glow/void` CSS variables per time-of-day phase, with a weather override for rain/snow.
- **TimeEngine** — local clock, computes `dawn / day / sunset / night` from real sunrise/sunset (falls back to fixed hour bands if weather data is unavailable).
- **WeatherEngine** — [Open-Meteo](https://open-meteo.com) for live temperature/weather/wind/humidity and [BigDataCloud's reverse-geocode client API](https://www.bigdatacloud.com/) for a human-readable location — both free and keyless, so nothing sensitive is ever exposed client-side. Fails gracefully to local-time-only if location is denied or a request errors.
- **ParticleEngine** — the living background canvas: stars, rain, or snow, reacting to cursor position/velocity and wind speed, paused when the tab is hidden and disabled under `prefers-reduced-motion`.
- **GlyphEngine** — samples a large "A" glyph into a sparse particle field behind the hero.
- **CursorEngine** — custom cursor with an "ENTER" state over portals (desktop only).
- **NavigationEngine** — the secret radial nav orb and the System Diagnostic panel.
- **PortalEngine** — 3D hover-tilt light-follow, tap-to-flip on touch, `SHUFFLE WORLDS` (FLIP-technique reflow), and the launch transition.
- **EasterEngine** — double-click the name for a brief alternate palette, long-press/`A` key pulses the portrait, thunderstorms trigger a brief lightning flash.

## Deploying to GitHub Pages
1. Push this folder to a repository.
2. In repo Settings → Pages, set the source to the root of the default branch.
3. Swap `assets/aashir-profile.jpeg` for a different image any time — the path is stable.

## Notes
- No API keys are used or required anywhere in this project.
- All six portals link directly to the existing external URLs — no source code was merged in.
- Respects `prefers-reduced-motion` throughout and reduces particle density automatically on lower-powered devices.
