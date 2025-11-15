# Requirements Document

## Introduction

The Notebook OCR Plugin is an Obsidian plugin that processes images of handwritten field notebook pages (3.5" x 5.5") using OCR technology and intelligently imports the extracted text into appropriate notes. The plugin provides both manual image selection and automated folder monitoring capabilities, with pattern-based routing to organize notes according to user-defined structures.

## Glossary

- **Plugin**: The Notebook OCR Plugin system
- **User**: The person using Obsidian with the Plugin installed
- **Daily Note**: An Obsidian note file representing a specific calendar day
- **OCR Engine**: The optical character recognition service that converts image text to digital text
- **Pattern Matcher**: The component that identifies structured patterns in OCR text using configured rules
- **File Picker**: The system dialog for selecting image files
- **Processing Rule**: A user-configured combination of regex pattern and associated actions
- **Rule Action**: A configured operation to perform when a Processing Rule matches OCR text
- **Capture Group**: A portion of text extracted from a regex pattern match
- **Target Note**: An Obsidian note file where matched content should be inserted
- **Monitored Folder**: A specific Obsidian vault folder checked regularly for new images
- **Import Heading**: A configurable heading under which imported notes are placed in Daily Notes
- **Frontmatter**: YAML metadata at the beginning of an Obsidian note file
- **Insertion Point**: A configured location within a Target Note where content should be placed

## Requirements

### Requirement 1

**User Story:** As a User, I want to manually select and process notebook images, so that I can quickly digitize my handwritten notes on demand.

#### Acceptance Criteria

1. WHEN the User invokes the import command, THE Plugin SHALL display the File Picker
2. WHEN the User selects one or more image files in the File Picker, THE Plugin SHALL process each selected image with the OCR Engine
3. WHEN the OCR Engine completes text extraction, THE Plugin SHALL insert the extracted text into the Daily Note for the current date
4. WHERE the Import Heading is configured, THE Plugin SHALL place the imported text under the specified heading in the Daily Note
5. IF the OCR Engine fails to process an image, THEN THE Plugin SHALL display an error message identifying the failed image file

### Requirement 2

**User Story:** As a User, I want to configure where imported notes appear in my Daily Note, so that I can maintain consistent note organization.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration setting for the Import Heading text
2. WHEN the Import Heading is set, THE Plugin SHALL create the heading in the Daily Note if it does not exist
3. WHEN the Import Heading is not set, THE Plugin SHALL append imported text to the end of the Daily Note
4. THE Plugin SHALL preserve existing Daily Note content when inserting imported text

### Requirement 3

**User Story:** As a User, I want to define custom regex patterns and actions, so that I can configure how different note types are processed and routed.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration interface for creating multiple Processing Rules
2. WHEN creating a Processing Rule, THE Plugin SHALL allow the User to specify a regex pattern with Capture Groups
3. WHEN creating a Processing Rule, THE Plugin SHALL allow the User to configure one or more Rule Actions
4. THE Plugin SHALL allow the User to enable or disable individual Processing Rules
5. THE Plugin SHALL allow the User to set the execution order priority for Processing Rules

### Requirement 4

**User Story:** As a User, I want to configure actions that create new notes from matched patterns, so that I can automatically generate structured notes from my handwritten content.

#### Acceptance Criteria

1. WHEN configuring a Rule Action for note creation, THE Plugin SHALL allow the User to specify the target folder path
2. WHEN configuring a Rule Action for note creation, THE Plugin SHALL allow the User to specify a title template using Capture Groups
3. WHEN configuring a Rule Action for note creation, THE Plugin SHALL allow the User to specify Frontmatter properties with values from Capture Groups
4. WHEN configuring a Rule Action for note creation, THE Plugin SHALL allow the User to specify a body content template using Capture Groups
5. WHEN a Processing Rule matches and triggers note creation, THE Plugin SHALL create the new note with the configured properties

### Requirement 5

**User Story:** As a User, I want to configure actions that insert content into existing notes, so that I can route matched patterns to specific locations in my vault.

#### Acceptance Criteria

1. WHEN configuring a Rule Action for content insertion, THE Plugin SHALL allow the User to specify the Target Note path or pattern
2. WHEN configuring a Rule Action for content insertion, THE Plugin SHALL allow the User to select an Insertion Point type (beginning, end, before pattern, after pattern, under heading)
3. WHEN the Insertion Point type requires a pattern or heading, THE Plugin SHALL allow the User to specify the matching text
4. WHEN configuring a Rule Action for content insertion, THE Plugin SHALL allow the User to specify a content template using Capture Groups
5. WHEN a Processing Rule matches and triggers content insertion, THE Plugin SHALL insert the formatted content at the configured Insertion Point

### Requirement 6

**User Story:** As a User, I want to configure actions that modify note frontmatter, so that I can automatically tag and categorize notes based on matched patterns.

#### Acceptance Criteria

1. WHEN configuring a Rule Action for frontmatter modification, THE Plugin SHALL allow the User to specify the Target Note
2. WHEN configuring a Rule Action for frontmatter modification, THE Plugin SHALL allow the User to specify frontmatter property names
3. WHEN configuring a Rule Action for frontmatter modification, THE Plugin SHALL allow the User to specify property values using Capture Groups
4. WHEN configuring a Rule Action for frontmatter modification, THE Plugin SHALL support adding values to array properties without removing existing values
5. WHEN a Processing Rule matches and triggers frontmatter modification, THE Plugin SHALL update the specified properties in the Target Note

### Requirement 7

**User Story:** As a User, I want unmatched OCR text to be handled with a default fallback action, so that all my notes are captured even when no Processing Rules match.

#### Acceptance Criteria

1. WHEN the Pattern Matcher evaluates all Processing Rules and none match the OCR text, THE Plugin SHALL apply the configured default action
2. THE Plugin SHALL provide a configuration setting for the default action (insert to Daily Note, discard, or prompt User)
3. WHERE the default action is set to insert to Daily Note, THE Plugin SHALL insert the unmatched text under the configured Import Heading
4. THE Plugin SHALL provide a configuration setting for a note separator pattern (such as dash or asterisk prefixes)
5. WHEN the note separator pattern is configured and detected in unmatched text, THE Plugin SHALL format each separated segment as a bullet list item

### Requirement 8

**User Story:** As a User, I want the plugin to automatically monitor a folder for new images, so that I can drop images and have them processed without manual commands.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration setting to enable or disable folder monitoring
2. WHERE folder monitoring is enabled, THE Plugin SHALL check the Monitored Folder at a configured interval
3. WHEN the Plugin detects new image files in the Monitored Folder, THE Plugin SHALL process each image with the OCR Engine
4. WHEN the Plugin completes processing an image from the Monitored Folder, THE Plugin SHALL move or mark the image as processed
5. THE Plugin SHALL provide configuration settings for the monitoring interval (hourly or daily)

### Requirement 9

**User Story:** As a User, I want to use the plugin on mobile devices, so that I can capture and process notes while in the field.

#### Acceptance Criteria

1. THE Plugin SHALL function on Obsidian mobile applications (iOS and Android)
2. WHEN running on a mobile device, THE Plugin SHALL support the File Picker for image selection
3. THE Plugin SHALL process images selected from the mobile device photo library
4. THE Plugin SHALL apply the same Processing Rules and routing logic on mobile as on desktop
5. THE Plugin SHALL respect mobile device storage permissions when accessing images

### Requirement 10

**User Story:** As a User, I want to optionally launch the camera from the plugin on mobile, so that I can capture and process notebook pages in one workflow.

#### Acceptance Criteria

1. WHERE the Plugin is running on a mobile device with camera access, THE Plugin SHALL provide a camera capture command
2. WHEN the User invokes the camera capture command, THE Plugin SHALL launch the device camera interface
3. WHEN the User captures a photo, THE Plugin SHALL immediately process the captured image with the OCR Engine
4. IF camera access is not available, THEN THE Plugin SHALL display a message directing the User to use manual image selection
5. THE Plugin SHALL save the captured image to the vault before processing

### Requirement 11

**User Story:** As a User, I want to test and validate my regex patterns, so that I can ensure my Processing Rules work correctly before using them on real data.

#### Acceptance Criteria

1. WHEN configuring a Processing Rule, THE Plugin SHALL provide a pattern testing interface
2. WHEN the User enters sample text in the testing interface, THE Plugin SHALL display whether the regex pattern matches
3. WHEN a pattern matches in the testing interface, THE Plugin SHALL display the extracted Capture Groups
4. WHEN a pattern matches in the testing interface, THE Plugin SHALL preview the formatted output using the configured Rule Actions
5. THE Plugin SHALL validate regex syntax and display error messages for invalid patterns
