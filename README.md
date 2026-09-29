# companion-module-1stpass-1stpass

A [Bitfocus Companion](https://bitfocus.io/companion) module for [1stPass](https://1stpass.app) — a professional LTC timecode reader, multicamera console and event logger for macOS.

Talks to the app over a WebSocket on the local network, so a Stream Deck drives the console and the console colors the Stream Deck back.

## Features

**Logging**

- Create timecode markers from the button's own text, or from text you enter, with optional type (Standard / To Do / Chapter) and color
- Record titles in sequence

**Switching**

- Set a camera to preview, then cut or fade to it — the transition is recorded to the timeline
- **Tally and camera name on the button**: red on program, green or blue on preview following that camera's own setting, dark off air, with the label taken from the camera name in 1stPass. A ready-made preset per camera, 1 through 20, that needs nothing configured
- Program and preview colors match what a Slate's LED strip emits, so a tally light mirroring a Stream Deck key agrees with the lamp beside it

**Camera control** — reaches the physical camera bound to a cell, not the switcher

- One-shot autofocus push
- Iris, shutter, exposure compensation, ISO and color temperature, one step per press
- Shading: master pedestal, both white-balance shifts, saturation and color phase

Each step walks the value ladder the camera itself publishes, so a press moves to the next value that body actually offers. A press a camera cannot take — nothing bound, the mode owns the setting, no such control on that body, the end of a range — is reported and does nothing, rather than raised as an error.

**Status**

- Connection status feedback, and variables for the last marker, title, cut and fade, the program and preview camera names, and every camera's name and state

See [companion/HELP.md](companion/HELP.md) for setup, every action, and what each refusal means.

## Development

This repo pins its package manager, so use Corepack rather than installing Yarn separately. Node 22 is what `engines` and CI expect.

```bash
corepack enable        # provides the pinned yarn 4.12.0
yarn install
yarn build             # rimraf dist && tsc
yarn dev               # tsc --watch
yarn lint
yarn package           # build + companion-module-build
```

**Rebuilding under a running Companion:** if Companion has this directory on its `--extra-module-path`, it watches it and hot-reloads on change. `yarn build` deletes and rewrites every file in `dist/`, which can fire that watcher faster than it can settle and leave the connection restarting on a loop. Disable the connection in Companion before building and re-enable it after — and if buttons go dead right after a build, restart the module rather than suspecting the code.

## License

MIT
