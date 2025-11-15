# Notebook OCR Plugin for Obsidian

Transform your handwritten field notebook pages into searchable, organized digital notes. This plugin uses OCR (Optical Character Recognition) to extract text from images of your handwritten notes and intelligently routes them to the right place in your vault using customizable pattern-matching rules.

## Features

- **Local OCR Processing**: Convert handwritten notebook images to text using Tesseract.js (works offline, privacy-friendly)
- **Pattern-Based Routing**: Define custom regex patterns to automatically route notes to specific locations
- **Flexible Actions**:
  - Create new notes with custom titles, frontmatter, and content
  - Insert content into existing notes at specific locations
  - Modify frontmatter properties based on matched patterns
- **Folder Monitoring**: Automatically process new images dropped into a monitored folder
- **Mobile Support**: Full support for iOS and Android with optional camera capture
- **Daily Note Integration**: Import unmatched notes directly into your daily notes
- **Pattern Testing**: Built-in pattern tester to validate your regex rules before using them
- **Template System**: Use capture groups ({{1}}, {{2}}, etc.) to extract and reuse parts of matched text

## Installation

### From Obsidian Community Plugins

1. Open Settings → Community Plugins
2. Disable Safe Mode if enabled
3. Click Browse and search for "Notebook OCR Plugin"
4. Click Install, then Enable

### Manual Installation

1. Download the latest release from the [GitHub releases page](https://github.com/yourusername/obsidian-notebook-ocr/releases)
2. Extract `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/notebook-ocr-plugin/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Quick Start

### Basic Usage

1. Click the camera icon in the ribbon or use the command palette (Ctrl/Cmd+P) and search for "Import from notebook images"
2. Select one or more images of your handwritten notes
3. The plugin will process the images and import the text into your daily note

### Setting Up Processing Rules

Processing rules allow you to automatically organize your notes based on patterns in the OCR text.

1. Go to Settings → Notebook OCR Plugin → Processing Rules
2. Click "Add Rule"
3. Configure your rule:
   - **Name**: Give your rule a descriptive name
   - **Pattern**: Enter a regex pattern to match (e.g., `Project:\s*(.+)`)
   - **Actions**: Define what happens when the pattern matches

#### Example Rule: Project Notes

**Pattern**: `Project:\s*(.+)`

**Action**: Create Note
- Folder: `Projects`
- Title: `{{1}}`
- Frontmatter: `{"type": "project", "status": "active"}`
- Body: `# {{1}}\n\nCreated from notebook on {{date}}`

When you scan a page with "Project: Website Redesign", it will create a new note at `Projects/Website Redesign.md` with the configured frontmatter and body.

## Usage Examples

### Example 1: Task Capture

Capture tasks from your notebook and add them to a tasks note.

**Handwritten**:
```
- Buy groceries
- Call dentist
- Review project proposal
```

**Rule Pattern**: `^-\s*(.+)$`

**Action**: Insert Content
- Target Note: `Tasks/Inbox.md`
- Insertion Point: Under heading `## Captured Tasks`
- Content Template: `- [ ] {{1}}`

### Example 2: Meeting Notes

Extract meeting information and create structured notes.

**Handwritten**:
```
Meeting: Q4 Planning
Date: 2024-12-15
Attendees: Alice, Bob, Carol
```

**Rule Pattern**: `Meeting:\s*(.+)\nDate:\s*(.+)\nAttendees:\s*(.+)`

**Action**: Create Note
- Folder: `Meetings`
- Title: `{{1}} - {{2}}`
- Frontmatter: `{"type": "meeting", "date": "{{2}}", "attendees": ["{{3}}"]}`
- Body: `# {{1}}\n\n**Date**: {{2}}\n**Attendees**: {{3}}\n\n## Notes\n\n`

### Example 3: Tagging Ideas

Add tags to existing notes based on keywords.

**Handwritten**: `#idea #productivity Automate daily review process`

**Rule Pattern**: `(#\w+)\s+(#\w+)\s+(.+)`

**Action**: Modify Frontmatter
- Target Note: `Ideas/Inbox.md`
- Properties: `{"tags": ["{{1}}", "{{2}}"], "idea": "{{3}}"}`
- Append to Arrays: Yes

## Configuration

### OCR Settings

**OCR Backend**: Choose between local (Tesseract.js) or cloud-based OCR
- **Local (Tesseract.js)**:
  - ✓ Works offline
  - ✓ Privacy-friendly (no data sent externally)
  - ✓ Free
  - ✗ Moderate accuracy for handwriting
  - ✗ Slower processing

- **Cloud API** (Future feature):
  - ✓ Better accuracy for handwriting
  - ✓ Faster processing
  - ✗ Requires internet connection
  - ✗ Requires API key
  - ✗ Data sent to external service

### Daily Note Settings

**Import Heading**: Heading under which imported notes will be placed (default: `## Imported Notes`)

**Default Action**: What to do when no processing rules match
- **Insert into Daily Note**: Add text to today's daily note
- **Discard**: Ignore the text
- **Prompt User**: Ask what to do each time

**Note Separator Pattern**: Regex pattern to detect separate notes (e.g., `^[-*]\s` for lines starting with `-` or `*`)

### Folder Monitoring

**Enable Folder Monitoring**: Automatically process new images in a monitored folder

**Monitored Folder**: Path to the folder to watch (e.g., `Inbox`)

**Monitoring Interval**: How often to check for new images (Hourly or Daily)

**Move Processed Images**: Move images to a separate folder after processing

**Processed Images Folder**: Where to move processed images (e.g., `Processed`)

### Mobile Settings

**Enable Camera Capture**: Enable the camera capture command on mobile devices

**Save Captures To**: Folder where camera captures are saved (e.g., `Captures`)

## Processing Rules

### Rule Components

Each processing rule consists of:

1. **Name**: A descriptive name for the rule
2. **Pattern**: A regular expression to match OCR text
3. **Priority**: Rules are tested in priority order (higher priority first)
4. **Enabled**: Toggle to enable/disable the rule
5. **Actions**: One or more actions to execute when the pattern matches

### Action Types

#### Create Note

Creates a new note with custom content.

**Configuration**:
- **Folder Path**: Where to create the note (e.g., `Projects`, `Notes/Ideas`)
- **Title Template**: Note title using capture groups (e.g., `Project: {{1}}`)
- **Frontmatter**: YAML frontmatter as JSON (e.g., `{"tags": "project", "status": "{{1}}"}`)
- **Body Template**: Note content using capture groups

#### Insert Content

Inserts content into an existing note.

**Configuration**:
- **Target Note**: Path to the note (can use capture groups, e.g., `Projects/{{1}}.md`)
- **Insertion Point**: Where to insert the content
  - Beginning of note
  - End of note
  - Before pattern (regex)
  - After pattern (regex)
  - Under heading (e.g., `## Tasks`)
- **Content Template**: Content to insert using capture groups

#### Modify Frontmatter

Updates frontmatter properties in an existing note.

**Configuration**:
- **Target Note**: Path to the note (can use capture groups)
- **Properties**: Properties to set as JSON (e.g., `{"tags": "{{1}}", "status": "active"}`)
- **Append to Arrays**: If enabled, adds to existing array properties instead of replacing

### Template System

Use capture groups from your regex pattern in templates:

- `{{1}}` - First capture group
- `{{2}}` - Second capture group
- `{{3}}` - Third capture group
- etc.

**Example**:
- Pattern: `Project:\s*(.+)\nStatus:\s*(.+)`
- Title Template: `{{1}}`
- Body Template: `# {{1}}\n\nStatus: {{2}}`

### Pattern Testing

Use the built-in pattern tester to validate your rules:

1. Open the rule editor
2. Expand the "Pattern Tester" section
3. Enter sample OCR text
4. Click "Test" to see:
   - Whether the pattern matches
   - Extracted capture groups
   - Preview of rendered templates

## Commands

The plugin adds the following commands to Obsidian:

- **Import from notebook images**: Open file picker to select and process images
- **Capture and import** (Mobile only): Launch camera to capture and process an image
- **Test processing rules**: Open the rule tester to validate your patterns
- **Process folder now**: Manually trigger folder monitoring to process images immediately

## Troubleshooting

### OCR Not Working

**Problem**: Images are selected but no text is extracted

**Solutions**:
- Ensure the image is clear and well-lit
- Try increasing image contrast before scanning
- Check that the handwriting is legible
- Verify the plugin is fully loaded (check console for errors)

### No Rules Matching

**Problem**: OCR text is extracted but no rules match

**Solutions**:
- Use the pattern tester to validate your regex patterns
- Check that your rules are enabled
- Verify the OCR text format matches your pattern (check console logs)
- Start with simpler patterns and gradually add complexity

### Images Not Processing in Monitored Folder

**Problem**: New images in the monitored folder are not being processed

**Solutions**:
- Verify folder monitoring is enabled in settings
- Check that the monitored folder path is correct
- Ensure the folder exists in your vault
- Try using the "Process folder now" command to trigger manually
- Check the monitoring interval setting

### Mobile Camera Not Working

**Problem**: Camera capture command is not available or not working

**Solutions**:
- Verify you're on a mobile device (iOS or Android)
- Check that camera capture is enabled in settings
- Ensure Obsidian has camera permissions on your device
- Try reloading the plugin
- Use the file picker as an alternative

### Low OCR Accuracy

**Problem**: OCR is extracting incorrect text

**Solutions**:
- Ensure good lighting when photographing notes
- Hold the camera steady and avoid blur
- Use high-resolution images
- Write more clearly and with good spacing
- Consider using cloud OCR (when available) for better accuracy

### Template Placeholders Not Replaced

**Problem**: Templates show `{{1}}` instead of captured text

**Solutions**:
- Verify your regex pattern has capture groups (parentheses)
- Check that the pattern is matching (use pattern tester)
- Ensure capture group numbers match ({{1}} for first group, {{2}} for second, etc.)
- Check for typos in placeholder syntax (must be exactly `{{1}}`, not `{1}` or `{{$1}}`)

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-notebook-ocr.git
cd obsidian-notebook-ocr

# Install dependencies
npm install

# Build the plugin
npm run build

# Or run in development mode with auto-rebuild
npm run dev
```

### Project Structure

```
.
├── main.ts                 # Main plugin file with all classes
├── manifest.json           # Plugin metadata
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── esbuild.config.mjs     # Build configuration
├── versions.json          # Version compatibility
└── .kiro/
    └── specs/
        └── notebook-ocr-plugin/
            ├── requirements.md  # Feature requirements
            ├── design.md       # Design document
            └── tasks.md        # Implementation tasks
```

### Architecture

The plugin is organized into several key components:

- **OCRService**: Handles image-to-text conversion (Tesseract.js)
- **RuleEngine**: Pattern matching and template rendering
- **ActionExecutor**: Executes actions (create note, insert content, modify frontmatter)
- **VaultManager**: File operations within the Obsidian vault
- **FolderMonitor**: Automatic processing of monitored folders
- **ErrorHandler**: User-friendly error messages

## Privacy & Security

- **Local Processing**: By default, all OCR processing happens locally on your device using Tesseract.js
- **No Data Collection**: The plugin does not collect or transmit any data
- **Vault Access**: The plugin only accesses files within your Obsidian vault
- **API Keys**: If using cloud OCR (future feature), API keys are stored securely in Obsidian's data storage

## Roadmap

- [ ] Cloud OCR integration (OpenAI Vision, Google Cloud Vision)
- [ ] Batch processing UI with progress tracking
- [ ] Image preprocessing (rotation, contrast adjustment)
- [ ] PDF support
- [ ] Rule templates/presets for common use cases
- [ ] OCR result editing before processing
- [ ] Export/import rule configurations
- [ ] AI-powered pattern suggestions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/yourusername/obsidian-notebook-ocr/issues)
- **Discussions**: Ask questions or share ideas on [GitHub Discussions](https://github.com/yourusername/obsidian-notebook-ocr/discussions)
- **Documentation**: Full documentation available in the [GitHub Wiki](https://github.com/yourusername/obsidian-notebook-ocr/wiki)

## Acknowledgments

- Built with [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- OCR powered by [Tesseract.js](https://github.com/naptha/tesseract.js)
- Inspired by the need to digitize field research notes

---

Made with ❤️ for the Obsidian community
