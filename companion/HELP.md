# 1stPass

This module connects to [1stPass](https://1stpass.app) — a professional LTC timecode reader and event logger for video production. Log markers and titles in real time, synced to LTC timecode, and export directly to Final Cut Pro.

## Configuration

- **Host**: IP address of the machine running 1stPass (default: `localhost`)
- **Port**: WebSocket port for the Companion relay server (default: `19455`)

## Actions

- **Create Marker** — Create a marker at the current timecode. By default uses the button's text as the marker name; switch to "Custom" to enter your own. Optional Type (Standard / To Do / Chapter) and custom color.
- **Next Title** — Record the next title in the sequence at the current timecode.
- **Select Camera** — Set a camera (1–99) to standby (preview). Does nothing if that camera is already in standby, or if 1stPass has no camera with that number.
- **Camera Cut** — Cut to the standby camera (promotes standby to program) and record to the timeline.
- **Camera Fade** — Fade to the standby camera and record the transition using the event's configured fade duration.

### Camera control

These five reach the _physical camera_ bound to that cell in 1stPass, rather than the switcher. Each takes only a camera number.

- **Camera Focus (AF push)** — One-shot autofocus. The camera must be in **manual focus**: this is the AF-ON gesture, and a body already autofocusing refuses it.
- **Camera EV +** / **Camera EV −** — Move exposure compensation one step.
- **Camera ISO +** / **Camera ISO −** — Move ISO one step.

The steps walk the value ladder the camera itself publishes, so a press moves to the next value that body actually offers — not a number we guessed — and `+` always means brighter. The camera has to have a body bound to it in 1stPass (Cameras → Edit Camera → Control Source); a cell with nothing bound does nothing.

A press that cannot be honored is **not** an error and leaves `last_error` alone — the module logs why and the button is unaffected. The usual reasons:

- No camera body bound to that cell, or the body is not answering.
- The camera's current mode owns the setting. A LUMIX in Creative Video has no exposure compensation at all, and neither does the app.
- The setting is already at the end of its range.
- The body is in AF, for a focus push.

## Presets

The **Cameras** category has a ready-made button for each camera, 1 through 20. Drag one onto a button and it is finished — no options to fill in.

Each preset combines the _Select Camera_ action with the _Camera Tally_ feedback, so pressing the button arms that camera and the button itself shows what the camera is doing. Cameras your show does not have stay blank and do nothing when pressed.

## Feedbacks

- **Connection Status** — Boolean feedback that changes the button appearance based on whether the module is currently connected to 1stPass.
- **Camera Tally** — Colors _and labels_ the button from 1stPass. The only thing to set is the camera number:
  - **Program** — red background.
  - **Preview** — green, or blue if that camera is set to blue preview in 1stPass (Cameras → Edit Camera → Preview Tally, for red/green color blindness). Program is always red.
  - **Off air** — dark background with the camera's own color on the text, so a tally light watching the button goes out.
  - **No such camera** — blank and black.

  The button's label comes from the camera name in 1stPass, so renaming a camera in the app renames the button. Untick **Use camera name from 1stPass** to keep your own label instead.

This makes the button work with tally lights that mirror a Stream Deck button's color, such as Companion Buddy: point one at a camera button and it becomes that camera's tally.

## Variables

- `connection_status` — Current connection state (`Connected`, `Disconnected`, `Bad config`).
- `last_marker_timecode` / `last_marker_text` — Most recent marker created.
- `last_title_timecode` — Most recent title recorded.
- `last_cut_timecode` / `last_fade_timecode` — Most recent cut/fade timecodes.
- `program_camera` — Name of the camera currently on program.
- `standby_camera` — Name of the camera currently in standby (preview).
- `camera_1_name` … `camera_20_name` — Camera names as configured in 1stPass. Empty for camera numbers the show does not have.
- `camera_1_state` … `camera_20_state` — `program`, `preview`, `idle`, or empty when there is no such camera.
- `last_error` — Most recent error reported by the server or by the module (e.g. dropped commands when disconnected).

`program_camera`, `standby_camera` and the `camera_*` variables follow 1stPass live, including cuts made in the app itself. They are cleared while the module is disconnected, so nothing on a surface keeps showing a state that has moved on.

## Requirements

- [1stPass](https://apps.apple.com/us/app/1stpass/id6760574473) app running on macOS, with the Companion relay enabled.
- The camera control actions (focus, EV, ISO) need 1stPass 1.2.0 build 94 or newer, and a camera with a control source bound to it. Against an older build the app answers `unknown_command`, which does land in `last_error`.
- Tally feedback and the camera presets need 1stPass 1.2 or newer. Against an older build the camera buttons stay blank and the module logs a warning saying so; everything else still works.
