# 1stPass

This module connects to [1stPass](https://1stpass.app) — a professional LTC timecode reader and event logger for video production. Log markers and titles in real time, synced to LTC timecode, and export directly to Final Cut Pro.

## Configuration

- **Host**: IP address of the machine running 1stPass (default: `localhost`)
- **Port**: WebSocket port for the Companion relay server (default: `19455`)

## Actions

- **Create Marker** — Create a marker at the current timecode. By default uses the button's text as the marker name; switch to "Custom" to enter your own. Optional Type (Standard / To Do / Chapter) and custom color.
- **Next Title** — Record the next title in the sequence at the current timecode.
- **Select Camera** — Set a camera (1–99) to standby (preview). Does nothing if that camera is already in standby.
- **Camera Cut** — Cut to the standby camera (promotes standby to program) and record to the timeline.
- **Camera Fade** — Fade to the standby camera and record the transition using the event's configured fade duration.

## Feedbacks

- **Connection Status** — Boolean feedback that changes the button appearance based on whether the module is currently connected to 1stPass.

## Variables

- `connection_status` — Current connection state (`Connected`, `Disconnected`, `Bad config`).
- `last_marker_timecode` / `last_marker_text` — Most recent marker created.
- `last_title_timecode` — Most recent title recorded.
- `last_cut_timecode` / `last_fade_timecode` — Most recent cut/fade timecodes.
- `standby_camera` — Name of the camera currently in standby (preview).
- `last_error` — Most recent error reported by the server or by the module (e.g. dropped commands when disconnected).

## Requirements

- [1stPass](https://apps.apple.com/us/app/1stpass/id6760574473) app running on macOS, with the Companion relay enabled.
