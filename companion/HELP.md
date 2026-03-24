# 1stPass

This module connects to [1stPass](https://1stpass.app) — a professional LTC timecode reader and event logger for video production. Log markers and titles in real time, synced to LTC timecode, and export directly to Final Cut Pro.

## Configuration

- **Host**: IP address of the machine running 1stPass (default: `localhost`)
- **Port**: WebSocket port for the Companion relay server (default: `19455`)

## Actions

- **Create Marker**: Creates a marker at the current timecode. By default uses the button's text as the marker name. Switch to "Custom" to enter your own text.
- **Next Title**: Records the next title in the sequence at the current timecode

## Requirements

- [1stPass](https://apps.apple.com/us/app/1stpass/id6760574473) app running on macOS
