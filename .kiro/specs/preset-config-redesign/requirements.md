# Requirements Document

## Introduction

This specification defines improvements to the preset preprocessing configurations for the Obsidian OCR plugin. The current presets are organized around paper sizes (A5, pocket notebooks, etc.), but should instead be organized around the actual image transformations being applied. This redesign will make the presets more intuitive and add missing functionality for common scanning scenarios.

## Glossary

- **Preset Configuration**: A predefined set of image preprocessing operations (split, rotate) that can be applied to scanned notebook images
- **OCR Plugin**: The Obsidian plugin that converts images to text using Optical Character Recognition
- **Config Selection Modal**: The user interface dialog where users choose which preprocessing configuration to apply to an image
- **Settings UI**: The plugin settings interface where users configure default preprocessing options
- **Split Operation**: Dividing a single scanned image into multiple separate page images
- **Rotation Operation**: Rotating an image by a specified angle (90°, 180°, 270°)
- **Default Configuration**: The preset that is automatically selected or highlighted when the user opens the config selection modal

## Requirements

### Requirement 1

**User Story:** As a user scanning notebook images, I want preset configurations named by their transformations rather than paper sizes, so that I can quickly understand what each preset does without needing to know specific paper dimensions.

#### Acceptance Criteria

1. WHEN the system displays preset configurations THEN the system SHALL name each preset based on the transformations it applies rather than paper size specifications
2. WHEN a user views the "Split Vertically" preset THEN the system SHALL describe it as splitting the image into two pages vertically
3. WHEN a user views rotation presets THEN the system SHALL clearly indicate the rotation direction (clockwise or counterclockwise)
4. WHEN the system presents preset options THEN the system SHALL exclude redundant presets that perform no transformations

### Requirement 2

**User Story:** As a user with top-spiral pocket notebooks, I want a preset that splits horizontally and rotates the top page 180 degrees, so that I can correctly process images where the top page is upside-down.

#### Acceptance Criteria

1. WHEN a user selects the "Top Spiral Notebook" preset THEN the system SHALL split the image horizontally into two pages
2. WHEN the "Top Spiral Notebook" preset splits an image THEN the system SHALL rotate the top page by 180 degrees
3. WHEN the "Top Spiral Notebook" preset processes an image THEN the system SHALL leave the bottom page unrotated
4. WHEN the system applies per-page rotations THEN the system SHALL apply rotations after the split operation

### Requirement 3

**User Story:** As a user, I want separate presets for clockwise and counterclockwise 90-degree rotations, so that I can correct images scanned in either landscape orientation.

#### Acceptance Criteria

1. WHEN the system provides rotation presets THEN the system SHALL include both a "Rotate 90° Clockwise" preset and a "Rotate 90° Counterclockwise" preset
2. WHEN a user selects "Rotate 90° Clockwise" THEN the system SHALL rotate the entire image 90 degrees clockwise before any split operations
3. WHEN a user selects "Rotate 90° Counterclockwise" THEN the system SHALL rotate the entire image 270 degrees clockwise before any split operations
4. WHEN rotation presets are applied THEN the system SHALL not perform any split operations

### Requirement 4

**User Story:** As a user, I want to see helpful guidance about centering my notebook on the scanner, so that I can achieve better preprocessing results.

#### Acceptance Criteria

1. WHEN a user views the preprocessing settings section THEN the system SHALL display a tip about centering notebooks on the scanner or camera
2. WHEN the tip is displayed THEN the system SHALL explain that centering improves split accuracy
3. WHEN the system shows preprocessing configuration help text THEN the system SHALL include the centering guidance in a visible location

### Requirement 5

**User Story:** As a user selecting a preprocessing configuration, I want the default configuration to be visually highlighted in the selection modal, so that I can quickly identify and select it without searching through the list.

#### Acceptance Criteria

1. WHEN the config selection modal displays configurations THEN the system SHALL visually highlight the default configuration
2. WHEN a configuration is set as default THEN the system SHALL display it with distinctive visual styling that differentiates it from other options
3. WHEN the user opens the config selection modal THEN the system SHALL position the default configuration prominently in the list
4. WHEN multiple configurations are available THEN the system SHALL ensure only the default configuration receives the highlight styling

### Requirement 6

**User Story:** As a user, I want a "No Preprocessing" option clearly available at the top of the configuration selection modal, so that I can quickly choose to process images without any transformations.

#### Acceptance Criteria

1. WHEN the config selection modal opens THEN the system SHALL display the "No Preprocessing" option at the top of the list
2. WHEN a user selects "No Preprocessing" THEN the system SHALL process the image without applying any split or rotation operations
3. WHEN the "No Preprocessing" option is displayed THEN the system SHALL describe it as processing the image without transformations
4. WHEN the config selection modal shows options THEN the system SHALL separate the "No Preprocessing" option from the preset configurations list
