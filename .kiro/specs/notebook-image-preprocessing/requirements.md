# Requirements Document

## Introduction

The Notebook Image Preprocessing feature extends the Notebook OCR Plugin to handle multi-page notebook scans with different sizes and orientations. Users often scan multiple notebook pages in a single image (e.g., pocket notebooks side-by-side, A5 notebooks that need rotation), which causes OCR to read across both pages instead of treating each page separately. This feature provides automatic image splitting and rotation based on notebook type presets or custom configurations, ensuring each page is processed correctly before being sent to the OCR engine.

## Glossary

- **Plugin**: The Notebook OCR Plugin system
- **User**: The person using Obsidian with the Plugin installed
- **Notebook Type**: A predefined configuration for common notebook formats (e.g., single-page, pocket side-by-side, A5)
- **Notebook Preset**: A saved configuration specifying split and rotation settings for a notebook type
- **Image Split**: The process of dividing a single image containing multiple pages into separate page images
- **Image Rotation**: The process of rotating an image by a specified angle (90°, 180°, 270°)
- **Split Configuration**: Settings that define how to split an image (horizontal, vertical, number of pages)
- **Rotation Configuration**: Settings that define how to rotate an image or split pages
- **Preprocessor**: The component that applies split and rotation transformations to images before OCR
- **OCR Engine**: The optical character recognition service that converts image text to digital text
- **Source Image**: The original scanned image before preprocessing
- **Processed Page**: An individual page image after splitting and rotation
- **Custom Configuration**: User-defined split and rotation settings for non-standard notebook formats

## Requirements

### Requirement 1

**User Story:** As a User, I want to select from predefined notebook type presets, so that I can quickly configure preprocessing for common notebook formats.

#### Acceptance Criteria

1. THE Plugin SHALL provide preset configurations for single-page notebooks (8.5x11 inches)
2. THE Plugin SHALL provide preset configurations for pocket notebooks scanned horizontally side-by-side (3.5x5.5 inches)
3. THE Plugin SHALL provide preset configurations for A5 notebooks that may need rotation
4. WHEN a User selects a notebook preset, THE Plugin SHALL apply the corresponding split and rotation settings
5. THE Plugin SHALL display a description of each preset explaining the notebook format it handles

### Requirement 2

**User Story:** As a User, I want to configure custom split settings, so that I can handle non-standard notebook formats or scanning configurations.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration option to enable or disable image splitting
2. WHEN image splitting is enabled, THE Plugin SHALL provide an option to select split direction (horizontal or vertical)
3. WHEN image splitting is enabled, THE Plugin SHALL provide an option to specify the number of pages in the image (2, 3, or 4)
4. THE Plugin SHALL validate that the number of pages is between 2 and 4
5. THE Plugin SHALL save custom split configurations for reuse

### Requirement 3

**User Story:** As a User, I want to configure rotation settings for images or individual pages, so that I can correct orientation before OCR processing.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration option to enable or disable image rotation
2. WHEN image rotation is enabled, THE Plugin SHALL provide options to rotate by 90°, 180°, or 270° clockwise
3. THE Plugin SHALL allow rotation to be applied before splitting (whole image) or after splitting (per page)
4. WHEN per-page rotation is enabled, THE Plugin SHALL allow different rotation angles for each split page
5. THE Plugin SHALL save rotation configurations for reuse

### Requirement 4

**User Story:** As a User, I want to preview the preprocessing results, so that I can verify the split and rotation settings are correct before processing.

#### Acceptance Criteria

1. THE Plugin SHALL provide a preview function that shows how an image will be split and rotated
2. WHEN the User triggers preview, THE Plugin SHALL display thumbnails of each processed page
3. THE Plugin SHALL display the page number and applied transformations for each thumbnail
4. THE Plugin SHALL allow the User to adjust settings and refresh the preview
5. THE Plugin SHALL not send preview images to the OCR Engine

### Requirement 5

**User Story:** As a User, I want the Plugin to automatically split and rotate images before OCR, so that each notebook page is processed correctly.

#### Acceptance Criteria

1. WHEN the User processes an image with preprocessing enabled, THE Plugin SHALL apply split transformations before OCR
2. WHEN the User processes an image with preprocessing enabled, THE Plugin SHALL apply rotation transformations before OCR
3. THE Plugin SHALL process each split page separately through the OCR Engine
4. THE Plugin SHALL combine OCR results from all pages in the correct order
5. THE Plugin SHALL preserve the original Source Image in the vault

### Requirement 6

**User Story:** As a User, I want to save and manage multiple preprocessing configurations, so that I can quickly switch between different notebook types.

#### Acceptance Criteria

1. THE Plugin SHALL allow the User to save custom preprocessing configurations with descriptive names
2. THE Plugin SHALL display a list of saved configurations in the settings
3. THE Plugin SHALL allow the User to select a default configuration for automatic use
4. THE Plugin SHALL allow the User to edit or delete saved configurations
5. THE Plugin SHALL allow the User to duplicate an existing configuration as a starting point

### Requirement 7

**User Story:** As a User, I want to manually select a preprocessing configuration when processing an image, so that I can override the default for specific scans.

#### Acceptance Criteria

1. WHEN the User initiates image processing, THE Plugin SHALL display an option to select a preprocessing configuration
2. THE Plugin SHALL list all available configurations including presets and custom configurations
3. THE Plugin SHALL highlight the currently selected default configuration
4. THE Plugin SHALL allow the User to select "No preprocessing" to skip transformations
5. WHEN the User selects a configuration, THE Plugin SHALL apply it to the current image only

### Requirement 8

**User Story:** As a User, I want the Plugin to handle split pages correctly when creating notes, so that each page becomes a separate note or section.

#### Acceptance Criteria

1. WHEN processing a split image, THE Plugin SHALL create separate notes for each page by default
2. THE Plugin SHALL provide an option to combine all pages into a single note with page separators
3. WHEN creating separate notes, THE Plugin SHALL append page numbers to note titles
4. WHEN combining pages, THE Plugin SHALL insert page separator markers between page content
5. THE Plugin SHALL respect existing note creation rules and templates for each page

### Requirement 9

**User Story:** As a User, I want to see which preprocessing was applied to each processed image, so that I can track and verify the transformations.

#### Acceptance Criteria

1. WHEN the Plugin completes preprocessing, THE Plugin SHALL display a notification indicating the configuration used
2. THE Plugin SHALL optionally add preprocessing metadata to created notes
3. WHERE preprocessing metadata is enabled, THE Plugin SHALL add frontmatter properties indicating split and rotation settings
4. THE Plugin SHALL log preprocessing details to the console for debugging
5. THE Plugin SHALL include the number of pages processed in the completion notification

### Requirement 10

**User Story:** As a User, I want the Plugin to handle preprocessing errors gracefully, so that I can understand and resolve issues with split or rotation settings.

#### Acceptance Criteria

1. IF image splitting fails due to invalid dimensions, THEN THE Plugin SHALL display an error message indicating the issue
2. IF image rotation fails, THEN THE Plugin SHALL display an error message and attempt to process the original image
3. IF a split page is too small for OCR, THEN THE Plugin SHALL display a warning and skip that page
4. THE Plugin SHALL log detailed preprocessing error information to the console
5. WHERE preprocessing fails, THE Plugin SHALL offer to process the original image without preprocessing

