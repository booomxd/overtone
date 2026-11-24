# Overtone

A personal mod layer for the official Spotify desktop client on Windows: a theme engine with a live editor, and plugins for features Spotify doesn't have. Playback, login and the catalogue stay Spotify's own; Overtone only adds a layer on top.

Private and for personal use. Modifying the Spotify client is against Spotify's terms of service. Overtone never redistributes Spotify's files and never patches them on disk.

## How it works

1. **Launcher (Rust).** Starts the installed Spotify (`%APPDATA%\Spotify`, the classic installer, not the Microsoft Store build) with a Chrome DevTools Protocol port bound to `127.0.0.1`, injects the runtime into Spotify's UI page, and re-injects it whenever the page reloads. No Spotify files are modified, so Spotify updates can't wipe the mod; only changes to Spotify's internals can break a plugin.
2. **Runtime (TypeScript, runs inside Spotify).** Finds Spotify's internal modules through `__webpack_modules__` by fingerprint rather than by name, so minified renames don't break it. Hosts the plugin system and stores settings.
3. **Theme engine.** Spotify's UI is coloured by CSS variables (`--background-base` and others), so a theme is mostly a set of variable overrides plus a few layout rules. Includes built-in themes, a live editor for colours, fonts, blur, corner radius and density, and optional accent colours from the current album art.

## Findings (Spotify 1.3.10.2586, November 2026)

- `--remote-debugging-port` works; the UI page is `https://xpui.app.spotify.com/index.html` (Chromium 156).
- `__webpack_modules__` is a global, React drives the UI, and colours come from CSS variables.
- The UI ships as `Apps/xpui.spa` (a zip of 644 files), loaded by `index.html` and `xpui-snapshot.js`.

## Roadmap

- [ ] Launcher: start Spotify with the debugging port, inject, re-inject on reload, clean shutdown
- [ ] Runtime: module finder, plugin system, settings
- [ ] Theme engine and live editor, built-in themes
- [ ] Plugins: global hotkeys, queue tools, local listening stats, Discord rich presence

## Security

While Overtone runs, Spotify listens on a local debugging port, and any program on this PC could use it to control Spotify. The launcher binds it to `127.0.0.1` only and closes it when Overtone exits.
