import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Vault, normalizePath, Modal } from 'obsidian';
import { createWorker, Worker } from 'tesseract.js';

/**
 * OCR service interface
 */
interface OCRService {
	initialize(): Promise<void>;
	processImage(imageData: ArrayBuffer): Promise<OCRResult>;
	isAvailable(): boolean;
}

/**
 * OCR result interface
 */
interface OCRResult {
	text: string;
	confidence: number;
	error?: string;
}

/**
 * Plugin settings interface
 */
interface PluginSettings {
	// OCR Settings
	ocrBackend: 'tesseract' | 'cloud';
	cloudApiKey?: string;
	cloudApiProvider?: 'openai' | 'google';

	// Daily Note Settings
	dailyNoteImportHeading: string;

	// Processing Rules
	processingRules: ProcessingRule[];

	// Default Action Settings
	defaultAction: 'daily-note' | 'discard' | 'prompt';
	noteSeparatorPattern: string;

	// Folder Monitoring
	folderMonitoringEnabled: boolean;
	monitoredFolderPath: string;
	monitoringInterval: 'hourly' | 'daily';
	moveProcessedImages: boolean;
	processedImagesFolderPath: string;

	// Mobile Settings
	enableCameraCapture: boolean;
	saveCapturesToFolder: string;
}

/**
 * Processing rule interface
 */
interface ProcessingRule {
	id: string;
	name: string;
	enabled: boolean;
	priority: number;
	pattern: string;
	actions: RuleAction[];
}

/**
 * Rule action interface
 */
interface RuleAction {
	type: 'create-note' | 'insert-content' | 'modify-frontmatter';
	config: ActionConfig;
}

/**
 * Action configuration types
 */
type ActionConfig = CreateNoteConfig | InsertContentConfig | ModifyFrontmatterConfig;

interface CreateNoteConfig {
	folderPath: string;
	titleTemplate: string;
	frontmatter: Record<string, string>;
	bodyTemplate: string;
}

interface InsertContentConfig {
	targetNote: string;
	insertionPoint: InsertionPoint;
	contentTemplate: string;
}

interface InsertionPoint {
	type: 'beginning' | 'end' | 'before-pattern' | 'after-pattern' | 'under-heading';
	pattern?: string;
	heading?: string;
}

interface ModifyFrontmatterConfig {
	targetNote: string;
	properties: Record<string, string>;
	appendToArrays: boolean;
}

/**
 * Tesseract.js OCR service implementation
 */
class TesseractOCRService implements OCRService {
	private worker: Worker | null = null;
	private initialized = false;

	/**
	 * Initialize the Tesseract worker
	 */
	async initialize(): Promise<void> {
		try {
			this.worker = await createWorker('eng');
			this.initialized = true;
			console.log('Tesseract OCR service initialized');
		} catch (error) {
			console.error('Failed to initialize Tesseract OCR service:', error);
			this.initialized = false;
			throw new Error('Failed to initialize OCR service: ' + error.message);
		}
	}

	/**
	 * Process an image and extract text using OCR
	 */
	async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
		if (!this.initialized || !this.worker) {
			return {
				text: '',
				confidence: 0,
				error: 'OCR service not initialized'
			};
		}

		try {
			// Convert ArrayBuffer to Uint8Array for Tesseract
			const imageArray = new Uint8Array(imageData);

			// Perform OCR
			const result = await this.worker.recognize(imageArray);

			return {
				text: result.data.text,
				confidence: result.data.confidence,
			};
		} catch (error) {
			console.error('OCR processing error:', error);
			return {
				text: '',
				confidence: 0,
				error: 'Failed to process image: ' + error.message
			};
		}
	}

	/**
	 * Check if the OCR service is available and initialized
	 */
	isAvailable(): boolean {
		return this.initialized && this.worker !== null;
	}

	/**
	 * Cleanup the Tesseract worker
	 */
	async terminate(): Promise<void> {
		if (this.worker) {
			await this.worker.terminate();
			this.worker = null;
			this.initialized = false;
			console.log('Tesseract OCR service terminated');
		}
	}
}

/**
 * OCR service factory function
 * Creates and initializes the appropriate OCR service based on settings
 */
async function createOCRService(settings: PluginSettings): Promise<OCRService> {
	let service: OCRService;

	if (settings.ocrBackend === 'cloud') {
		// Cloud OCR not yet implemented
		console.warn('Cloud OCR backend not yet implemented, falling back to Tesseract');
		service = new TesseractOCRService();
	} else {
		// Use Tesseract.js for local OCR
		service = new TesseractOCRService();
	}

	try {
		await service.initialize();
		return service;
	} catch (error) {
		console.error('Failed to initialize OCR service:', error);
		throw error;
	}
}

/**
 * VaultManager class for handling all file operations within the Obsidian vault
 */
class VaultManager {
	private app: App;
	private vault: Vault;

	/**
	 * Constructor accepting App and Vault instances
	 */
	constructor(app: App, vault: Vault) {
		this.app = app;
		this.vault = vault;
	}

	/**
	 * Get or create a daily note for a specific date
	 */
	async getDailyNote(date: Date): Promise<TFile> {
		// Format date as YYYY-MM-DD
		const dateStr = date.toISOString().split('T')[0];

		// Try to find existing daily note
		// Check common daily note locations
		const possiblePaths = [
			`${dateStr}.md`,
			`Daily Notes/${dateStr}.md`,
			`Journal/${dateStr}.md`,
			`daily/${dateStr}.md`
		];

		for (const path of possiblePaths) {
			const file = this.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				return file;
			}
		}

		// If not found, create a new daily note in the root
		const filePath = `${dateStr}.md`;
		const content = `# ${dateStr}\n\n`;

		return await this.vault.create(filePath, content);
	}

	/**
	 * Insert content into a daily note under a configured heading
	 */
	async insertIntoDailyNote(content: string, heading?: string): Promise<void> {
		const today = new Date();
		const dailyNote = await this.getDailyNote(today);

		let fileContent = await this.vault.read(dailyNote);

		if (heading) {
			// Find or create the heading
			const headingIndex = this.findHeading(fileContent, heading);

			if (headingIndex === -1) {
				// Heading doesn't exist, add it at the end
				fileContent += `\n${heading}\n\n${content}\n`;
			} else {
				// Find the next heading or end of file
				const lines = fileContent.split('\n');
				const headingLevel = heading.match(/^#+/)?.[0].length || 2;
				let insertIndex = headingIndex + 1;

				// Skip to the line after the heading
				while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
					insertIndex++;
				}

				// Find the next heading of same or higher level
				let nextHeadingIndex = lines.length;
				for (let i = insertIndex; i < lines.length; i++) {
					const line = lines[i];
					const match = line.match(/^(#+)\s/);
					if (match && match[1].length <= headingLevel) {
						nextHeadingIndex = i;
						break;
					}
				}

				// Insert content before the next heading
				lines.splice(nextHeadingIndex, 0, content, '');
				fileContent = lines.join('\n');
			}
		} else {
			// No heading specified, append to end
			fileContent += `\n${content}\n`;
		}

		await this.vault.modify(dailyNote, fileContent);
	}

	/**
	 * Create a new note with frontmatter and body content
	 */
	async createNote(
		folderPath: string,
		title: string,
		frontmatter: Record<string, any>,
		body: string
	): Promise<TFile> {
		// Normalize folder path
		const normalizedFolder = normalizePath(folderPath);

		// Ensure folder exists
		await this.ensureFolderExists(normalizedFolder);

		// Generate file path
		let fileName = `${title}.md`;
		let filePath = normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;

		// Handle duplicate filenames
		filePath = await this.getUniqueFilePath(filePath);

		// Build frontmatter content
		let content = '';
		if (Object.keys(frontmatter).length > 0) {
			content += '---\n';
			for (const [key, value] of Object.entries(frontmatter)) {
				if (Array.isArray(value)) {
					content += `${key}:\n`;
					for (const item of value) {
						content += `  - ${item}\n`;
					}
				} else {
					content += `${key}: ${value}\n`;
				}
			}
			content += '---\n\n';
		}

		content += body;

		return await this.vault.create(filePath, content);
	}

	/**
	 * Insert content at a specified insertion point in a target note
	 */
	async insertContent(
		targetPath: string,
		content: string,
		insertionPoint: InsertionPoint
	): Promise<void> {
		const file = this.vault.getAbstractFileByPath(targetPath);
		if (!(file instanceof TFile)) {
			throw new Error(`Target note not found: ${targetPath}`);
		}

		let fileContent = await this.vault.read(file);

		switch (insertionPoint.type) {
			case 'beginning':
				fileContent = content + '\n\n' + fileContent;
				break;

			case 'end':
				fileContent = fileContent + '\n\n' + content;
				break;

			case 'before-pattern':
				if (insertionPoint.pattern) {
					const index = this.findPattern(fileContent, insertionPoint.pattern);
					if (index !== -1) {
						const lines = fileContent.split('\n');
						lines.splice(index, 0, content, '');
						fileContent = lines.join('\n');
					} else {
						// Pattern not found, append to end
						fileContent = fileContent + '\n\n' + content;
					}
				}
				break;

			case 'after-pattern':
				if (insertionPoint.pattern) {
					const index = this.findPattern(fileContent, insertionPoint.pattern);
					if (index !== -1) {
						const lines = fileContent.split('\n');
						lines.splice(index + 1, 0, '', content);
						fileContent = lines.join('\n');
					} else {
						// Pattern not found, append to end
						fileContent = fileContent + '\n\n' + content;
					}
				}
				break;

			case 'under-heading':
				if (insertionPoint.heading) {
					const index = this.findHeading(fileContent, insertionPoint.heading);
					if (index !== -1) {
						const lines = fileContent.split('\n');
						const headingLevel = insertionPoint.heading.match(/^#+/)?.[0].length || 2;
						let insertIndex = index + 1;

						// Skip empty lines after heading
						while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
							insertIndex++;
						}

						// Insert content
						lines.splice(insertIndex, 0, content, '');
						fileContent = lines.join('\n');
					} else {
						// Heading not found, create it and add content
						fileContent += `\n${insertionPoint.heading}\n\n${content}\n`;
					}
				}
				break;
		}

		await this.vault.modify(file, fileContent);
	}

	/**
	 * Modify frontmatter properties in a note
	 */
	async modifyFrontmatter(
		file: TFile,
		properties: Record<string, any>,
		append: boolean
	): Promise<void> {
		let content = await this.vault.read(file);

		// Parse existing frontmatter
		const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
		const match = content.match(frontmatterRegex);

		let existingFrontmatter: Record<string, any> = {};
		let bodyContent = content;

		if (match) {
			// Parse existing frontmatter
			const frontmatterText = match[1];
			const lines = frontmatterText.split('\n');

			let currentKey: string | null = null;
			let currentArray: string[] = [];

			for (const line of lines) {
				const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
				const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);

				if (keyValueMatch) {
					// Save previous array if exists
					if (currentKey && currentArray.length > 0) {
						existingFrontmatter[currentKey] = currentArray;
						currentArray = [];
					}

					currentKey = keyValueMatch[1];
					const value = keyValueMatch[2].trim();

					if (value) {
						existingFrontmatter[currentKey] = value;
						currentKey = null;
					}
				} else if (arrayItemMatch && currentKey) {
					currentArray.push(arrayItemMatch[1]);
				}
			}

			// Save last array if exists
			if (currentKey && currentArray.length > 0) {
				existingFrontmatter[currentKey] = currentArray;
			}

			// Remove frontmatter from body
			bodyContent = content.substring(match[0].length);
		}

		// Merge properties
		for (const [key, value] of Object.entries(properties)) {
			if (append && Array.isArray(existingFrontmatter[key])) {
				// Append to existing array
				if (Array.isArray(value)) {
					existingFrontmatter[key] = [...existingFrontmatter[key], ...value];
				} else {
					existingFrontmatter[key] = [...existingFrontmatter[key], value];
				}
			} else if (append && existingFrontmatter[key] !== undefined) {
				// Convert to array and append
				const existing = existingFrontmatter[key];
				if (Array.isArray(value)) {
					existingFrontmatter[key] = [existing, ...value];
				} else {
					existingFrontmatter[key] = [existing, value];
				}
			} else {
				// Replace or set new property
				existingFrontmatter[key] = value;
			}
		}

		// Rebuild content with updated frontmatter
		let newContent = '---\n';
		for (const [key, value] of Object.entries(existingFrontmatter)) {
			if (Array.isArray(value)) {
				newContent += `${key}:\n`;
				for (const item of value) {
					newContent += `  - ${item}\n`;
				}
			} else {
				newContent += `${key}: ${value}\n`;
			}
		}
		newContent += '---\n';
		newContent += bodyContent;

		await this.vault.modify(file, newContent);
	}

	/**
	 * Find a heading in content and return its line index
	 */
	findHeading(content: string, heading: string): number {
		const lines = content.split('\n');
		const normalizedHeading = heading.trim().toLowerCase();

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim().toLowerCase();
			if (line === normalizedHeading) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Find a pattern in content and return its line index
	 */
	findPattern(content: string, pattern: string): number {
		const lines = content.split('\n');
		const regex = new RegExp(pattern);

		for (let i = 0; i < lines.length; i++) {
			if (regex.test(lines[i])) {
				return i;
			}
		}

		return -1;
	}

	/**
	 * Ensure a folder exists, creating it if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		if (!folderPath) return;

		const folder = this.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.vault.createFolder(folderPath);
		}
	}

	/**
	 * Get a unique file path by appending a number if the file already exists
	 */
	private async getUniqueFilePath(filePath: string): Promise<string> {
		let uniquePath = filePath;
		let counter = 1;

		while (this.vault.getAbstractFileByPath(uniquePath)) {
			const pathParts = filePath.split('.');
			const extension = pathParts.pop();
			const basePath = pathParts.join('.');
			uniquePath = `${basePath} ${counter}.${extension}`;
			counter++;
		}

		return uniquePath;
	}
}

/**
 * Rule match result interface
 */
interface RuleMatch {
	rule: ProcessingRule;
	captureGroups: string[];
	matchedText: string;
}

/**
 * Pattern test result interface
 */
interface PatternTestResult {
	matched: boolean;
	captureGroups: string[];
	error?: string;
}

/**
 * Regex validation result interface
 */
interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * RuleEngine class for pattern matching and rule execution
 */
class RuleEngine {
	private rules: ProcessingRule[];
	private regexCache: Map<string, RegExp>;

	/**
	 * Constructor to initialize with rules array
	 */
	constructor(rules: ProcessingRule[]) {
		this.rules = rules;
		this.regexCache = new Map<string, RegExp>();
	}

	/**
	 * Update the rules array
	 */
	setRules(rules: ProcessingRule[]): void {
		this.rules = rules;
		// Clear cache when rules change
		this.regexCache.clear();
	}

	/**
	 * Get a compiled regex from cache or create and cache it
	 */
	private getCompiledRegex(pattern: string): RegExp {
		if (!this.regexCache.has(pattern)) {
			this.regexCache.set(pattern, new RegExp(pattern, 'gm'));
		}
		return this.regexCache.get(pattern)!;
	}

	/**
	 * Match OCR text against all rules and return matches
	 */
	async matchAndExecute(text: string): Promise<RuleMatch[]> {
		const matches: RuleMatch[] = [];

		// Filter enabled rules and sort by priority (higher priority first)
		const enabledRules = this.rules
			.filter(rule => rule.enabled)
			.sort((a, b) => b.priority - a.priority);

		// Test each rule against the text
		for (const rule of enabledRules) {
			try {
				const regex = this.getCompiledRegex(rule.pattern);
				// Reset regex state
				regex.lastIndex = 0;

				const match = regex.exec(text);

				if (match) {
					// Extract capture groups (excluding the full match at index 0)
					const captureGroups = match.slice(1);

					matches.push({
						rule: rule,
						captureGroups: captureGroups,
						matchedText: match[0]
					});
				}
			} catch (error) {
				console.error(`Error testing rule "${rule.name}":`, error);
			}
		}

		return matches;
	}

	/**
	 * Test a pattern against sample text
	 */
	testPattern(pattern: string, text: string): PatternTestResult {
		try {
			const regex = new RegExp(pattern, 'gm');
			const match = regex.exec(text);

			if (match) {
				// Extract capture groups (excluding the full match at index 0)
				const captureGroups = match.slice(1);

				return {
					matched: true,
					captureGroups: captureGroups
				};
			} else {
				return {
					matched: false,
					captureGroups: []
				};
			}
		} catch (error) {
			return {
				matched: false,
				captureGroups: [],
				error: error instanceof Error ? error.message : 'Invalid regex pattern'
			};
		}
	}

	/**
	 * Validate regex syntax
	 */
	validateRegex(pattern: string): ValidationResult {
		try {
			new RegExp(pattern);
			return {
				valid: true
			};
		} catch (error) {
			return {
				valid: false,
				error: error instanceof Error ? error.message : 'Invalid regex pattern'
			};
		}
	}

	/**
	 * Render a template string by replacing capture group placeholders
	 */
	static renderTemplate(template: string, captureGroups: string[]): string {
		let rendered = template;

		// Replace {{$1}}, {{$2}}, etc. with capture groups
		for (let i = 0; i < captureGroups.length; i++) {
			const placeholder = `{{$${i + 1}}}`;
			const value = captureGroups[i] || '';
			rendered = rendered.replace(new RegExp(placeholder.replace(/[{}$]/g, '\\$&'), 'g'), value);
		}

		// Handle any remaining unreplaced placeholders by replacing with empty string
		rendered = rendered.replace(/\{\{\$\d+\}\}/g, '');

		return rendered;
	}
}

/**
 * Action execution result interface
 */
interface ActionResult {
	success: boolean;
	action: RuleAction;
	error?: string;
	createdFile?: TFile;
}

/**
 * ActionExecutor class for executing rule actions
 */
class ActionExecutor {
	private vaultManager: VaultManager;

	/**
	 * Constructor accepting VaultManager instance
	 */
	constructor(vaultManager: VaultManager) {
		this.vaultManager = vaultManager;
	}

	/**
	 * Execute a create note action
	 */
	async executeCreateNote(
		config: CreateNoteConfig,
		captureGroups: string[]
	): Promise<ActionResult> {
		try {
			// Render title template with capture groups
			const title = RuleEngine.renderTemplate(config.titleTemplate, captureGroups);

			// Render frontmatter values with capture groups
			const renderedFrontmatter: Record<string, any> = {};
			for (const [key, value] of Object.entries(config.frontmatter)) {
				renderedFrontmatter[key] = RuleEngine.renderTemplate(value, captureGroups);
			}

			// Render body template with capture groups
			const body = RuleEngine.renderTemplate(config.bodyTemplate, captureGroups);

			// Call VaultManager.createNote() with rendered values
			const createdFile = await this.vaultManager.createNote(
				config.folderPath,
				title,
				renderedFrontmatter,
				body
			);

			return {
				success: true,
				action: { type: 'create-note', config },
				createdFile
			};
		} catch (error) {
			console.error('Error executing create note action:', error);
			return {
				success: false,
				action: { type: 'create-note', config },
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute an insert content action
	 */
	async executeInsertContent(
		config: InsertContentConfig,
		captureGroups: string[]
	): Promise<ActionResult> {
		try {
			// Resolve target note path (support patterns or direct paths)
			const targetPath = await this.resolveTargetNotePath(config.targetNote, captureGroups);

			if (!targetPath) {
				throw new Error(`Target note not found: ${config.targetNote}`);
			}

			// Render content template with capture groups
			const content = RuleEngine.renderTemplate(config.contentTemplate, captureGroups);

			// Call VaultManager.insertContent() with rendered content and insertion point
			await this.vaultManager.insertContent(targetPath, content, config.insertionPoint);

			return {
				success: true,
				action: { type: 'insert-content', config }
			};
		} catch (error) {
			console.error('Error executing insert content action:', error);
			return {
				success: false,
				action: { type: 'insert-content', config },
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute a modify frontmatter action
	 */
	async executeModifyFrontmatter(
		config: ModifyFrontmatterConfig,
		captureGroups: string[]
	): Promise<ActionResult> {
		try {
			// Resolve target note path
			const targetPath = await this.resolveTargetNotePath(config.targetNote, captureGroups);

			if (!targetPath) {
				throw new Error(`Target note not found: ${config.targetNote}`);
			}

			// Get the file
			const file = this.vaultManager['vault'].getAbstractFileByPath(targetPath);
			if (!(file instanceof TFile)) {
				throw new Error(`Target is not a file: ${targetPath}`);
			}

			// Render property values with capture groups
			const renderedProperties: Record<string, any> = {};
			for (const [key, value] of Object.entries(config.properties)) {
				renderedProperties[key] = RuleEngine.renderTemplate(value, captureGroups);
			}

			// Call VaultManager.modifyFrontmatter() with rendered properties
			await this.vaultManager.modifyFrontmatter(file, renderedProperties, config.appendToArrays);

			return {
				success: true,
				action: { type: 'modify-frontmatter', config }
			};
		} catch (error) {
			console.error('Error executing modify frontmatter action:', error);
			return {
				success: false,
				action: { type: 'modify-frontmatter', config },
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute all actions for a rule match
	 */
	async executeActions(ruleMatch: RuleMatch): Promise<ActionResult[]> {
		const results: ActionResult[] = [];

		// Execute each action in the rule
		for (const action of ruleMatch.rule.actions) {
			let result: ActionResult;

			try {
				switch (action.type) {
					case 'create-note':
						result = await this.executeCreateNote(
							action.config as CreateNoteConfig,
							ruleMatch.captureGroups
						);
						break;

					case 'insert-content':
						result = await this.executeInsertContent(
							action.config as InsertContentConfig,
							ruleMatch.captureGroups
						);
						break;

					case 'modify-frontmatter':
						result = await this.executeModifyFrontmatter(
							action.config as ModifyFrontmatterConfig,
							ruleMatch.captureGroups
						);
						break;

					default:
						result = {
							success: false,
							action,
							error: `Unknown action type: ${action.type}`
						};
				}

				results.push(result);

				// Log action result
				if (result.success) {
					console.log(`Successfully executed ${action.type} action for rule "${ruleMatch.rule.name}"`);
				} else {
					console.error(`Failed to execute ${action.type} action for rule "${ruleMatch.rule.name}":`, result.error);
				}
			} catch (error) {
				// Handle errors for individual actions without stopping execution
				const errorResult: ActionResult = {
					success: false,
					action,
					error: error instanceof Error ? error.message : 'Unknown error'
				};
				results.push(errorResult);
				console.error(`Error executing action for rule "${ruleMatch.rule.name}":`, error);
			}
		}

		return results;
	}

	/**
	 * Resolve target note path, supporting both direct paths and template patterns
	 */
	private async resolveTargetNotePath(
		targetNote: string,
		captureGroups: string[]
	): Promise<string | null> {
		// Render the target note path with capture groups
		const renderedPath = RuleEngine.renderTemplate(targetNote, captureGroups);

		// Check if the file exists
		const file = this.vaultManager['vault'].getAbstractFileByPath(renderedPath);
		if (file instanceof TFile) {
			return renderedPath;
		}

		// If not found, return null
		return null;
	}
}

/**
 * Modal for prompting user about default action
 */
class DefaultActionModal extends Modal {
	private text: string;
	private fileName: string;
	private onChoose: (action: string) => Promise<void>;

	constructor(app: App, text: string, fileName: string, onChoose: (action: string) => Promise<void>) {
		super(app);
		this.text = text;
		this.fileName = fileName;
		this.onChoose = onChoose;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: 'No matching rules found' });
		contentEl.createEl('p', { text: `What would you like to do with the text from ${this.fileName}?` });

		// Show preview of text
		const previewEl = contentEl.createEl('div', { cls: 'ocr-text-preview' });
		previewEl.style.maxHeight = '200px';
		previewEl.style.overflow = 'auto';
		previewEl.style.padding = '10px';
		previewEl.style.border = '1px solid var(--background-modifier-border)';
		previewEl.style.marginBottom = '20px';
		previewEl.style.whiteSpace = 'pre-wrap';
		previewEl.textContent = this.text.substring(0, 500) + (this.text.length > 500 ? '...' : '');

		// Add buttons
		const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.justifyContent = 'flex-end';

		const dailyNoteBtn = buttonContainer.createEl('button', { text: 'Insert into Daily Note' });
		dailyNoteBtn.addEventListener('click', async () => {
			await this.onChoose('daily-note');
			this.close();
		});

		const discardBtn = buttonContainer.createEl('button', { text: 'Discard' });
		discardBtn.addEventListener('click', async () => {
			await this.onChoose('discard');
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Default plugin settings
 */
const DEFAULT_SETTINGS: PluginSettings = {
	ocrBackend: 'tesseract',
	dailyNoteImportHeading: '## Imported Notes',
	processingRules: [],
	defaultAction: 'daily-note',
	noteSeparatorPattern: '^[-*]\\s',
	folderMonitoringEnabled: false,
	monitoredFolderPath: 'Inbox',
	monitoringInterval: 'daily',
	moveProcessedImages: true,
	processedImagesFolderPath: 'Processed',
	enableCameraCapture: true,
	saveCapturesToFolder: 'Captures'
};

/**
 * Main plugin class for Notebook OCR Plugin
 */
export default class NotebookOCRPlugin extends Plugin {
	settings: PluginSettings;
	ocrService: OCRService | null = null;
	vaultManager: VaultManager | null = null;
	ruleEngine: RuleEngine | null = null;

	/**
	 * Called when the plugin is loaded
	 */
	async onload() {
		console.log('Loading Notebook OCR Plugin');

		// Load settings
		await this.loadSettings();

		// Initialize OCR service
		try {
			this.ocrService = await createOCRService(this.settings);
			console.log('OCR service initialized successfully');
		} catch (error) {
			console.error('Failed to initialize OCR service:', error);
			new Notice('Failed to initialize OCR service. Please check console for details.');
		}

		// Initialize vault manager
		this.vaultManager = new VaultManager(this.app, this.app.vault);
		console.log('Vault manager initialized');

		// Initialize rule engine
		this.ruleEngine = new RuleEngine(this.settings.processingRules);
		console.log('Rule engine initialized');

		// Add settings tab
		this.addSettingTab(new NotebookOCRSettingTab(this.app, this));

		// Register commands
		this.registerCommands();

		// TODO: Initialize folder monitor
		// TODO: Add ribbon icon
	}

	/**
	 * Register plugin commands
	 */
	private registerCommands(): void {
		// Add command to import from notebook images
		this.addCommand({
			id: 'import-notebook-images',
			name: 'Import from notebook images',
			callback: () => this.openImagePicker()
		});
	}

	/**
	 * Open file picker for image selection
	 */
	private async openImagePicker(): Promise<void> {
		// Create a file input element
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/bmp,image/webp';
		input.multiple = true;

		// Handle file selection
		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const files = target.files;

			if (files && files.length > 0) {
				await this.processImages(Array.from(files));
			}
		};

		// Trigger the file picker
		input.click();
	}

	/**
	 * Process selected images through the OCR pipeline
	 */
	private async processImages(files: File[]): Promise<void> {
		if (!this.ocrService || !this.ocrService.isAvailable()) {
			new Notice('OCR service is not available. Please check plugin settings.');
			return;
		}

		if (!this.vaultManager || !this.ruleEngine) {
			new Notice('Plugin not fully initialized. Please reload Obsidian.');
			return;
		}

		// Show initial notice
		new Notice(`Processing ${files.length} image${files.length > 1 ? 's' : ''}...`);

		let successCount = 0;
		let errorCount = 0;
		const actionExecutor = new ActionExecutor(this.vaultManager);

		// Process each image
		for (const file of files) {
			try {
				// Read image file as ArrayBuffer
				const imageData = await file.arrayBuffer();

				// Pass image data to OCR service
				const ocrResult = await this.ocrService.processImage(imageData);

				// Handle OCR errors
				if (ocrResult.error) {
					new Notice(`OCR failed for ${file.name}: ${ocrResult.error}`);
					errorCount++;
					continue;
				}

				if (!ocrResult.text || ocrResult.text.trim().length === 0) {
					new Notice(`No text found in ${file.name}`);
					errorCount++;
					continue;
				}

				// Pass OCR text to rule engine for matching
				const matches = await this.ruleEngine.matchAndExecute(ocrResult.text);

				if (matches.length > 0) {
					// Execute matched rule actions via ActionExecutor
					for (const match of matches) {
						const results = await actionExecutor.executeActions(match);

						// Check if all actions succeeded
						const allSucceeded = results.every(r => r.success);
						if (allSucceeded) {
							successCount++;
						} else {
							errorCount++;
							const failedActions = results.filter(r => !r.success);
							new Notice(`Some actions failed for ${file.name}: ${failedActions.map(r => r.error).join(', ')}`);
						}
					}
				} else {
					// Apply default action if no rules match
					await this.applyDefaultAction(ocrResult.text, file.name);
					successCount++;
				}

			} catch (error) {
				console.error(`Error processing image ${file.name}:`, error);
				new Notice(`Error processing ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				errorCount++;
			}
		}

		// Display success notification with summary
		if (successCount > 0 || errorCount > 0) {
			const summary = [];
			if (successCount > 0) {
				summary.push(`${successCount} processed successfully`);
			}
			if (errorCount > 0) {
				summary.push(`${errorCount} failed`);
			}
			new Notice(`Image processing complete: ${summary.join(', ')}`);
		}
	}

	/**
	 * Apply default action when no processing rules match
	 */
	private async applyDefaultAction(text: string, fileName: string): Promise<void> {
		if (!this.vaultManager) {
			throw new Error('Vault manager not initialized');
		}

		// Check settings for default action type
		switch (this.settings.defaultAction) {
			case 'daily-note':
				// Insert into daily note with separator formatting
				await this.insertIntoDailyNoteWithSeparators(text);
				break;

			case 'discard':
				// Skip processing
				console.log(`Discarding OCR text from ${fileName} (no rules matched)`);
				break;

			case 'prompt':
				// Show modal asking user what to do
				await this.promptUserForAction(text, fileName);
				break;

			default:
				console.warn(`Unknown default action: ${this.settings.defaultAction}`);
				break;
		}
	}

	/**
	 * Insert text into daily note with separator formatting
	 */
	private async insertIntoDailyNoteWithSeparators(text: string): Promise<void> {
		if (!this.vaultManager) {
			throw new Error('Vault manager not initialized');
		}

		// Check if note separator pattern is configured
		if (this.settings.noteSeparatorPattern) {
			try {
				const separatorRegex = new RegExp(this.settings.noteSeparatorPattern, 'gm');
				const lines = text.split('\n');
				const formattedLines: string[] = [];

				// Format each line that matches the separator pattern as a bullet
				for (const line of lines) {
					if (separatorRegex.test(line)) {
						// Remove the separator prefix and format as bullet
						const cleanedLine = line.replace(separatorRegex, '').trim();
						if (cleanedLine) {
							formattedLines.push(`- ${cleanedLine}`);
						}
					} else if (line.trim()) {
						// Keep non-empty lines that don't match the pattern
						formattedLines.push(line);
					}
				}

				const formattedText = formattedLines.length > 0 ? formattedLines.join('\n') : text;
				await this.vaultManager.insertIntoDailyNote(formattedText, this.settings.dailyNoteImportHeading);
			} catch (error) {
				console.error('Error applying separator pattern:', error);
				// Fall back to inserting raw text
				await this.vaultManager.insertIntoDailyNote(text, this.settings.dailyNoteImportHeading);
			}
		} else {
			// No separator pattern, insert as-is
			await this.vaultManager.insertIntoDailyNote(text, this.settings.dailyNoteImportHeading);
		}
	}

	/**
	 * Prompt user for action when default action is 'prompt'
	 */
	private async promptUserForAction(text: string, fileName: string): Promise<void> {
		// Create a simple modal to ask the user what to do
		const modal = new DefaultActionModal(this.app, text, fileName, async (action: string) => {
			if (action === 'daily-note' && this.vaultManager) {
				await this.insertIntoDailyNoteWithSeparators(text);
				new Notice('Text inserted into daily note');
			} else if (action === 'discard') {
				new Notice('Text discarded');
			}
		});

		modal.open();
	}

	/**
	 * Called when the plugin is unloaded
	 */
	async onunload() {
		console.log('Unloading Notebook OCR Plugin');

		// Cleanup OCR service
		if (this.ocrService && this.ocrService instanceof TesseractOCRService) {
			await (this.ocrService as TesseractOCRService).terminate();
		}

		// TODO: Stop folder monitor
	}

	/**
	 * Load plugin settings from disk
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save plugin settings to disk
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/**
 * Settings tab for the plugin
 */
class NotebookOCRSettingTab extends PluginSettingTab {
	plugin: NotebookOCRPlugin;

	constructor(app: App, plugin: NotebookOCRPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Notebook OCR Plugin Settings' });

		// OCR Backend Setting
		new Setting(containerEl)
			.setName('OCR Backend')
			.setDesc('Choose between local (Tesseract.js) or cloud-based OCR')
			.addDropdown(dropdown => dropdown
				.addOption('tesseract', 'Local (Tesseract.js)')
				.addOption('cloud', 'Cloud API')
				.setValue(this.plugin.settings.ocrBackend)
				.onChange(async (value) => {
					this.plugin.settings.ocrBackend = value as 'tesseract' | 'cloud';
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide cloud settings
				}));

		// Cloud API settings (shown only when cloud backend is selected)
		if (this.plugin.settings.ocrBackend === 'cloud') {
			new Setting(containerEl)
				.setName('Cloud API Provider')
				.setDesc('Select your cloud OCR provider')
				.addDropdown(dropdown => dropdown
					.addOption('openai', 'OpenAI Vision')
					.addOption('google', 'Google Cloud Vision')
					.setValue(this.plugin.settings.cloudApiProvider || 'openai')
					.onChange(async (value) => {
						this.plugin.settings.cloudApiProvider = value as 'openai' | 'google';
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Cloud API Key')
				.setDesc('Enter your API key for the selected provider')
				.addText(text => text
					.setPlaceholder('Enter API key')
					.setValue(this.plugin.settings.cloudApiKey || '')
					.onChange(async (value) => {
						this.plugin.settings.cloudApiKey = value;
						await this.plugin.saveSettings();
					}));
		}

		// Daily Note Settings
		containerEl.createEl('h3', { text: 'Daily Note Settings' });

		new Setting(containerEl)
			.setName('Import Heading')
			.setDesc('Heading under which imported notes will be placed in daily notes')
			.addText(text => text
				.setPlaceholder('## Imported Notes')
				.setValue(this.plugin.settings.dailyNoteImportHeading)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteImportHeading = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Action')
			.setDesc('What to do with OCR text when no processing rules match')
			.addDropdown(dropdown => dropdown
				.addOption('daily-note', 'Insert into Daily Note')
				.addOption('discard', 'Discard')
				.addOption('prompt', 'Prompt User')
				.setValue(this.plugin.settings.defaultAction)
				.onChange(async (value) => {
					this.plugin.settings.defaultAction = value as 'daily-note' | 'discard' | 'prompt';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Note Separator Pattern')
			.setDesc('Regex pattern to detect separate notes (e.g., lines starting with - or *)')
			.addText(text => text
				.setPlaceholder('^[-*]\\s')
				.setValue(this.plugin.settings.noteSeparatorPattern)
				.onChange(async (value) => {
					this.plugin.settings.noteSeparatorPattern = value;
					await this.plugin.saveSettings();
				}));

		// Folder Monitoring Settings
		containerEl.createEl('h3', { text: 'Folder Monitoring' });

		new Setting(containerEl)
			.setName('Enable Folder Monitoring')
			.setDesc('Automatically process new images in a monitored folder')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.folderMonitoringEnabled)
				.onChange(async (value) => {
					this.plugin.settings.folderMonitoringEnabled = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide monitoring settings
				}));

		if (this.plugin.settings.folderMonitoringEnabled) {
			new Setting(containerEl)
				.setName('Monitored Folder')
				.setDesc('Path to the folder to monitor for new images')
				.addText(text => text
					.setPlaceholder('Inbox')
					.setValue(this.plugin.settings.monitoredFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.monitoredFolderPath = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Monitoring Interval')
				.setDesc('How often to check for new images')
				.addDropdown(dropdown => dropdown
					.addOption('hourly', 'Hourly')
					.addOption('daily', 'Daily')
					.setValue(this.plugin.settings.monitoringInterval)
					.onChange(async (value) => {
						this.plugin.settings.monitoringInterval = value as 'hourly' | 'daily';
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Move Processed Images')
				.setDesc('Move images to a separate folder after processing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.moveProcessedImages)
					.onChange(async (value) => {
						this.plugin.settings.moveProcessedImages = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide processed folder setting
					}));

			if (this.plugin.settings.moveProcessedImages) {
				new Setting(containerEl)
					.setName('Processed Images Folder')
					.setDesc('Path to folder for processed images')
					.addText(text => text
						.setPlaceholder('Processed')
						.setValue(this.plugin.settings.processedImagesFolderPath)
						.onChange(async (value) => {
							this.plugin.settings.processedImagesFolderPath = value;
							await this.plugin.saveSettings();
						}));
			}
		}

		// Mobile Settings
		containerEl.createEl('h3', { text: 'Mobile Settings' });

		new Setting(containerEl)
			.setName('Enable Camera Capture')
			.setDesc('Enable camera capture command on mobile devices')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCameraCapture)
				.onChange(async (value) => {
					this.plugin.settings.enableCameraCapture = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Save Captures To')
			.setDesc('Folder path for saving camera captures')
			.addText(text => text
				.setPlaceholder('Captures')
				.setValue(this.plugin.settings.saveCapturesToFolder)
				.onChange(async (value) => {
					this.plugin.settings.saveCapturesToFolder = value;
					await this.plugin.saveSettings();
				}));

		// Processing Rules section placeholder
		containerEl.createEl('h3', { text: 'Processing Rules' });
		containerEl.createEl('p', {
			text: 'Processing rules configuration will be implemented in a future task.',
			cls: 'setting-item-description'
		});
	}
}
