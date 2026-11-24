# Overtone

A mod layer for the official Spotify desktop client on Windows: a theme engine with built-in themes and a live editor, with more features to come. Playback, login and the catalogue stay Spotify's own; Overtone only adds a layer on top.

For personal use. Modifying the Spotify client is against Spotify's terms of service. Overtone never redistributes Spotify's files and never patches them on disk.

## Install

1. Install Spotify from [spotify.com/download](https://www.spotify.com/download/). The Microsoft Store version can't be modded.
2. Download `overtone.exe` from the [latest release](https://github.com/booomxd/overtone/releases/latest) and put it anywhere, for example on your desktop.
3. Open Spotify by running `overtone.exe` instead of Spotify. If Spotify is already open, Overtone restarts it once.

Windows may warn that the app is from an unknown publisher, because it isn't code-signed. Choose **More info → Run anyway**, or build it yourself (see below).

## Using it

- Click the **O** button next to your profile picture, or press **Ctrl+Shift+O**, to open the theme editor.
- Pick a built-in theme: Spotify, Midnight, Rosé, Cocoa, Frost, Ember, Amoled or Paper (light).
- Change any colour, the corner radius or the font; changes apply live and are saved.
- **Accent from album art** tints buttons and progress bars with the colour of the song that's playing.
- **Save as…** keeps your edits as a new theme. **Copy theme** and **Paste theme** share themes as text, so friends can send you theirs.

Settings live in Spotify's own storage, so they survive restarts and Spotify updates.

## How it works

1. **Launcher (`src/main.rs`, Rust).** Starts the installed Spotify (`%APPDATA%\Spotify`) with a Chrome DevTools Protocol port on `127.0.0.1`, injects the runtime into Spotify's UI page, and registers it to run again on every reload. It stays running in the background, with no window, until Spotify exits. No Spotify files are modified, so Spotify updates can't wipe the mod.
2. **Runtime (`runtime/overtone.js`, runs inside Spotify).** The theme engine and the editor panel. Spotify's UI is coloured by CSS variables in its `@layer encore` stylesheet (`--background-base`, `--text-base`, `--essential-bright-accent` and others), so a theme is a set of variable overrides; Overtone's rules are unlayered, which makes them win without fighting selectors.

Problems are logged to `%APPDATA%\Overtone\launcher.log`.

## Build

```
cargo build --release
```

The exe is `target\release\overtone.exe`; the runtime is embedded in it. Pushing a tag like `v0.2.0` builds and publishes a release.

## Findings (Spotify 1.3.10.2586, November 2026)

- `--remote-debugging-port` works; the UI page is `https://xpui.app.spotify.com/index.html` (Chromium 156).
- `__webpack_modules__` is a global, React drives the UI, and colours come from CSS variables in `@layer encore`, per colour set (`.encore-base-set`, `.encore-bright-accent-set`, …).
- The UI ships as `Apps/xpui.spa` (a zip of 644 files), loaded by `index.html` and `xpui-snapshot.js`.

## Roadmap

- [x] Launcher: start Spotify with the debugging port, inject, re-inject on reload
- [x] Theme engine, built-in themes, live editor, album-art accent
- [ ] Runtime: module finder and plugin system
- [ ] Plugins: global hotkeys, queue tools, local listening stats, Discord rich presence
- [ ] Glass and compact layouts

## Security

While Spotify runs under Overtone, it listens on a local debugging port, and any program on this PC could use it to control Spotify. The port only accepts connections from this PC, Chromium rejects connections from web pages, and it closes when Spotify exits.

## License

MIT, see [LICENSE](LICENSE).
