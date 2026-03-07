# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.8.0] - 2026-03-07

### Added
- Category quick-nav sidebar in the sound list — shows all categories for one-click scrolling, with a toggle in App settings to hide it
- Stream Deck category-level custom button icons (idle and playing), configurable via the new category settings modal
- Stream Deck global default button icons (idle, playing, and stop all) in the Stream Deck settings tab — applies to all buttons without a category override
- Stream Deck image picker now shows a red-tinted error placeholder and "File not found" label when a configured image path no longer exists on disk
- Broken Stream Deck image warning in the status bar, listing affected source names (e.g. "Default, Music, Ambience")
- Error badge on the Stream Deck tab in Settings and Category Settings modals when images in that scope are missing
- Stream Deck button titles and images now sync immediately when sounds or categories are renamed in the app
- Category settings modal (cog icon on each category) for renaming, hiding, restoring, and deleting categories

### Fixed
- Stream Deck "Show Category in Title" toggle now applies correctly to all existing buttons, not just newly created ones
- Stream Deck buttons were not updating when the library was refreshed via the toolbar button
- Refreshing the library now re-checks all configured Stream Deck image paths for load errors

## [0.7.0] - 2026-03-01

### Added
- Master volume slider in the device panel
- Auto-start with Windows option in App settings
- Launch minimized option — starts to the system tray instead of opening the window
- Per-folder soundboard settings stored in `rrr-soundboard.json` alongside the sounds folder, so category and sound customisations move with the folder
- Stream Deck plugin support with Play Sound and Stop All actions
- One-click Stream Deck plugin install and auto-update from within the app
- Stream Deck grid mode for browsing all sounds directly on the device
- Per-sound play count tracking
- Custom titlebar with minimize, maximize, and close controls
- Settings modal with App, Playback, and Stream Deck tabs
- VB-Cable audio routing setup guide in the Help modal
- Volume normalisation — automatically balances loud and quiet sounds to a consistent level
- Playback modes: Stop (default), Restart, and Overlap
- Close to notification tray option

### Changed
- Settings are now split between global (`rrr-settings.json`) and per-folder (`rrr-soundboard.json`) storage

### Fixed
- Audio device metadata display inconsistencies across sessions
- Removed debugging output that was reaching production builds
