# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.8.0] - 2026-03-07

### App

#### Added
- Category quick-nav sidebar
- Category settings modal
- Patch notes viewer

### Stream Deck

#### Added
- Per-category icons
- Global default icons
- Button sync on sound/category rename

#### Fixed
- "Show Category in Title" for existing buttons
- Buttons not updating after library refresh
- Library refresh re-checks image paths

## [0.7.0] - 2026-03-01

### App

#### Added
- Master volume slider
- Auto-start with Windows
- Launch minimized
- Per-folder soundboard settings (`rrr-soundboard.json`)
- Per-sound play count tracking
- Custom titlebar
- Settings modal
- VB-Cable setup guide
- Volume normalisation
- Playback modes: Stop, Restart, Overlap
- Close to notification tray

#### Changed
- Settings split into global (`rrr-settings.json`) and per-folder (`rrr-soundboard.json`) files

#### Fixed
- Audio device metadata display inconsistencies
- Debugging output removed from production builds

### Stream Deck

#### Added
- Plugin with Play Sound and Stop All actions
- One-click plugin install and auto-update
- Grid mode
