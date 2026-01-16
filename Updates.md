# Changelog

## 1.3.0

- **Feature: Localization (i18n)**: Fully translated into German (Deutsch) and English.
- **Feature: Paint Tool**: Added a paint brush tool to manually colorize specific areas of the token on Background and Shadow layers.
- **Improvement: Smart Button Placement**: The Token Studio button now adapts its position based on the game system to maximize compatibility and minimize clutter:
  - **D&D 5e**: Strictly integrated into the "Three Dots" context menu on Actor sheets (no header clutter).
  - **PF2e**: Appears on the character profile image.
  - **Universal**: Fallback to window header for other systems if profile injection fails.
- **Bugfix**: Fixed `FilePicker` deprecation warning for Foundry V13.
- **Bugfix**: Fixed "Shadow" and "Background" FX colors not updating correctly.

## 1.2.0

- **Universal Button Injection**: Completely rewrote the connection logic using a `MutationObserver` to ensure the Token Studio button appears reliably on all game systems (Daggerheart, D&D 5e, etc.).
- **Smart Placement Strategy**:
  - **Pathfinder 2e**: Shows a convenient "overlay button" on the character profile image.
  - **D&D 5e**: Integrates directly into the "Three Dots" context menu and the window header (profile button disabled to avoid conflicts).
  - **Other Systems**: Attempts to place buttons in the window header and on the profile image for maximum compatibility.
- **UX Improvements**:
  - **Profile Button**: Now semi-transparent and always visible (glows on hover), ensuring you can find it easily.
  - **Icon Update**: Changed to `fa-user-pen` (User with Pen) to clearly indicate "Token Editing".
- **Technical**: Added support for AppV2 sheets (like the new D&D 5e sheet) and correctly identified synthetic actors.

## 1.1.4

(Skipped for internal testing)

## v1.1.3

- **Bugfix**: Fixed `TypeError: Cannot read properties of undefined (reading 'upload')` when saving tokens.
- **Bugfix**: Resolved issue where FilePicker would open twice.

## v1.1.2

- **Bugfix**: Resolved issues with the FilePicker (`constructor` error and `offsetWidth` error) to ensure compatibility with all Foundry versions.

## v1.1.1

- **Bugfix**: Fixed a critical crash (ReferenceError) when opening the File Picker on some Foundry versions.

## v1.1.0

- **Dynamic Token Ring**: Pop-out effects are now possible even outside of normal token boundaries!

## v1.0.0

- **Initial Release**: Launched Phils Token Studio!
- **Visual Editor**: Create beautiful tokens with a powerful, real-time WYSIWYG editor.
- **Layer System**: Work with Background, Character, and Frame layers independently.
- **Smart Eraser**: Context-aware eraser that works on specific layers.
- **Modern UI**: Sleek, dark-themed interface designed for Foundry V12 & V13.
- **File Support**: Drag & Drop images directly or browse your Foundry server.
