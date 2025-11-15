# Implementation Plan

- [x] 1. Set up project structure and core plugin skeleton
  - Create main plugin file with basic Obsidian plugin structure
  - Set up TypeScript configuration and build system
  - Create package.json with required dependencies (obsidian, tesseract.js)
  - Create manifest.json with plugin metadata
  - Implement basic onload/onunload lifecycle methods
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement settings system and data models
  - [x] 2.1 Create settings interface and default settings object
    - Define PluginSettings interface with all configuration options
    - Create DEFAULT_SETTINGS constant
    - _Requirements: 2.1, 3.1, 7.2, 8.1_

  - [x] 2.2 Create data models for processing rules and actions
    - Define ProcessingRule, RuleAction, and ActionConfig interfaces
    - Define CreateNoteConfig, InsertContentConfig, ModifyFrontmatterConfig interfaces
    - Define InsertionPoint interface
    - _Requirements: 3.1, 3.2, 4.1, 5.1, 6.1_

  - [x] 2.3 Implement settings persistence
    - Implement loadSettings() method
    - Implement saveSettings() method
    - _Requirements: 2.1_

- [x] 3. Create basic settings UI
  - [x] 3.1 Implement settings tab class
    - Create PluginSettingTab class extending Obsidian's PluginSettingTab
    - Implement display() method with container setup
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Add OCR backend settings controls
    - Add dropdown for OCR backend selection (tesseract/cloud)
    - Add text input for cloud API key (conditionally shown)
    - Add dropdown for cloud provider selection
    - _Requirements: 1.1_

  - [x] 3.3 Add daily note settings controls
    - Add text input for daily note import heading
    - Add dropdown for default action selection
    - Add text input for note separator pattern
    - _Requirements: 2.1, 7.2, 7.3_

  - [x] 3.4 Add folder monitoring settings controls
    - Add toggle for folder monitoring enabled/disabled
    - Add text input for monitored folder path
    - Add dropdown for monitoring interval
    - Add toggle for move processed images option
    - Add text input for processed images folder path
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 4. Implement OCR service layer
  - [x] 4.1 Create OCR service interfaces
    - Define OCRService interface with initialize, processImage, isAvailable methods
    - Define OCRResult interface
    - _Requirements: 1.2_

  - [x] 4.2 Implement Tesseract.js OCR service
    - Create TesseractOCRService class implementing OCRService
    - Implement initialize() to load Tesseract worker
    - Implement processImage() to convert image buffer to text
    - Handle errors and return OCRResult with confidence score
    - _Requirements: 1.2, 1.5_

  - [x] 4.3 Create OCR service factory
    - Implement factory function to create appropriate OCR service based on settings
    - Handle service initialization and error cases
    - _Requirements: 1.2_

- [x] 5. Implement vault manager for file operations
  - [x] 5.1 Create VaultManager class
    - Implement constructor accepting App and Vault instances
    - _Requirements: 1.3, 2.4_

  - [x] 5.2 Implement daily note operations
    - Implement getDailyNote() to get or create daily note for a date
    - Implement insertIntoDailyNote() to insert content under configured heading
    - Handle heading creation if it doesn't exist
    - _Requirements: 1.3, 2.2, 2.3, 2.4_

  - [x] 5.3 Implement note creation operations
    - Implement createNote() to create new note with frontmatter and body
    - Handle folder creation if folder doesn't exist
    - Generate unique filenames if file already exists
    - _Requirements: 4.5_

  - [x] 5.4 Implement content insertion operations
    - Implement insertContent() to insert content at specified insertion point
    - Implement findHeading() helper to locate heading in content
    - Implement findPattern() helper to locate regex pattern in content
    - Handle all insertion point types (beginning, end, before/after pattern, under heading)
    - _Requirements: 5.2, 5.3, 5.5_

  - [x] 5.5 Implement frontmatter operations
    - Implement modifyFrontmatter() to update note frontmatter properties
    - Handle array property appending vs replacement
    - Parse and serialize YAML frontmatter correctly
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 6. Implement rule engine for pattern matching
  - [x] 6.1 Create RuleEngine class
    - Implement constructor to initialize with rules array
    - Create regex cache for compiled patterns
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Implement pattern matching logic
    - Implement matchAndExecute() to test OCR text against all rules
    - Sort rules by priority before testing
    - Extract capture groups from matches
    - Return array of RuleMatch objects
    - _Requirements: 3.1, 3.5_

  - [x] 6.3 Implement pattern testing utilities
    - Implement testPattern() for testing regex against sample text
    - Implement validateRegex() to check regex syntax validity
    - Return PatternTestResult with matches and capture groups
    - _Requirements: 11.2, 11.3, 11.5_

  - [x] 6.4 Implement template rendering
    - Create helper function to replace {{$1}}, {{$2}} etc. with capture groups
    - Handle missing capture groups gracefully
    - Support template rendering in titles, content, and frontmatter values
    - _Requirements: 4.2, 4.4, 5.4, 6.3_

- [x] 7. Implement action executor
  - [x] 7.1 Create ActionExecutor class
    - Implement constructor accepting VaultManager instance
    - _Requirements: 3.3_

  - [x] 7.2 Implement create note action
    - Implement executeCreateNote() to create new note from config
    - Render title template with capture groups
    - Render frontmatter values with capture groups
    - Render body template with capture groups
    - Call VaultManager.createNote() with rendered values
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.3 Implement insert content action
    - Implement executeInsertContent() to insert content into existing note
    - Resolve target note path (support patterns or direct paths)
    - Render content template with capture groups
    - Call VaultManager.insertContent() with rendered content and insertion point
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.4 Implement modify frontmatter action
    - Implement executeModifyFrontmatter() to update note frontmatter
    - Resolve target note path
    - Render property values with capture groups
    - Call VaultManager.modifyFrontmatter() with rendered properties
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.5 Implement action execution coordinator
    - Implement executeActions() to run all actions for a rule match
    - Handle errors for individual actions without stopping execution
    - Log action results and errors
    - _Requirements: 3.3_

- [x] 8. Implement image processing command
  - [x] 8.1 Create file picker integration
    - Add command to open file picker for image selection
    - Filter for image file types (jpg, png, etc.)
    - Support multiple file selection
    - _Requirements: 1.1, 1.2_

  - [x] 8.2 Implement image processing pipeline
    - Read selected image files as ArrayBuffer
    - Pass image data to OCR service
    - Handle OCR errors and display error notifications
    - Pass OCR text to rule engine for matching
    - Execute matched rule actions via ActionExecutor
    - Apply default action if no rules match
    - Display success notification with summary
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 8.3 Implement default action handler
    - Check settings for default action type
    - If daily-note, insert into daily note with separator formatting
    - If discard, skip processing
    - If prompt, show modal asking user what to do
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 9. Implement folder monitoring system
  - [x] 9.1 Create FolderMonitor class
    - Implement constructor with plugin reference
    - Create Set to track processed file paths
    - _Requirements: 8.1, 8.2_

  - [x] 9.2 Implement monitoring logic
    - Implement start() to begin monitoring with interval
    - Implement stop() to clear interval and cleanup
    - Implement checkForNewImages() to scan folder for new images
    - Filter for unprocessed image files
    - Process each new image through the image processing pipeline
    - Mark images as processed after successful processing
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 9.3 Implement processed file handling
    - Implement markAsProcessed() to add file to processed set
    - If moveProcessedImages is enabled, move file to processed folder
    - Persist processed file list to plugin data
    - _Requirements: 8.4_

  - [x] 9.4 Integrate folder monitor with plugin lifecycle
    - Start folder monitor in onload() if enabled in settings
    - Stop folder monitor in onunload()
    - Restart monitor when settings change
    - _Requirements: 8.1, 8.5_

- [ ] 10. Implement rule management UI
  - [ ] 10.1 Create rule list display in settings
    - Display list of processing rules with name and enabled status
    - Add enable/disable toggle for each rule
    - Add edit button for each rule
    - Add delete button for each rule
    - Add "Add Rule" button
    - Implement drag-and-drop reordering for priority
    - _Requirements: 3.1, 3.4, 3.5_

  - [ ] 10.2 Create RuleEditorModal class
    - Create modal extending Obsidian's Modal class
    - Add input field for rule name
    - Add textarea for regex pattern with monospace font
    - Add section for action configuration
    - Add "Add Action" button
    - Add save and cancel buttons
    - _Requirements: 3.2, 3.3_

  - [ ] 10.3 Implement action configuration UI
    - Create UI for selecting action type (dropdown)
    - Create conditional UI for CreateNoteConfig (folder, title template, frontmatter, body)
    - Create conditional UI for InsertContentConfig (target note, insertion point, content template)
    - Create conditional UI for ModifyFrontmatterConfig (target note, properties, append option)
    - Support adding multiple actions to a single rule
    - Support removing actions from a rule
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [ ] 10.4 Implement pattern tester UI
    - Add collapsible section in RuleEditorModal for pattern testing
    - Add textarea for sample text input
    - Add button to test pattern
    - Display match result (matched/not matched)
    - Display extracted capture groups in a list
    - Display preview of rendered templates with sample data
    - Display regex syntax errors if pattern is invalid
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 11. Implement mobile support
  - [ ] 11.1 Add platform detection utilities
    - Create PlatformHelper class with isMobile() and hasCameraAccess() methods
    - _Requirements: 9.1, 10.1_

  - [ ] 11.2 Implement mobile file picker
    - Ensure file picker command works on mobile
    - Test image selection from photo library
    - _Requirements: 9.2, 9.3_

  - [ ] 11.3 Implement camera capture command
    - Add command for camera capture (mobile only)
    - Check for camera access availability
    - Use Obsidian's file picker with camera option
    - Save captured image to configured folder
    - Process captured image immediately
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [ ] 11.4 Add mobile-specific settings
    - Add toggle for camera capture in settings
    - Add folder path input for saved captures
    - Conditionally show mobile settings only on mobile platform
    - _Requirements: 10.1_

  - [ ] 11.5 Test mobile functionality
    - Test on iOS device
    - Test on Android device
    - Verify file picker works correctly
    - Verify camera capture works correctly
    - Verify all rule processing works on mobile
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Add error handling and user feedback
  - [ ] 12.1 Implement error handler class
    - Create ErrorHandler class with methods for different error types
    - Implement handleOCRError() to show user-friendly OCR error messages
    - Implement handleRuleError() to log rule execution errors
    - Implement handleFileSystemError() to handle file operation errors
    - _Requirements: 1.5_

  - [ ] 12.2 Add progress notifications
    - Show notice when starting image processing
    - Show progress for multiple images
    - Show success notice with summary of actions taken
    - Show error notices for failures
    - _Requirements: 1.5_

  - [ ] 12.3 Add validation and warnings
    - Validate regex patterns when saving rules
    - Warn if target notes don't exist
    - Warn if folders don't exist (offer to create)
    - Validate template syntax
    - _Requirements: 11.5_

- [ ] 13. Implement plugin commands and ribbon
  - [ ] 13.1 Add main import command
    - Register "Import from notebook images" command
    - Bind to file picker and processing pipeline
    - _Requirements: 1.1_

  - [ ] 13.2 Add camera capture command
    - Register "Capture and import" command (mobile only)
    - Bind to camera capture functionality
    - _Requirements: 10.2_

  - [ ] 13.3 Add utility commands
    - Add "Test processing rules" command to open test modal
    - Add "Process folder now" command to manually trigger folder monitoring
    - _Requirements: 11.1_

  - [ ] 13.4 Add ribbon icon
    - Add ribbon icon for quick access to import command
    - Use appropriate icon (camera or document icon)
    - _Requirements: 1.1_

- [ ] 14. Polish and documentation
  - [ ] 14.1 Add inline code documentation
    - Add JSDoc comments to all public methods
    - Document complex algorithms and logic
    - Add usage examples in comments
    - _Requirements: All_

  - [ ] 14.2 Create README.md
    - Write overview of plugin functionality
    - Document installation instructions
    - Provide usage examples with screenshots
    - Document rule configuration with examples
    - List OCR backend options and trade-offs
    - Include troubleshooting section
    - _Requirements: All_

  - [ ] 14.3 Create example rule configurations
    - Create sample rules for common patterns (hashtags, project tasks, ideas)
    - Document regex patterns and their purpose
    - Provide as importable JSON or in README
    - _Requirements: 3.1, 4.1, 5.1, 6.1_

  - [ ] 14.4 Add settings help text
    - Add descriptive help text for each setting
    - Add tooltips or info icons with additional context
    - Link to documentation for complex features
    - _Requirements: All_
