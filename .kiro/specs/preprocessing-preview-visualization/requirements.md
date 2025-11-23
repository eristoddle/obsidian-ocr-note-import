# Requirements Document

## Introduction

The Notebook OCR Plugin currently processes images with splitting and rotation transformations, but users cannot see how these transformations will be applied before processing. This creates confusion when:
- Users don't understand what clicking configuration buttons does
- Split lines are offset from the center (e.g., side-by-side scans where pages aren't perfectly centered)
- Users want to verify rotation angles before processing
- Custom configurations need testing before use

This feature adds a visual preview system that shows users exactly how their images will be split and rotated before OCR processing occurs.

## Glossary

- **Preview Modal**: A modal dialog that displays the original image with visual overlays showing split lines and rotation indicators
- **Split Line**: A visual indicator (line) showing where the image will be divided into separate pages
- **Rotation Indicator**: A visual element showing the rotation angle that will be applied
- **Configuration Preview**: The visual representation of how a specific preprocessing configuration will transform an image
- **Interactive Preview**: A preview that allows users to adjust split positions before processing
- **Source Image**: The original uploaded/selected image before any preprocessing
- **Transformation Overlay**: Visual elements (lines, arrows, labels) drawn on top of the source image to show planned transformations

## Requirements

### Requirement 1

**User Story:** As a user, I want to see a visual preview of how my image will be split before processing, so that I can verify the split configuration is correct for my scan.

#### Acceptance Criteria

1. WHEN a user selects a preprocessing configuration with splitting enabled THEN the system SHALL display a preview modal showing the source image with split lines overlaid
2. WHEN the split direction is vertical THEN the system SHALL draw vertical lines at the split positions on the preview
3. WHEN the split direction is horizontal THEN the system SHALL draw horizontal lines at the split positions on the preview
4. WHEN the preview displays split lines THEN the system SHALL label each resulting page region with its page number
5. WHEN the user views the preview THEN the system SHALL scale the image to fit the modal while maintaining aspect ratio

### Requirement 2

**User Story:** As a user, I want to see how rotation will be applied to my image, so that I can verify pages will be oriented correctly after processing.

#### Acceptance Criteria

1. WHEN a configuration includes rotation before split THEN the system SHALL display the rotated image preview with the rotation angle indicated
2. WHEN a configuration includes rotation after split THEN the system SHALL display rotation indicators on each page region showing the per-page rotation angles
3. WHEN rotation is 0 degrees for a page THEN the system SHALL display "No rotation" or omit the rotation indicator for that page
4. WHEN rotation is non-zero THEN the system SHALL display the rotation angle in degrees with a directional indicator (e.g., "90° ↻")

### Requirement 3

**User Story:** As a user, I want to adjust split line positions interactively when my scan is offset, so that I can correct for imperfect scanning alignment.

#### Acceptance Criteria

1. WHEN a user views a split preview THEN the system SHALL allow dragging split lines to new positions
2. WHEN a user drags a split line THEN the system SHALL update the page region labels in real-time
3. WHEN a user adjusts split positions THEN the system SHALL validate that all resulting pages meet minimum dimension requirements
4. WHEN a user confirms adjusted split positions THEN the system SHALL use the custom split positions for processing that image
5. WHEN split positions would create pages below minimum dimensions THEN the system SHALL prevent the adjustment and display a warning

### Requirement 4

**User Story:** As a user, I want to see a preview before processing starts, so that I can cancel or adjust if the configuration doesn't match my image.

#### Acceptance Criteria

1. WHEN a user selects a preprocessing configuration from the config selection modal THEN the system SHALL display the preview modal before starting OCR processing
2. WHEN the preview modal is displayed THEN the system SHALL provide "Process" and "Cancel" buttons
3. WHEN the user clicks "Process" THEN the system SHALL close the preview and proceed with OCR using the displayed configuration
4. WHEN the user clicks "Cancel" THEN the system SHALL close the preview and return to the configuration selection modal
5. WHEN the user selects "No preprocessing" THEN the system SHALL skip the preview and proceed directly to OCR

### Requirement 5

**User Story:** As a user, I want to test custom configurations with a preview, so that I can verify they work correctly before saving them.

#### Acceptance Criteria

1. WHEN a user creates or edits a custom configuration in the config editor modal THEN the system SHALL provide a "Preview with Sample Image" button
2. WHEN the user clicks "Preview with Sample Image" THEN the system SHALL prompt the user to select an image file
3. WHEN the user selects an image file THEN the system SHALL display the preview modal showing how the current configuration would transform that image
4. WHEN viewing a configuration preview THEN the system SHALL display the configuration name and description at the top of the preview
5. WHEN the preview is opened from the config editor THEN the system SHALL provide a "Close Preview" button that returns to the config editor without processing

### Requirement 6

**User Story:** As a user, I want to see clear visual indicators of what transformations will be applied, so that I can understand the preprocessing pipeline.

#### Acceptance Criteria

1. WHEN the preview modal displays THEN the system SHALL show a transformation summary listing all operations that will be applied in order
2. WHEN multiple transformations are configured THEN the system SHALL number them in execution order (e.g., "1. Rotate 90°", "2. Split vertically into 2 pages")
3. WHEN no transformations are configured THEN the system SHALL display "No preprocessing - image will be processed as-is"
4. WHEN the preview displays page regions THEN the system SHALL use distinct colors or patterns to visually separate each page
5. WHEN hovering over a page region THEN the system SHALL highlight that region and display its dimensions in pixels

### Requirement 7

**User Story:** As a user, I want the preview to load quickly, so that I don't have to wait long to verify my configuration.

#### Acceptance Criteria

1. WHEN generating a preview for images larger than 2000px in any dimension THEN the system SHALL create a downscaled version for preview display
2. WHEN downscaling for preview THEN the system SHALL maintain the original aspect ratio
3. WHEN the preview modal opens THEN the system SHALL display a loading indicator while the image is being prepared
4. WHEN the preview image is ready THEN the system SHALL remove the loading indicator and display the preview within 2 seconds for images under 10MB
5. WHEN the user processes the image THEN the system SHALL use the original full-resolution image, not the preview version
