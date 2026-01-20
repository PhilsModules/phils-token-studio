## v1.6.0

- **Feature (Global):** Dynamic Ring selection by the GM now updates the Global Core Setting and automatically reloads Foundry to apply changes.
- **Feature (UI):** Enforced Tool Exclusivity. Enabling Chroma Key now disables Eraser/Paint/PopOut, and vice versa.
- **Feature (Visuals):** Added a visual indicator for the brush size cursor.
- **Feature (Visuals):** Added a transparent view mode for artwork.
- **Improvement (UX):** Tools now context-check the active tab/layer for smoother switching.
- **Chroma Key**: Moved tool position and refined logic for better usability.
- **Fix:** Resolved "Clear All" persistence bug in Pop-Out tool.
- **Fix:** "Save Token" now correctly persists Dynamic Ring selection.
- **Localization:** Added translations for notifications and warning texts.
- **Refactor: Visual Guide (Dynamic Ring)**: Perfect alignment with mask, solid white line style, and locked interaction.
- **UI Polishing**: Improved slider visibility.

## v1.5.2

- **Feature: Tidy Sheets Integration**: Added full support for Tidy 5e Sheets. The "Token Studio" button now correctly appears in the "Toggle Controls" dropdown menu.

## v1.5.1

- **Bugfix: Missing Button**: Fixed an issue where the "Open Token Studio" button would disappear after closing the window or re-rendering the character sheet (specifically reported in Twilight 2000, but affects all systems).

## v1.5.0

- **Feature: Smart Scaling**: Implemented size-based scaling logic.
  - "Small" creatures (0.8 Base Scale) are now correctly sized on the grid while maintaining high-resolution art.
  - "Tiny" and "Medium+" tokens maintain standard 1:1 scaling.
- **Refactor: Decoupled Scaling**: Separated `texture.scale` (Grid Size) from `ring.subject.scale` (Internal Zoom).
  - Texture Scale now respects the Smart Scale factor.
  - Subject Scale stays locked to the Export Resolution (e.g. 200%) for crisp rendering.
- **UX: Visual Guide**: The white dashed line in the editor now represents the "Inner Ring" (Safe Zone, 66%), matching the actual clipping mask.
- **UX: Slider Limits**: Increased maximum scale slider limit from 5 to 20 for extreme zooming.
- **UI**: Removed confusing export options (120%, 150%), keeping only "None" (100%) and "Large" (200%).
- **Fix: PF2e Integration**: Added `flags.pf2e.autoscale` handling to prevent the system from overriding custom scaling.
- **Fix: NPC Prototypes**: Resolved an issue where saving an unlinked token (Monster) would not update the Sidebar Actor (Prototype Token).

- **Bugfix: ReferenceError**: Fixed a crash (`step is not defined`) when using Undo/Redo or saving history in `token-studio.js`.
- **Bugfix: Token Layer Painting**: Fixed an issue where painting on the Background and Frame layers in Token View was invisible or misaligned.
- **Improvement: Layer Rendering Order**:
  - Token Character now draws _under_ the Frame to prevent bleeding.
  - Frame Paint now draws _over_ everything to ensure visibility.
- **Refactor: Chroma Key**: Now applies to the active layer (Background, Character, Frame) instead of always the Portrait.
- **Bugfix: Chroma UI**: Fixed the tolerance number display not syncing with the slider.
- **Bugfix: Tool Toggles**: Activating Eraser or Pop-Out now correctly deactivates the Paint tool.
- **Feature: Avatar Shadow**: Implemented shadow/blur rendering for the Avatar view.
- **UX**: Hidden "Frame Style" controls in Avatar View.
- **UX**: The 'Dynamic Token Ring' option is now enabled by default for new tokens.
- **Improvement: Scaling**: The "Export Spacing" (Padding) now keeps the visual size of the Token constant (matching the grid), and only extends the canvas for pop-outs.
- **Bugfix: Pop-Out Tool**: Fixed rendering issue where the Pop-Out mask would disappear or become invisible. Restored the "milky" visual overlay for better usability.
- **Feature: Background Color Reset**: Added ability to right-click on the Background Color input to reset it to transparent.
- **Bugfix: Prototype Token Update**: Fixed an issue where scaling settings were not correctly applied to newly created tokens (Unlinked/Synthetic tokens now correctly update their sidebar Prototype).
- **Improvement: UI Locking**: Implemented a direct update method for Prototype Tokens to prevent Foundry from "locking" the aspect ratio when X/Y scales are identical.
- **Bugfix: Dynamic Ring Scaling**: Removed artificial "Anti-Scale" compensation on export, ensuring that the token's visual size is exactly as configured in the editor (WYSIWYG).
- **Persistence**: Fixed session saving/restoring for Background Paint and Frame Paint layers.

## v1.4.2

- **Bugfix: Window Sizing**: Fixed an issue where the Editor Window would open in full-screen mode or fail to resize correctly. It now opens as a floating window and adapts to content dynamically.
- **Bugfix: Paint Tool Layering**: Resolved an issue where the Paint Brush strokes were drawn _behind_ the character. Painting now correctly appears on top of the character layer.
- **Bugfix: Eraser Logic**: Fixed the Eraser's "Restore" mode to accurately track the active layer (Token vs Background).
- **UX Improvement**: The canvas now uses strict centering to prevent images from being cut off during window resizing.

## v1.4.1

- **High-Fidelity Editing**: Decoupled internal editing resolution from output settings. You now always edit at the source image's full resolution (up to 4K).
- **Intelligent Export**: Downscaling happens _only_ at export time to match your configured "Output Resolution". We no longer upsale small images.
- **Dynamic Controls**:
  - **Sliders**: X/Y Position range scales with image size (e.g. +/- 2000px for 4K).
  - **Brushes**: Eraser/Paint sizes now range from 1px up to 25% of the image size.
- **Visuals**:
  - The **Dynamic Ring Guide** is now a high-contrast white dashed line.
  - The Editor Window is now compact and auto-sizes to fit the content.
- **Settings**: "Output Resolution" is now a GM-only world setting.

## 1.4.0

- **New Feature: Separate Avatar & Token Images**:
  - You can now upload a "Portrait" image for your Avatar that is completely different from your Token image.
  - Allows for consistent character representation even if the token art (top-down) differs from the portrait (face-on).
- **New Feature: Avatar Backgrounds**:
  - Full support for Avatar Backgrounds! Upload, scale, rotate, and position background images specifically for the Avatar view.
  - Independent from Token backgrounds.
- **UI Overhaul for Avatars**:
  - Transformed the Avatar editor to use the same powerful "Slot System" as the Token editor.
  - Access "Background" and "Portrait" slots directly.
- **Technical Improvements**:
  - **Enhanced Persistence**: Fixed issues where Avatar settings (Aspect Ratio, Backgrounds) were not correctly restored after closing the app.
  - **Race Condition Fix**: Resolved a bug where Avatar backgrounds could fail to load or appear on the wrong layer during session restore.

## 1.3.1

- **Improvement: Dynamic Token Ring**: Significant improvements to the Dynamic Token Ring workflow.
  - **Fixed Scaling**: Rings now maintain a consistent size across all padding options (Small, Medium, Large) while keeping the correct grid scale.
  - **Ghosting Fix**: Fixed an issue where the token image would obscure the ring frame. Pop-out content is now only rendered if explicitly painted.
  - **UI Feedback**: When "Use Dynamic Token Ring" is enabled, Frame controls are now visibly disabled/struck-through to prevent accidental edits that would break the ring alignment.
- **Bugfix: Background Color**: Added a "Remove" button to the Background Color picker to easily reset it to transparent.
- **Bugfix: Brush Controls**: Fixed an issue where the Paint Brush size slider was not responding.

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
