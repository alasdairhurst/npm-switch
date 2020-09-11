# Roadmap

## Features
- Editable config in the UI
- - Can select new files and maybe edit files
- - Can configure notifications on and off
- - Can configure tray icon colours per .npmrc
- - Can configure names of .npmrc files
- - Can change target .npmrc
- Interchangable and fully compatible (interactive) CLI and UI
- works on mac, linux and windows
- - Builds available on github.
- - CLI available from NPM
- works with light and dark modes

## Implementation details
- Core reusable npm-switch component
- nsw package (reserved on npm)
- Ensure that existing any existing .npmrc is used by default & backed up on first usage
- CI pipeline for builds/versioning on github
- Changelog

## Additional features which may make it into addons or side-projects
- Registry connectivity indicator(s)
- Shims for npm to catch registry connectivity issues before continuing with installs
- powerlevel10k prompt addon for connectivity/current registry