# Implementation Plan

- [x] 1. Define preprocessing configuration data structures
  - [x] 1.1 Create preprocessing configuration enums and interfaces
    - Define NotebookPreset enum with preset types
    - Define SplitDirection enum (horizontal, vertical)
    - Define RotationAngle enum (0°, 90°, 180°, 270°)
    - Define RotationTiming enum (before-split, after-split)
    - Create SplitConfig interface with enabled, direction, and pageCount fields
    - Create RotationConfig interface with enabled, timing, and angle fields
    - Create PreprocessingConfig interface combining all configuration options
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 1.2 Define preset configurations
    - Create PRESET_CONFIGS constant with single-page preset
    - Add pocket-side-by-side preset configuration
    - Add A5-portrait preset configuration
    - Add A5-landscape preset configuration
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Create preprocessing result interfaces
    - Define PreprocessingResult interface with pages, config, and transformations
    - Define PreviewThumbnail interface for preview generation
    - _Requirements: 4.1, 5.1_

- [x] 2. Implement configuration manager
  - [x] 2.1 Create PreprocessingConfigManager class
    - Implement constructor initializing configs map and default config
    - Implement initializePresets() to load predefined presets
    - Store configs in Map with config ID as key
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Implement configuration retrieval methods
    - Implement getAllConfigs() returning array of all configurations
    - Implement getConfig(id) returning specific configuration by ID
    - Implement getDefaultConfig() returning the default configuration
    - _Requirements: 1.4, 6.2, 7.2_

  - [x] 2.3 Implement configuration management methods
    - Implement setDefaultConfig(id) to set default configuration
    - Implement saveConfig(config) to add or update custom configuration
    - Implement deleteConfig(id) to remove custom configurations (prevent preset deletion)
    - Implement duplicateConfig(id, newName) to clone configurations
    - _Requirements: 2.5, 3.5, 6.1, 6.3, 6.4, 6.5_

  - [x] 2.4 Write property test for configuration manager
    - **Property 1: Preset selection applies correct settings**
    - **Validates: Requirements 1.4**

  - [x] 2.5 Write property test for page count validation
    - **Property 2: Page count validation**
    - **Validates: Requirements 2.4**

  - [x] 2.6 Write property test for configuration persistence
    - **Property 3: Configuration persistence round-trip**
    - **Validates: Requirements 2.5, 3.5**

  - [x] 2.7 Write property test for default configuration
    - **Property 4: Default configuration retrieval**
    - **Validates: Requirements 6.3**

  - [x] 2.8 Write property test for configuration deletion
    - **Property 5: Custom configuration deletion**
    - **Validates: Requirements 6.4**

  - [x] 2.9 Write property test for configuration duplication
    - **Property 6: Configuration duplication creates independent copy**
    - **Validates: Requirements 6.5**

  - [x] 2.10 Implement configuration validation
    - Implement validateConfig(config) method
    - Validate page count is between 2 and 4 when splitting enabled
    - Validate per-page rotation angles match page count
    - Return array of validation error messages
    - _Requirements: 2.4, 3.4_

- [x] 3. Implement image splitter
  - [x] 3.1 Create ImageSplitter class
    - Implement split(imageData, config) method
    - Return original image array if splitting disabled
    - _Requirements: 2.1, 5.1_

  - [x] 3.2 Implement horizontal splitting
    - Calculate page height by dividing total height by page count
    - Extract each page region from top to bottom
    - Handle remaining pixels in last page
    - _Requirements: 2.2, 2.3, 5.1_

  - [x] 3.3 Implement vertical splitting
    - Calculate page width by dividing total width by page count
    - Extract each page region from left to right
    - Handle remaining pixels in last page
    - _Requirements: 2.2, 2.3, 5.1_

  - [x] 3.4 Implement image loading and region extraction helpers
    - Implement loadImage(imageData) to create HTMLImageElement from ArrayBuffer
    - Implement extractRegion(img, x, y, width, height) using canvas
    - Convert canvas to ArrayBuffer using toBlob and FileReader
    - _Requirements: 5.1_

  - [x] 3.5 Implement dimension validation
    - Implement validateDimensions(width, height, config) method
    - Check minimum page dimension (100px) for split pages
    - Return error message if dimensions too small, null if valid
    - _Requirements: 10.1_

  - [x] 3.6 Write property test for split page count
    - **Property 10: Split page OCR count**
    - **Validates: Requirements 5.3**

- [x] 4. Implement image rotator
  - [x] 4.1 Create ImageRotator class
    - Implement rotate(imageData, angle) method
    - Return original image if angle is 0°
    - _Requirements: 3.1, 3.2, 5.2_

  - [x] 4.2 Implement rotation transformation
    - Load image from ArrayBuffer
    - Calculate new dimensions after rotation (swap width/height for 90°/270°)
    - Create canvas with new dimensions
    - Apply rotation transformation using canvas context
    - Draw rotated image on canvas
    - _Requirements: 3.2, 5.2_

  - [x] 4.3 Implement rotation helper methods
    - Implement calculateRotatedDimensions(width, height, angle)
    - Implement loadImage(imageData) helper
    - Convert canvas to ArrayBuffer
    - _Requirements: 3.2, 5.2_

  - [x] 4.4 Write unit tests for rotation
    - Test all rotation angles (90°, 180°, 270°)
    - Test dimension calculations
    - Test that 0° rotation returns original image
    - _Requirements: 3.2_

- [x] 5. Implement preprocessing manager
  - [x] 5.1 Create PreprocessingManager class
    - Implement constructor accepting ConfigManager
    - Initialize ImageSplitter and ImageRotator instances
    - _Requirements: 5.1, 5.2_

  - [x] 5.2 Implement preprocessing orchestration
    - Implement preprocess(imageData, configId) method
    - Get configuration from ConfigManager (use default if no ID provided)
    - Validate configuration before processing
    - Track transformations applied in array
    - _Requirements: 5.1, 5.2, 7.5_

  - [x] 5.3 Implement rotation before split
    - Check if rotation enabled and timing is BEFORE_SPLIT
    - Apply rotation to whole image using ImageRotator
    - Add transformation description to tracking array
    - _Requirements: 3.3, 5.2_

  - [x] 5.4 Implement image splitting
    - Check if splitting enabled
    - Validate image dimensions before splitting
    - Split image using ImageSplitter
    - Add transformation description to tracking array
    - _Requirements: 2.1, 5.1, 10.1_

  - [x] 5.5 Implement rotation after split
    - Check if rotation enabled and timing is AFTER_SPLIT
    - Apply rotation to each page individually
    - Use per-page rotation angles from configuration
    - Add transformation descriptions to tracking array
    - _Requirements: 3.3, 3.4, 5.2_

  - [x] 5.6 Return preprocessing result
    - Create PreprocessingResult with pages array, config, and transformations
    - _Requirements: 5.1, 5.2_

  - [x] 5.7 Write property test for transformation ordering
    - **Property 8: Split before OCR ordering**
    - **Property 9: Rotation before OCR ordering**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 5.8 Write property test for page order preservation
    - **Property 11: Page order preservation**
    - **Validates: Requirements 5.4**

  - [x] 5.9 Write property test for configuration isolation
    - **Property 13: Configuration isolation**
    - **Validates: Requirements 7.5**

- [x] 6. Implement preview generator
  - [x] 6.1 Create PreviewGenerator class
    - Implement generatePreviews(result) method
    - Set maximum thumbnail size (300px)
    - _Requirements: 4.1_

  - [x] 6.2 Implement thumbnail generation
    - Implement createThumbnail(pageData, pageNumber) method
    - Load image from ArrayBuffer
    - Calculate thumbnail dimensions maintaining aspect ratio
    - Create canvas with thumbnail dimensions
    - Draw scaled image on canvas
    - Convert canvas to data URL
    - Return PreviewThumbnail with page number and data URL
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.3 Write property test for preview OCR isolation
    - **Property 7: Preview does not trigger OCR**
    - **Validates: Requirements 4.5**

- [x] 7. Update plugin settings
  - [x] 7.1 Add preprocessing settings to PluginSettings interface
    - Add enablePreprocessing boolean field
    - Add defaultPreprocessingConfigId string field
    - Add customPreprocessingConfigs array field
    - Add splitPageNoteMode field ('separate' | 'combined')
    - Add splitPageSeparator string field
    - Add includePreprocessingMetadata boolean field
    - _Requirements: 2.1, 6.1, 6.3, 8.1, 8.2, 9.2_

  - [x] 7.2 Update DEFAULT_SETTINGS
    - Set enablePreprocessing default to false
    - Set defaultPreprocessingConfigId to 'preset-single-page'
    - Set customPreprocessingConfigs to empty array
    - Set splitPageNoteMode to 'separate'
    - Set splitPageSeparator to '\n\n---\n\n'
    - Set includePreprocessingMetadata to false
    - _Requirements: 2.1, 6.3, 8.1, 9.2_

- [x] 8. Implement preprocessing error handling
  - [x] 8.1 Create preprocessing error types
    - Define PreprocessingErrorType enum
    - Create PreprocessingError class extending Error
    - Add type and configId fields
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 8.2 Create PreprocessingErrorHandler class
    - Implement handle(error, imagePath) static method
    - Format user-friendly error messages for each error type
    - Display error notices with appropriate duration
    - Log detailed error information to console
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 8.3 Write property test for dimension validation errors
    - **Property 21: Invalid dimension error handling**
    - **Validates: Requirements 10.1**

  - [x] 8.4 Write property test for rotation failure fallback
    - **Property 22: Rotation failure fallback**
    - **Validates: Requirements 10.2**

  - [x] 8.5 Write property test for small page skipping
    - **Property 23: Small page skipping**
    - **Validates: Requirements 10.3**

- [x] 9. Integrate preprocessing into OCR pipeline
  - [x] 9.1 Initialize preprocessing components in plugin
    - Create PreprocessingConfigManager instance in plugin onload
    - Create PreprocessingManager instance with config manager
    - Create PreviewGenerator instance
    - _Requirements: 1.1, 5.1, 4.1_

  - [x] 9.2 Implement processImageWithPreprocessing method
    - Read image data from file
    - Check if preprocessing is enabled
    - If disabled, process image directly without preprocessing
    - If enabled, call PreprocessingManager.preprocess()
    - Log preprocessing transformations to console
    - _Requirements: 5.1, 5.2, 7.4, 9.4_

  - [x] 9.3 Process pages through OCR
    - Loop through each preprocessed page
    - Call OCR service for each page
    - Collect OCR results in array
    - _Requirements: 5.3_

  - [x] 9.4 Handle preprocessing errors with fallback
    - Catch PreprocessingError exceptions
    - Call PreprocessingErrorHandler.handle()
    - For non-config errors, offer to process without preprocessing
    - If user confirms, process original image directly
    - _Requirements: 10.1, 10.2, 10.5_

  - [x] 9.5 Write property test for original image preservation
    - **Property 12: Original image preservation**
    - **Validates: Requirements 5.5**

- [x] 10. Implement note creation for split pages
  - [x] 10.1 Implement createNotesFromPages method
    - Check splitPageNoteMode setting
    - If 'separate', create individual notes for each page
    - If 'combined', create single note with all pages
    - _Requirements: 8.1, 8.2_

  - [x] 10.2 Implement separate note creation
    - Generate page title with page number appended
    - Generate note content with OCR text
    - Add preprocessing metadata to frontmatter if enabled
    - Create note for each page
    - _Requirements: 8.1, 8.3, 9.2, 9.3_

  - [x] 10.3 Implement combined note creation
    - Generate single note title from source file
    - Combine OCR results with page separators between pages
    - Add preprocessing metadata to frontmatter if enabled
    - Create single combined note
    - _Requirements: 8.2, 8.4, 9.2, 9.3_

  - [x] 10.4 Implement note content generation helpers
    - Implement generatePageTitle(baseName, pageNumber)
    - Implement generateNoteContent(ocrResult, preprocessingResult, pageNumber)
    - Implement generateCombinedNoteContent(ocrResults, preprocessingResult)
    - Add frontmatter with preprocessing metadata when enabled
    - _Requirements: 8.3, 8.4, 9.2, 9.3_

  - [x] 10.5 Write property test for separate note creation
    - **Property 14: Separate note creation count**
    - **Validates: Requirements 8.1**

  - [x] 10.6 Write property test for combined note separators
    - **Property 15: Combined note separator count**
    - **Validates: Requirements 8.2**

  - [x] 10.7 Write property test for page numbers in titles
    - **Property 16: Page numbers in separate note titles**
    - **Validates: Requirements 8.3**

  - [x] 10.8 Write property test for separator markers
    - **Property 17: Separator markers in combined notes**
    - **Validates: Requirements 8.4**

  - [x] 10.9 Write property test for rule application
    - **Property 18: Rule application to split pages**
    - **Validates: Requirements 8.5**

  - [x] 10.10 Write property test for metadata inclusion
    - **Property 19: Metadata inclusion based on setting**
    - **Property 20: Metadata contains configuration details**
    - **Validates: Requirements 9.2, 9.3**

- [x] 11. Implement preprocessing settings UI
  - [x] 11.1 Create PreprocessingSettingsUI class
    - Implement display(containerEl, plugin) method
    - Add enable/disable preprocessing toggle
    - Show/hide preprocessing settings based on toggle
    - _Requirements: 2.1_

  - [x] 11.2 Implement default configuration selection
    - Add dropdown for default configuration selection
    - Populate dropdown with all available configurations
    - Save selection to plugin settings
    - _Requirements: 6.3_

  - [x] 11.3 Display preset configurations
    - Create section for preset configurations
    - Display each preset with name and description
    - Show split and rotation settings for each preset
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 11.4 Display custom configurations
    - Create section for custom configurations
    - Display each custom config with edit, duplicate, and delete buttons
    - Show "no custom configurations" message if none exist
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 11.5 Add create configuration button
    - Add button to create new custom configuration
    - Open ConfigEditorModal when clicked
    - _Requirements: 6.1_

  - [x] 11.6 Implement note creation settings
    - Add dropdown for split page note mode (separate/combined)
    - Add text input for page separator (shown only for combined mode)
    - Add toggle for including preprocessing metadata
    - _Requirements: 8.1, 8.2, 8.4, 9.2_

- [x] 12. Implement configuration editor modal
  - [x] 12.1 Create ConfigEditorModal class
    - Extend Obsidian Modal class
    - Accept plugin and optional config in constructor
    - Clone config for editing or create new config
    - _Requirements: 6.1, 6.4_

  - [x] 12.2 Implement configuration name and description inputs
    - Add text input for configuration name
    - Add text input for configuration description
    - _Requirements: 6.1_

  - [x] 12.3 Implement split settings UI
    - Add toggle for enabling splitting
    - Add dropdown for split direction (horizontal/vertical)
    - Add dropdown for number of pages (2, 3, 4)
    - Show/hide split options based on enable toggle
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 12.4 Implement rotation settings UI
    - Add toggle for enabling rotation
    - Add dropdown for rotation timing (before/after split)
    - Add dropdown for whole image rotation angle (if before split)
    - Add per-page rotation angle dropdowns (if after split)
    - Show/hide rotation options based on enable toggle and timing
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 12.5 Implement save and cancel buttons
    - Add save button that validates and saves configuration
    - Add cancel button that closes modal without saving
    - Display validation errors if configuration invalid
    - Add config to custom configs list if new
    - Update existing config if editing
    - _Requirements: 2.4, 6.1, 6.4_

- [x] 13. Implement configuration selection modal
  - [x] 13.1 Create ConfigSelectionModal class
    - Extend Obsidian Modal class
    - Accept plugin and callback in constructor
    - _Requirements: 7.1, 7.2_

  - [x] 13.2 Display configuration options
    - Add "No Preprocessing" option at top
    - List all available configurations (presets and custom)
    - Highlight default configuration
    - Show configuration descriptions
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 13.3 Handle configuration selection
    - Add select button for each configuration
    - Call callback with selected config ID
    - Close modal after selection
    - _Requirements: 7.5_

- [x] 14. Add preprocessing to image processing commands
  - [x] 14.1 Update process image command
    - Show configuration selection modal before processing
    - Pass selected config ID to processImageWithPreprocessing
    - Use default config if user doesn't select one
    - _Requirements: 7.1, 7.2, 7.5_

  - [x] 14.2 Add completion notification
    - Display notification with configuration name used
    - Include number of pages processed
    - _Requirements: 9.1, 9.5_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Update documentation
  - [x] 16.1 Update README.md
    - Add preprocessing feature section
    - Document preset configurations
    - Explain custom configuration creation
    - Document split page note creation modes
    - Add troubleshooting section for preprocessing errors
    - _Requirements: All_

  - [x] 16.2 Add inline code documentation
    - Add JSDoc comments to all preprocessing classes and methods
    - Document configuration interfaces and enums
    - Add usage examples for preprocessing workflow
    - _Requirements: All_

  - [x] 16.3 Create preprocessing user guide
    - Document how to enable preprocessing
    - Explain each preset configuration
    - Provide step-by-step guide for custom configurations
    - Include screenshots of settings UI
    - Add examples of split page note creation
    - _Requirements: All_

