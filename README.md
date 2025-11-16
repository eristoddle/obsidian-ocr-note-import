# Notebook OCR Plugin for Obsidian

Transform your handwritten field notebook pages into searchable, organized digital notes. This plugin uses OCR (Optical Character Recognition) to extract text from images of your handwritten notes and intelligently routes them to the right place in your vault using customizable pattern-matching rules.

## Features

- **Multiple OCR Backends**: Choose the best OCR engine for your needs
  - **Local (Tesseract.js)**: Works offline, privacy-friendly, excellent for printed text
  - **OpenAI Vision (GPT-4o)**: Best-in-class handwriting recognition, including cursive
  - **Google Cloud Vision**: High accuracy with generous free tier (1,000 images/month)
- **Intelligent Fallback**: Automatically falls back to local OCR if cloud services fail
- **Image Preprocessing**: Automatic resizing and compression for optimal cloud OCR performance
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

#### Local (Tesseract.js)

- ✓ Works offline
- ✓ Privacy-friendly (no data sent externally)
- ✓ Free
- ✓ **Excellent for printed text** (90-95% accuracy)
- ✗ **Limited handwriting support** (30-60% for clear block letters, poor for cursive)
- ✗ Slower processing
- 💡 **Best for**: Typed documents, printed books, clear block-letter notes

#### OpenAI Vision (GPT-4o)

- ✓ **Excellent accuracy for handwriting** (including cursive and messy writing)
- ✓ Fast processing
- ✓ Handles complex layouts and mixed content
- ✗ Requires internet connection
- ✗ Requires API key (costs ~$0.00265 per image)
- ✗ Data sent to OpenAI servers
- 💡 **Best for**: Handwritten notes, cursive writing, field notebooks

**Setup**:
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Go to Settings → Notebook OCR Plugin → OCR Backend
3. Select "OpenAI Vision"
4. Enter your API key
5. Click "Test Connection" to verify
6. [View pricing details](https://openai.com/api/pricing/)

#### Google Cloud Vision

- ✓ **Excellent accuracy for handwriting** (including cursive)
- ✓ Fast processing
- ✓ First 1,000 images/month free
- ✗ Requires internet connection
- ✗ Requires API key (costs $1.50 per 1,000 images after free tier)
- ✗ Data sent to Google Cloud servers
- 💡 **Best for**: High-volume processing, cost-conscious users

**Setup**:
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Cloud Vision API
3. Create an API key in Credentials
4. Go to Settings → Notebook OCR Plugin → OCR Backend
5. Select "Google Cloud Vision"
6. Enter your API key
7. Click "Test Connection" to verify
8. [View pricing details](https://cloud.google.com/vision/pricing)

#### Fallback Behavior

When using cloud OCR, you can enable automatic fallback to local Tesseract if the cloud service fails:

- **Enable Fallback to Local OCR**: If enabled, the plugin will automatically retry with Tesseract.js when cloud OCR fails (due to network issues, rate limits, or API errors)
- **Notification**: You'll be notified when fallback is used
- **Best Practice**: Keep fallback enabled for reliability, especially when working offline or with unreliable internet

#### Image Preprocessing

Cloud OCR services work best with optimized images. Enable preprocessing to automatically:

- **Resize large images**: Images larger than the configured dimension (default: 2048px) are resized
- **Compress files**: Images larger than the configured size (default: 4MB) are compressed
- **Preserve originals**: Your original image files remain unchanged in the vault
- **Reduce costs**: Smaller images = faster processing and lower API costs

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

## Cloud OCR Setup Guide

> 📖 **For detailed setup instructions with screenshots and troubleshooting, see the [Cloud OCR Setup Guide](CLOUD-OCR-SETUP.md)**

### Getting an OpenAI API Key

1. **Create an OpenAI Account**
   - Visit [OpenAI Platform](https://platform.openai.com/)
   - Sign up or log in to your account

2. **Add Payment Method**
   - Go to [Billing](https://platform.openai.com/account/billing)
   - Add a payment method (required for API access)
   - Consider setting usage limits to control costs

3. **Create API Key**
   - Navigate to [API Keys](https://platform.openai.com/api-keys)
   - Click "Create new secret key"
   - Give it a name (e.g., "Obsidian OCR")
   - Copy the key (starts with `sk-`)
   - ⚠️ **Important**: Save the key securely - you won't be able to see it again

4. **Configure in Obsidian**
   - Open Obsidian Settings → Notebook OCR Plugin
   - Select "OpenAI Vision" as OCR Backend
   - Paste your API key
   - Click "Test Connection" to verify

5. **Monitor Usage**
   - Check usage at [OpenAI Usage Dashboard](https://platform.openai.com/account/usage)
   - Typical cost: ~$0.00265 per image (1024x1024)
   - Set up usage alerts to avoid surprises

### Getting a Google Cloud Vision API Key

1. **Create Google Cloud Account**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Sign up or log in (free tier includes $300 credit)

2. **Create a Project**
   - Click "Select a project" → "New Project"
   - Enter a project name (e.g., "Obsidian OCR")
   - Click "Create"

3. **Enable Cloud Vision API**
   - Go to [APIs & Services](https://console.cloud.google.com/apis/library)
   - Search for "Cloud Vision API"
   - Click "Enable"

4. **Create API Key**
   - Go to [Credentials](https://console.cloud.google.com/apis/credentials)
   - Click "Create Credentials" → "API Key"
   - Copy the API key (starts with `AIza`)
   - (Optional) Click "Restrict Key" to limit to Cloud Vision API only

5. **Configure in Obsidian**
   - Open Obsidian Settings → Notebook OCR Plugin
   - Select "Google Cloud Vision" as OCR Backend
   - Paste your API key
   - (Optional) Enter your project ID
   - Click "Test Connection" to verify

6. **Monitor Usage**
   - Check usage at [Cloud Console Billing](https://console.cloud.google.com/billing)
   - Free tier: First 1,000 images/month
   - After free tier: $1.50 per 1,000 images

### Cost Comparison

| Provider | Free Tier | Cost After Free Tier | Best For |
|----------|-----------|---------------------|----------|
| **Tesseract.js** | Unlimited | Free | Printed text, privacy-conscious users |
| **OpenAI Vision** | None | ~$0.00265/image | Best handwriting accuracy, complex layouts |
| **Google Cloud Vision** | 1,000/month | $1.50/1,000 images | High volume, budget-conscious |

**Example Monthly Costs**:
- 100 images/month: OpenAI $0.27, Google Free
- 500 images/month: OpenAI $1.33, Google Free
- 2,000 images/month: OpenAI $5.30, Google $1.50
- 5,000 images/month: OpenAI $13.25, Google $6.00

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

### Handwriting Not Recognized (Garbled Output)

**Problem**: OCR produces gibberish like `w ) L 9 i - %! P i \ ... '" » A\`

**Cause**: Tesseract.js is optimized for **printed text**, not handwriting

**Solutions**:
- **For best results**: Use printed text, typed documents, or very clear block-letter handwriting
- **Improve handwriting recognition**:
  - Write in clear, separated block letters (not cursive)
  - Use dark ink on white paper
  - Ensure high contrast and good lighting
  - Write larger and with more spacing
  - Take photos straight-on (not at an angle)
- **Alternative**: Wait for cloud OCR integration (GPT-4 Vision handles handwriting much better)
- **Workaround**: Type important notes or use a digital pen/tablet for better OCR results

### Template Placeholders Not Replaced

**Problem**: Templates show `{{1}}` instead of captured text

**Solutions**:
- Verify your regex pattern has capture groups (parentheses)
- Check that the pattern is matching (use pattern tester)
- Ensure capture group numbers match ({{1}} for first group, {{2}} for second, etc.)
- Check for typos in placeholder syntax (must be exactly `{{1}}`, not `{1}` or `{{$1}}`)

### Cloud OCR Authentication Failed

**Problem**: "Invalid API key" or "Authentication failed" error

**Solutions**:
- **OpenAI**: Verify your API key starts with `sk-` and is copied correctly
- **Google Cloud**: Verify your API key starts with `AIza` and is copied correctly
- Check that you haven't accidentally included spaces or line breaks
- Ensure your API key hasn't been revoked or expired
- For OpenAI: Verify you have a payment method on file
- For Google Cloud: Verify the Cloud Vision API is enabled for your project
- Use the "Test Connection" button to diagnose the issue

### Cloud OCR Rate Limit Exceeded

**Problem**: "Rate limit exceeded" or "429 error"

**Solutions**:
- **OpenAI**: You've exceeded your rate limit (requests per minute)
  - Wait a few minutes before trying again
  - Consider upgrading your OpenAI plan for higher limits
  - Process images in smaller batches
- **Google Cloud**: You've exceeded your quota
  - Check your quota limits in Google Cloud Console
  - Wait until your quota resets (usually monthly)
  - Request a quota increase if needed

### Cloud OCR Network Errors

**Problem**: "Network error" or "Connection failed"

**Solutions**:
- Check your internet connection
- Verify you can access the provider's website (openai.com or cloud.google.com)
- Check if your firewall or VPN is blocking API requests
- Try disabling any proxy settings
- If using a custom endpoint (OpenAI), verify the URL is correct
- Enable fallback to local OCR for offline reliability

### Cloud OCR Costs Higher Than Expected

**Problem**: Unexpected API charges

**Solutions**:
- **Monitor usage**: Check your provider's usage dashboard regularly
- **Set up alerts**: Configure billing alerts in your provider's console
- **Enable preprocessing**: Reduce image sizes to lower costs
- **Use fallback wisely**: Fallback to Tesseract can save costs for simple images
- **Batch processing**: Process multiple images at once to avoid repeated small charges
- **Consider Google Cloud**: Free tier of 1,000 images/month may be sufficient
- **Set usage limits**: Configure spending limits in your provider's billing settings

### Fallback Not Working

**Problem**: Cloud OCR fails but doesn't fall back to Tesseract

**Solutions**:
- Verify "Enable Fallback to Local OCR" is enabled in settings
- Check that Tesseract is properly initialized (try local OCR directly)
- Look for error messages in the developer console (Ctrl+Shift+I)
- Ensure the image format is supported by Tesseract
- Try reloading the plugin

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

- [x] Cloud OCR integration (OpenAI Vision, Google Cloud Vision)
- [x] Image preprocessing (resizing, compression)
- [x] Automatic fallback between OCR providers
- [ ] Batch processing UI with progress tracking
- [ ] Advanced image preprocessing (rotation, contrast adjustment)
- [ ] PDF support
- [ ] Rule templates/presets for common use cases
- [ ] OCR result editing before processing
- [ ] Export/import rule configurations
- [ ] AI-powered pattern suggestions
- [ ] Additional cloud providers (Azure Computer Vision, AWS Textract)

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

## Additional Resources

- **[Cloud OCR Setup Guide](CLOUD-OCR-SETUP.md)**: Complete guide to setting up OpenAI and Google Cloud Vision
- **[Handwriting OCR Tips](HANDWRITING-TIPS.md)**: Comprehensive guide to improving handwriting recognition
- **[Architecture Documentation](ARCHITECTURE.md)**: Technical deep-dive for developers
- **[Debugging Guide](DEBUGGING.md)**: Troubleshooting OCR issues
- **[Example Rules](example-rules.json)**: Ready-to-use rule configurations

## Acknowledgments

- Built with [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- OCR powered by [Tesseract.js](https://github.com/naptha/tesseract.js)
- Inspired by the need to digitize field research notes

---

Made with ❤️ for the Obsidian community
