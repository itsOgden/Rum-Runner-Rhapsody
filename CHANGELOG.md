# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.8.0] - 2026-03-07

### Added
- Category quick-nav sidebar with App settings toggle
- Per-category Stream Deck button icons (idle/playing) via the category settings modal
- Global default Stream Deck icons (idle/playing/stop) in the Stream Deck settings tab
- Stream Deck image picker shows an error state when a configured path no longer exists
- Status bar warning for missing Stream Deck images, listing affected source names
- Error badge on the Stream Deck settings tab when images are missing
- Stream Deck button titles and images sync when sounds or categories are renamed
- Category settings modal (cog icon) for renaming, hiding, and deleting categories

### Fixed
- Stream Deck "Show Category in Title" toggle now applies to existing buttons, not just new ones
- Stream Deck buttons not updating after refreshing the library
- Library refresh now re-checks all Stream Deck image paths for errors

## [0.7.0] - 2026-03-01

### Added
- Master volume slider
- Auto-start with Windows
- Launch minimized option (starts to system tray)
- Per-folder soundboard settings saved in `rrr-soundboard.json` alongside your sounds
- Stream Deck plugin with Play Sound and Stop All actions
- One-click Stream Deck plugin install and auto-update
- Stream Deck grid mode for browsing sounds on the device
- Per-sound play count tracking
- Custom titlebar
- Settings modal with App, Playback, and Stream Deck tabs
- VB-Cable setup guide in the Help modal
- Volume normalisation
- Playback modes: Stop, Restart, Overlap
- Close to notification tray

### Changed
- Settings split into global (`rrr-settings.json`) and per-folder (`rrr-soundboard.json`) files

### Fixed
- Audio device metadata display inconsistencies
- Debugging output removed from production builds
