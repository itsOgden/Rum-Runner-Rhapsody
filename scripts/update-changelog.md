# Update Changelog

Update the project changelog and version numbers with the changes listed below.

## Steps

1. Read `CHANGELOG.md` and `package.json` to identify the current version.

2. Determine the semver bump from the changes below:
   - **patch** — bug fixes only, no new features or breaking changes
   - **minor** — new features added, backwards-compatible
   - **major** — breaking changes or significant redesign

3. Compute the new version (e.g. 0.8.0 → 0.8.1 for patch, 0.9.0 for minor).

4. Update `CHANGELOG.md`:
   - Insert a new block **at the top**, immediately after the header/intro text, before the previous most-recent release
   - Use today's date in `YYYY-MM-DD` format
   - Format the block exactly as:
     ```
     ## [X.Y.Z] - YYYY-MM-DD

     ### Added
     - …

     ### Changed
     - …

     ### Fixed
     - …
     ```
   - Only include sections that have entries — omit empty sections entirely
   - Each item is a single concise sentence starting with a capital letter, no trailing period

5. Update `package.json`: set `"version"` to the new version string.

6. Update `packages/rrr-streamdeck/com.pdog1.rum-runner-rhapsody.sdPlugin/manifest.json`:
   - Set `"Version"` to the 4-part form `X.Y.Z.0`

## Changes for this release

<!-- Replace the lines below with the actual changes before running this prompt -->

Added:
-

Changed:
-

Fixed:
-
