# Notebook OCR Plugin for Obsidian

Process handwritten field notebook images using OCR and intelligently import extracted text into Obsidian notes with pattern-based routing.

## Features

- **OCR Processing**: Convert handwritten notebook images to text using local (Tesseract.js) or cloud-based OCR
- **Pattern-Based Routing**: Define custom regex patterns to automatically route notes to specific locations
- **Flexible Actions**: Create new notes, insert content, or modify frontmatter based on matched patterns
- **Folder Monitoring**: Automatically process new images dropped into a monitored folder
- **Mobile Support**: Works on iOS and Android with optional camera capture
- **Daily Note Integration**: Import unmatched notes directly into your daily notes

## Installation

### From Obsidian Community Plugins

1. Open Settings → Community Plugins
2. Search for "Notebook OCR Plugin"
3. Click Install, then Enable

### Manual Installation

1. Download the latest release from GitHub
2. Extract the files to your vault's `.obsidian/plugins/notebook-ocr-plugin/` directory
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

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
├── main.ts                 # Main plugin file
├── manifest.json           # Plugin metadata
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── esbuild.config.mjs     # Build configuration
└── versions.json          # Version compatibility
```

## Usage

(Documentation will be expanded as features are implemented)

## License

MIT

## Support

For issues, feature requests, or questions, please visit the [GitHub repository](https://github.com/yourusername/obsidian-notebook-ocr).
