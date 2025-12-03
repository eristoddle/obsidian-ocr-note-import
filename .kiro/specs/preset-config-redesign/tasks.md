# Implementation Plan

- [x] 1. Update preset configuration types and definitions
  - [x] 1.1 Update NotebookPreset enum in preprocessing-types.ts
    - Remove SINGLE_PAGE, POCKET_SIDE_BY_SIDE, A5_PORTRAIT, A5_LANDSCAPE
    - Add NO_PREPROCESSING, SPLIT_VERTICALLY, ROTATE_90_CLOCKWISE, ROTATE_90_COUNTERCLOCKWISE, TOP_SPIRAL_NOTEBOOK
    - Keep CUSTOM
    - _Requirements: 1.1, 1.3, 2.1, 3.1_

  - [x] 1.2 Update PRESET_CONFIGS constant with new preset definitions
    - Remove old presets (single-page, pocket-side-by-side, a5-portrait, a5-landscape)
    - Add Split Vertically preset with vertical split, no rotation
    - Add Rotate 90° Clockwise preset with 90° rotation, no split
    - Add Rotate 90° Counterclockwise preset with 270° rotation, no split
    - Add Top Spiral Notebook preset with horizontal split and per-page rotation
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 1.3 Write property test for transformation-based naming
    - **Property 1: Transformation-based naming**
    - **Validates: Requirements 1.1**

  - [x] 1.4 Write property test for rotation direction clarity
    - **Property 2: Rotation direction clarity**
    - **Validates: Requirements 1.3**

  - [x] 1.5 Write property test for no redundant presets
    - **Property 3: No redundant presets**
    - **Validates: Requirements 1.4**

  - [x] 1.6 Write property test for per-page rotation timing
    - **Property 4: Per-page rotation timing**
    - **Validates: Requirements 2.4**

  - [x] 1.7 Write property test for whole-image rotation excludes splitting
    - **Property 5: Whole-image rotation excludes splitting**
    - **Validates: Requirements 3.4**

  - [x] 1.8 Write unit tests for new preset configurations
    - Test each preset has correct structure (id, name, description, split, rotation)
    - Test Split Vertically preset configuration
    - Test Rotate 90° Clockwise preset configuration
    - Test Rotate 90° Counterclockwise preset configuration
    - Test Top Spiral Notebook preset configuration
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 3.2, 3.3_

- [x] 2. Implement preset ID migration logic
  - [x] 2.1 Create migration function in PreprocessingConfigManager
    - Map old preset IDs to new preset IDs
    - Handle case where old ID has no equivalent (use default)
    - Return migrated ID
    - _Requirements: 1.1_

  - [x] 2.2 Update PreprocessingConfigManager initialization
    - Call migration function on default config ID if it references old preset
    - Update default config ID with migrated value
    - _Requirements: 1.1_

  - [x] 2.3 Write unit tests for migration logic
    - Test mapping from preset-pocket-side-by-side to preset-split-vertically
    - Test mapping from preset-a5-landscape to preset-rotate-90-clockwise
    - Test removal of preset-single-page and preset-a5-portrait
    - Test fallback to default when no mapping exists
    - _Requirements: 1.1_

- [x] 3. Update config selection modal UI
  - [x] 3.1 Enhance modal to highlight default configuration
    - Get default config ID from plugin settings
    - Add "(Default)" suffix to default config name
    - Apply bold styling to default config name
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 3.2 Ensure "No Preprocessing" option remains at top
    - Verify "No Preprocessing" button is rendered before config list
    - Update description to clarify no transformations are applied
    - _Requirements: 6.1, 6.3_

  - [x] 3.3 Write property test for default configuration uniqueness
    - **Property 6: Default configuration uniqueness**
    - **Validates: Requirements 5.4**

  - [x] 3.4 Write unit tests for modal rendering
    - Test "No Preprocessing" option appears first
    - Test default configuration has "(Default)" in name
    - Test only one configuration is marked as default
    - _Requirements: 5.1, 5.4, 6.1_

- [x] 4. Update preprocessing settings UI
  - [x] 4.1 Add centering guidance to settings
    - Create info box with centering tip at top of preprocessing section
    - Include icon (💡) for visual prominence
    - Explain that centering improves split accuracy
    - _Requirements: 4.1, 4.2_

  - [x] 4.2 Update preset display in settings
    - Update preset list to show new preset names
    - Ensure preset descriptions are clear and transformation-focused
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.3 Write unit tests for settings UI
    - Test centering tip is displayed in settings
    - Test centering tip contains expected text
    - _Requirements: 4.1, 4.2_

- [x] 5. Update default configuration in plugin settings
  - [x] 5.1 Change default preset ID in main.ts
    - Update DEFAULT_SETTINGS to use preset-split-vertically as default
    - _Requirements: 1.1_

  - [x] 5.2 Apply migration on plugin load
    - Call migration function when loading settings
    - Save migrated settings if default ID was changed
    - _Requirements: 1.1_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
