# Notebook OCR Plugin Architecture

A deep dive into the architecture of an Obsidian plugin that transforms handwritten notes into organized digital content using OCR and pattern-based routing.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Design Patterns](#design-patterns)
6. [Key Technical Decisions](#key-technical-decisions)
7. [Performance Considerations](#performance-considerations)
8. [Error Handling Strategy](#error-handling-strategy)

---

## Overview

The Notebook OCR Plugin is built as a single-file TypeScript application (`main.ts`, ~3,500 lines) that integrates with the Obsidian API. It follows a modular architecture with clear separation of concerns, despite being contained in a single file for simplicity of distribution.

### Technology Stack

- **Runtime**: Obsidian Plugin API (Electron-based)
- **Language**: TypeScript
- **OCR Engine**: Tesseract.js (WebAssembly-based)
- **Build Tool**: esbuild
- **Pattern Matching**: JavaScript RegExp with custom template engine

---

## System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Obsidian Plugin Host                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   NotebookOCRPlugin                          │
│  (Main Plugin Class - Orchestration & Lifecycle)            │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  OCRService  │ │  RuleEngine  │ │VaultManager  │ │FolderMonitor │
│              │ │              │ │              │ │              │
│ • Tesseract  │ │ • Pattern    │ │ • File Ops   │ │ • Auto       │
│   Worker     │ │   Matching   │ │ • Daily Note │ │   Processing │
│ • Image      │ │ • Template   │ │ • Frontmatter│ │ • Scheduling │
│   Processing │ │   Rendering  │ │              │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
         │              │              │
         └──────────────┼──────────────┘
                        ▼
                ┌──────────────┐
                │ActionExecutor│
                │              │
                │ • Create Note│
                │ • Insert     │
                │ • Modify FM  │
                └──────────────┘
                        │
                        ▼
                ┌──────────────┐
                │ErrorHandler  │
                │              │
                │ • User-      │
                │   Friendly   │
                │   Messages   │
                └──────────────┘
```

---

## Core Components

### 1. **NotebookOCRPlugin** (Main Orchestrator)

**Responsibility**: Plugin lifecycle management and component coordination

```typescript
export default class NotebookOCRPlugin extends Plugin {
    settings: PluginSettings;
    ocrService: OCRService | null = null;
    vaultManager: VaultManager | null = null;
    ruleEngine: RuleEngine | null = null;
    folderMonitor: FolderMonitor | null = null;
}
```

**Key Methods**:
- `onload()`: Initialize all services and register commands
- `onunload()`: Cleanup resources (terminate OCR worker, stop monitoring)
- `processImages()`: Main entry point for image processing pipeline
- `applyDefaultAction()`: Fallback when no rules match

**Design Notes**:
- Uses dependency injection pattern for testability
- Manages service lifecycle explicitly
- Coordinates between UI (commands, modals) and business logic

---

### 2. **OCRService** (Image-to-Text Conversion)

**Responsibility**: Abstract OCR processing with pluggable backends

```typescript
interface OCRService {
    initialize(): Promise<void>;
    processImage(imageData: ArrayBuffer): Promise<OCRResult>;
    isAvailable(): boolean;
}

class TesseractOCRService implements OCRService {
    private worker: Worker | null = null;
    private initialized = false;
}
```

**Key Features**:
- **Interface-based design**: Allows swapping OCR backends (Tesseract, Cloud APIs)
- **Lazy initialization**: Worker created on first use
- **Resource management**: Explicit `terminate()` for cleanup
- **Error encapsulation**: Returns structured `OCRResult` with error field

**Technical Details**:
- Uses Tesseract.js WebAssembly worker for parallel processing
- Downloads language data from CDN on first use
- Converts ArrayBuffer → Blob for Tesseract compatibility
- Returns confidence scores for quality assessment

**Why This Design?**:
- Interface allows future cloud OCR integration (OpenAI Vision, Google Cloud Vision)
- Worker isolation prevents blocking main thread
- Structured error handling enables graceful degradation

---

### 3. **RuleEngine** (Pattern Matching & Template Rendering)

**Responsibility**: Match OCR text against regex patterns and render templates

```typescript
class RuleEngine {
    private rules: ProcessingRule[];
    private regexCache: Map<string, RegExp>;

    async matchAndExecute(text: string): Promise<RuleMatch[]>
    testPattern(pattern: string, text: string): PatternTestResult
    static renderTemplate(template: string, captureGroups: string[]): string
    static validateTemplate(template: string): ValidationResult
}
```

**Key Features**:
- **Regex caching**: Compiled patterns stored in Map for performance
- **Priority-based matching**: Rules sorted by priority before testing
- **Capture group extraction**: Automatic extraction of regex groups
- **Template validation**: Syntax checking before execution
- **Static utility methods**: Template rendering decoupled from instance state

**Template System**:
```typescript
// Pattern: "Project:\s*(.+)\nStatus:\s*(.+)"
// Template: "# {{1}}\n\nStatus: {{2}}"
// Input: "Project: Website Redesign\nStatus: Active"
// Output: "# Website Redesign\n\nStatus: Active"
```

**Design Decisions**:
- **Why regex?** Flexible, powerful, familiar to power users
- **Why caching?** Regex compilation is expensive; cache improves performance
- **Why static rendering?** Allows testing without RuleEngine instance

---

### 4. **VaultManager** (File System Operations)

**Responsibility**: All interactions with Obsidian's vault (file system)

```typescript
class VaultManager {
    private app: App;
    private vault: Vault;

    async getDailyNote(date: Date): Promise<TFile>
    async createNote(folderPath, title, frontmatter, body): Promise<TFile>
    async insertContent(targetPath, content, insertionPoint): Promise<void>
    async modifyFrontmatter(file, properties, append): Promise<void>
}
```

**Key Features**:
- **Daily note intelligence**: Searches common locations, creates if missing
- **Frontmatter parsing**: Manual YAML parsing (Obsidian API limitation)
- **Insertion point flexibility**: 5 insertion strategies (beginning, end, before/after pattern, under heading)
- **Automatic folder creation**: Creates missing folders with user notification
- **Duplicate handling**: Generates unique filenames when conflicts occur

**Insertion Point Strategies**:
1. **Beginning**: Prepend to file
2. **End**: Append to file
3. **Before Pattern**: Insert before first regex match
4. **After Pattern**: Insert after first regex match
5. **Under Heading**: Insert after heading, before next same-level heading

**Why Manual Frontmatter Parsing?**:
- Obsidian's API doesn't provide direct frontmatter modification
- Need to preserve formatting and handle arrays
- Allows append-to-array functionality

---

### 5. **ActionExecutor** (Rule Action Execution)

**Responsibility**: Execute actions defined in matched rules

```typescript
class ActionExecutor {
    private vaultManager: VaultManager;

    async executeCreateNote(config, captureGroups): Promise<ActionResult>
    async executeInsertContent(config, captureGroups): Promise<ActionResult>
    async executeModifyFrontmatter(config, captureGroups): Promise<ActionResult>
    async executeActions(ruleMatch: RuleMatch): Promise<ActionResult[]>
}
```

**Action Types**:

1. **Create Note**: New file with frontmatter and body
2. **Insert Content**: Add content to existing note
3. **Modify Frontmatter**: Update/append properties

**Key Features**:
- **Template rendering**: Uses `RuleEngine.renderTemplate()` for all templates
- **Target resolution**: Supports templated note paths
- **Batch execution**: Executes all actions for a rule sequentially
- **Error isolation**: One action failure doesn't stop others
- **Result tracking**: Returns detailed results for each action

**Design Pattern**: Command Pattern
- Each action type is a separate method
- Encapsulates action execution logic
- Easy to add new action types

---

### 6. **FolderMonitor** (Automated Processing)

**Responsibility**: Monitor folder for new images and auto-process

```typescript
class FolderMonitor {
    private plugin: NotebookOCRPlugin;
    private intervalId: number | null = null;
    private processedFiles: Set<string>;

    start(folderPath: string, interval: 'hourly' | 'daily'): void
    stop(): void
    async checkForNewImages(folderPath: string): Promise<void>
    async markAsProcessed(imageFile: TFile): Promise<void>
}
```

**Key Features**:
- **Interval-based checking**: Hourly or daily scans
- **Processed file tracking**: Persisted to plugin data
- **Batch processing**: Handles multiple new images
- **Optional file moving**: Moves processed images to archive folder
- **Progress notifications**: User feedback during processing

**State Persistence**:
```typescript
// Stored in plugin data
{
    processedFiles: [
        "Inbox/scan-001.jpg",
        "Inbox/scan-002.jpg"
    ]
}
```

**Why Not File System Watchers?**:
- Obsidian API doesn't expose file system events
- Interval-based approach is more reliable across platforms
- Lower resource usage than continuous watching

---

### 7. **ErrorHandler** (User-Friendly Error Messages)

**Responsibility**: Convert technical errors into actionable user messages

```typescript
class ErrorHandler {
    static handleOCRError(error: Error, imagePath: string): void
    static handleRuleError(error: Error, rule: ProcessingRule, action?: RuleAction): void
    static handleFileSystemError(error: Error, operation: string, filePath?: string): void
    static handleValidationError(message: string, suggestion?: string): void
}
```

**Error Categories**:

1. **OCR Errors**: Initialization, timeout, no text found
2. **Rule Errors**: Invalid regex, missing target, frontmatter issues
3. **File System Errors**: Not found, permissions, disk space
4. **Validation Errors**: User input issues

**Example Transformation**:
```typescript
// Technical error
throw new Error("ENOENT: no such file or directory")

// User-friendly message
"Failed to create note: File or folder not found.
 The folder will be created automatically."
```

**Design Philosophy**:
- Never show raw error messages to users
- Always provide context (what operation failed)
- Suggest solutions when possible
- Log technical details to console for debugging

---

## Data Flow

### Image Processing Pipeline

```
┌─────────────────┐
│ User Action     │
│ • File picker   │
│ • Camera        │
│ • Folder monitor│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Image Data      │
│ (ArrayBuffer)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OCRService      │
│ • Tesseract.js  │
│ • Extract text  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OCR Result      │
│ • text          │
│ • confidence    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ RuleEngine      │
│ • Match patterns│
│ • Extract groups│
└────────┬────────┘
         │
         ├─── No Match ───┐
         │                │
         ▼                ▼
┌─────────────────┐  ┌──────────────┐
│ ActionExecutor  │  │ Default      │
│ • Execute rules │  │ Action       │
│ • Render temps  │  │ • Daily note │
└────────┬────────┘  │ • Discard    │
         │           │ • Prompt     │
         │           └──────────────┘
         ▼
┌─────────────────┐
│ VaultManager    │
│ • Create notes  │
│ • Insert content│
│ • Modify FM     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Success/Error   │
│ Notification    │
└─────────────────┘
```

### Rule Matching Flow

```
Input Text: "Project: Website Redesign\nStatus: Active"

1. RuleEngine.matchAndExecute(text)
   ├─ Sort rules by priority
   ├─ For each enabled rule:
   │  ├─ Compile regex (or get from cache)
   │  ├─ Test pattern against text
   │  └─ If match: extract capture groups
   └─ Return RuleMatch[]

2. ActionExecutor.executeActions(ruleMatch)
   ├─ For each action in rule:
   │  ├─ Render templates with capture groups
   │  │  Template: "# {{1}}"
   │  │  Groups: ["Website Redesign", "Active"]
   │  │  Result: "# Website Redesign"
   │  ├─ Execute action (create/insert/modify)
   │  └─ Track result
   └─ Return ActionResult[]

3. VaultManager.createNote(...)
   ├─ Validate inputs
   ├─ Ensure folder exists
   ├─ Generate unique filename
   ├─ Build frontmatter YAML
   ├─ Create file
   └─ Return TFile
```

---

## Design Patterns

### 1. **Strategy Pattern** (OCR Backends)

```typescript
interface OCRService {
    initialize(): Promise<void>;
    processImage(imageData: ArrayBuffer): Promise<OCRResult>;
    isAvailable(): boolean;
}

// Current implementation
class TesseractOCRService implements OCRService { }

// Future implementations
class OpenAIVisionService implements OCRService { }
class GoogleCloudVisionService implements OCRService { }

// Factory
async function createOCRService(settings: PluginSettings): Promise<OCRService> {
    if (settings.ocrBackend === 'cloud') {
        return new CloudOCRService();
    }
    return new TesseractOCRService();
}
```

**Benefits**:
- Easy to add new OCR providers
- Swap implementations without changing client code
- Test with mock OCR service

---

### 2. **Command Pattern** (Actions)

```typescript
interface RuleAction {
    type: 'create-note' | 'insert-content' | 'modify-frontmatter';
    config: ActionConfig;
}

class ActionExecutor {
    async executeActions(ruleMatch: RuleMatch): Promise<ActionResult[]> {
        for (const action of ruleMatch.rule.actions) {
            switch (action.type) {
                case 'create-note':
                    result = await this.executeCreateNote(...);
                    break;
                case 'insert-content':
                    result = await this.executeInsertContent(...);
                    break;
                // ...
            }
        }
    }
}
```

**Benefits**:
- Actions are data (can be serialized to JSON)
- Easy to add new action types
- Actions can be queued, logged, undone (future feature)

---

### 3. **Template Method Pattern** (Image Processing)

```typescript
class NotebookOCRPlugin {
    private async processImages(files: File[]): Promise<void> {
        // Template method defines the algorithm
        for (const file of files) {
            const imageData = await file.arrayBuffer();
            const ocrResult = await this.ocrService.processImage(imageData);

            if (ocrResult.error) {
                this.handleError(ocrResult.error);
                continue;
            }

            const matches = await this.ruleEngine.matchAndExecute(ocrResult.text);

            if (matches.length > 0) {
                await this.executeMatches(matches);
            } else {
                await this.applyDefaultAction(ocrResult.text);
            }
        }
    }
}
```

---

### 4. **Observer Pattern** (Settings Changes)

```typescript
class NotebookOCRSettingTab {
    display(): void {
        new Setting(containerEl)
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.folderMonitoringEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.folderMonitoringEnabled = value;
                    await this.plugin.saveSettings();

                    // Notify observers
                    if (this.plugin.folderMonitor) {
                        if (value) {
                            this.plugin.folderMonitor.start(...);
                        } else {
                            this.plugin.folderMonitor.stop();
                        }
                    }
                }));
    }
}
```

---

### 5. **Facade Pattern** (VaultManager)

```typescript
// Complex Obsidian API
app.vault.getAbstractFileByPath()
app.vault.create()
app.vault.modify()
app.vault.createFolder()

// Simple facade
class VaultManager {
    async createNote(folderPath, title, frontmatter, body) {
        // Handles all complexity internally
        await this.ensureFolderExists(folderPath);
        const uniquePath = await this.getUniqueFilePath(filePath);
        const content = this.buildFrontmatter(frontmatter) + body;
        return await this.vault.create(uniquePath, content);
    }
}
```

---

## Key Technical Decisions

### 1. **Single File Architecture**

**Decision**: Keep all code in `main.ts` (~3,500 lines)

**Rationale**:
- Simpler distribution (one file to copy)
- No module bundling complexity
- Easier for users to inspect/modify
- TypeScript classes provide sufficient organization

**Trade-offs**:
- ✅ Simple deployment
- ✅ No build complexity
- ❌ Harder to navigate
- ❌ Can't lazy-load modules

---

### 2. **Tesseract.js for OCR**

**Decision**: Use Tesseract.js (WebAssembly) instead of native or cloud OCR

**Rationale**:
- Works offline (privacy-friendly)
- No API keys required
- Cross-platform (desktop + mobile)
- Reasonable accuracy for printed text
- Free and open source

**Trade-offs**:
- ✅ Privacy-friendly
- ✅ No costs
- ✅ Works offline
- ❌ Slower than cloud APIs
- ❌ Lower accuracy for handwriting
- ❌ Large initial download (~2MB language data)

---

### 3. **Regex for Pattern Matching**

**Decision**: Use JavaScript RegExp instead of custom DSL or AI

**Rationale**:
- Powerful and flexible
- Familiar to developers
- No external dependencies
- Deterministic (testable)
- Fast execution

**Trade-offs**:
- ✅ Powerful and flexible
- ✅ No dependencies
- ✅ Fast
- ❌ Steep learning curve for non-developers
- ❌ Can be fragile with OCR errors
- ❌ No fuzzy matching

**Future Enhancement**: Add AI-powered pattern suggestions

---

### 4. **Manual Frontmatter Parsing**

**Decision**: Parse YAML frontmatter manually instead of using library

**Rationale**:
- Obsidian API doesn't provide frontmatter modification
- Avoid adding dependencies (yaml-js, gray-matter)
- Need custom behavior (append to arrays)
- Simple YAML subset is sufficient

**Implementation**:
```typescript
// Parse frontmatter
const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
const match = content.match(frontmatterRegex);

// Handle key-value pairs and arrays
for (const line of lines) {
    const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
    const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
    // ...
}
```

**Trade-offs**:
- ✅ No dependencies
- ✅ Custom behavior
- ✅ Small code size
- ❌ Limited YAML support
- ❌ Potential parsing bugs
- ❌ Doesn't preserve comments

---

### 5. **Interval-Based Folder Monitoring**

**Decision**: Poll folder at intervals instead of file system watching

**Rationale**:
- Obsidian API doesn't expose file system events
- Cross-platform compatibility
- Lower resource usage
- Simpler implementation

**Implementation**:
```typescript
start(folderPath: string, interval: 'hourly' | 'daily'): void {
    const intervalMs = interval === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    this.intervalId = window.setInterval(() => {
        this.checkForNewImages(folderPath);
    }, intervalMs);
}
```

**Trade-offs**:
- ✅ Simple and reliable
- ✅ Cross-platform
- ✅ Low resource usage
- ❌ Not real-time
- ❌ Potential delays

---

## Performance Considerations

### 1. **Regex Caching**

```typescript
class RuleEngine {
    private regexCache: Map<string, RegExp>;

    private getCompiledRegex(pattern: string): RegExp {
        if (!this.regexCache.has(pattern)) {
            this.regexCache.set(pattern, new RegExp(pattern, 'gm'));
        }
        return this.regexCache.get(pattern)!;
    }
}
```

**Impact**: 10-100x faster for repeated pattern matching

---

### 2. **OCR Worker Isolation**

```typescript
class TesseractOCRService {
    private worker: Worker | null = null;

    async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
        // Runs in separate thread, doesn't block UI
        const result = await this.worker.recognize(blob);
        return result;
    }
}
```

**Impact**: UI remains responsive during OCR processing

---

### 3. **Lazy Initialization**

```typescript
async onload() {
    // Only initialize OCR when first needed
    try {
        this.ocrService = await createOCRService(this.settings);
    } catch (error) {
        // Fail gracefully, initialize later
        console.error('Failed to initialize OCR service:', error);
    }
}
```

**Impact**: Faster plugin load time

---

### 4. **Batch Processing with Progress**

```typescript
private async processImages(files: File[]): Promise<void> {
    for (let i = 0; i < files.length; i++) {
        new Notice(`Processing image ${i + 1}/${files.length}...`);
        await this.processImage(files[i]);
    }
}
```

**Impact**: User feedback prevents perceived slowness

---

## Error Handling Strategy

### 1. **Layered Error Handling**

```
┌─────────────────────────────────────┐
│ User-Facing Layer                   │
│ • ErrorHandler.handleXXXError()     │
│ • User-friendly messages            │
│ • Actionable suggestions            │
└─────────────────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────┐
│ Business Logic Layer                │
│ • Try-catch blocks                  │
│ • Error context enrichment          │
│ • Partial failure handling          │
└─────────────────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────┐
│ Service Layer                       │
│ • Structured error returns          │
│ • Error codes/types                 │
│ • Technical details                 │
└─────────────────────────────────────┘
```

---

### 2. **Graceful Degradation**

```typescript
// OCR service fails to initialize
if (!this.ocrService || !this.ocrService.isAvailable()) {
    ErrorHandler.handleValidationError(
        'OCR service is not available.',
        'Please check plugin settings and ensure the OCR engine is properly initialized.'
    );
    return; // Don't crash, just skip processing
}
```

---

### 3. **Partial Success Handling**

```typescript
// Process multiple images, continue on individual failures
for (const file of files) {
    try {
        await this.processImage(file);
        successCount++;
    } catch (error) {
        ErrorHandler.handleOCRError(error, file.name);
        errorCount++;
    }
}

// Show summary
new Notice(`✓ ${successCount} processed, ✗ ${errorCount} failed`);
```

---

### 4. **Error Context Preservation**

```typescript
static handleRuleError(error: Error, rule: ProcessingRule, action?: RuleAction): void {
    const actionType = action ? ` (${action.type})` : '';
    console.error(`Rule execution error for "${rule.name}"${actionType}:`, error);

    // Context helps debugging
    let userMessage = `Rule "${rule.name}" failed${actionType}`;

    // Specific guidance based on error type
    if (error.message.includes('Target note not found')) {
        userMessage += ': Target note does not exist. Check the note path in your rule configuration.';
    }
    // ...
}
```

---

## Lessons Learned

### 1. **Start Simple, Add Complexity**

Initial design had separate files for each class. Consolidated to single file for simpler distribution. TypeScript classes provide sufficient organization.

### 2. **User Experience > Technical Purity**

Manual frontmatter parsing is "impure" but provides better UX (append to arrays, preserve formatting) than using a library.

### 3. **Error Messages Matter**

Spent significant time on `ErrorHandler` to convert technical errors into actionable user messages. This dramatically improved user experience.

### 4. **Test with Real Data**

OCR output is messy. Regex patterns that work with clean text often fail with OCR errors. Always test with real scanned images.

### 5. **Progressive Enhancement**

Started with basic "insert into daily note" functionality. Added rules, actions, folder monitoring incrementally. Each feature builds on previous ones.

---

## Future Enhancements

### 1. **Cloud OCR Integration**

```typescript
class OpenAIVisionService implements OCRService {
    async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
        const base64 = arrayBufferToBase64(imageData);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4-vision-preview',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract all text from this image.' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
                    ]
                }]
            })
        });
        // ...
    }
}
```

### 2. **AI-Powered Pattern Suggestions**

Use LLM to analyze OCR text and suggest appropriate rules:

```typescript
async suggestRules(ocrText: string): Promise<ProcessingRule[]> {
    const prompt = `Analyze this OCR text and suggest regex patterns to extract structured data:\n\n${ocrText}`;
    const suggestions = await callLLM(prompt);
    return parseRuleSuggestions(suggestions);
}
```

### 3. **Image Preprocessing**

Add rotation, contrast adjustment, noise reduction before OCR:

```typescript
class ImagePreprocessor {
    async preprocess(imageData: ArrayBuffer): Promise<ArrayBuffer> {
        const canvas = await loadImageToCanvas(imageData);
        this.adjustContrast(canvas);
        this.removeNoise(canvas);
        this.deskew(canvas);
        return canvasToArrayBuffer(canvas);
    }
}
```

### 4. **Batch Processing UI**

Show progress, allow cancellation, preview results:

```typescript
class BatchProcessingModal extends Modal {
    async processBatch(files: File[]): Promise<void> {
        for (let i = 0; i < files.length; i++) {
            this.updateProgress(i, files.length);
            if (this.cancelled) break;
            await this.processFile(files[i]);
        }
    }
}
```

---

## Conclusion

The Notebook OCR Plugin demonstrates how to build a complex Obsidian plugin with:

- **Clean architecture**: Separation of concerns despite single-file structure
- **Extensibility**: Interface-based design allows adding new features
- **User experience**: Comprehensive error handling and helpful messages
- **Performance**: Caching, worker isolation, lazy initialization
- **Flexibility**: Powerful rule system for customization

The architecture balances simplicity (single file, no complex build) with maintainability (clear class boundaries, design patterns) to create a plugin that's both powerful and approachable.

---

## Resources

- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Plugin Source Code](https://github.com/yourusername/obsidian-notebook-ocr)

---

*This architecture document was created as part of the plugin development process using spec-driven development methodology.*
