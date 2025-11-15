import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, TFolder, Vault, normalizePath, Modal, Platform } from 'obsidian';
import { createWorker, Worker } from 'tesseract.js';

/**
 * Platform detection helper class
 */
class PlatformHelper {
	/**
	 * Check if running on a mobile device
	 */
	static isMobile(): boolean {
		return Platform.isMobile;
	}

	/**
	 * Check if camera access is available (mobile only)
	 */
	static hasCameraAccess(): boolean {
		return Platform.isMobileApp && (Platform.isIosApp || Platform.isAndroidApp);
	}
}

/**
 * ErrorHandler class for handling different types of errors with user-friendly messages
 */
class ErrorHandler {
	/**
	 * Handle OCR-related errors and show user-friendly messages
	 */
	static handleOCRError(error: Error, imagePath: string): void {
		console.error(`OCR error for ${imagePath}:`, error);

		let userMessage = `Failed to process image "${imagePath}"`;

		// Provide specific error messages based on error type
		if (error.message.includes('not initialized')) {
			userMessage += ': OCR service not initialized. Please check plugin settings.';
		} else if (error.message.includes('Failed to initialize')) {
			userMessage += ': Could not initialize OCR engine. Please reload the plugin.';
		} else if (error.message.includes('No text found')) {
			userMessage += ': No text detected in image. The image may be blank or too low quality.';
		} else if (error.message.includes('timeout')) {
			userMessage += ': OCR processing timed out. Try with a smaller or clearer image.';
		} else if (error.message.includes('memory')) {
			userMessage += ': Insufficient memory to process image. Try with a smaller image.';
		} else {
			userMessage += `: ${error.message}`;
		}

		new Notice(userMessage, 8000);
	}

	/**
	 * Handle rule execution errors and log them appropriately
	 */
	static handleRuleError(error: Error, rule: ProcessingRule, action?: RuleAction): void {
		const actionType = action ? ` (${action.type})` : '';
		console.error(`Rule execution error for "${rule.name}"${actionType}:`, error);

		let userMessage = `Rule "${rule.name}" failed${actionType}`;

		// Provide specific error messages based on error type
		if (error.message.includes('Target note not found')) {
			userMessage += ': Target note does not exist. Check the note path in your rule configuration.';
		} else if (error.message.includes('Invalid regex')) {
			userMessage += ': Invalid regex pattern. Please check your pattern syntax.';
		} else if (error.message.includes('Folder not found')) {
			userMessage += ': Target folder does not exist. It will be created automatically.';
		} else if (error.message.includes('frontmatter')) {
			userMessage += ': Failed to modify frontmatter. Check the note format.';
		} else if (error.message.includes('permission')) {
			userMessage += ': Permission denied. Check file permissions.';
		} else {
			userMessage += `: ${error.message}`;
		}

		new Notice(userMessage, 6000);
	}

	/**
	 * Handle file system operation errors
	 */
	static handleFileSystemError(error: Error, operation: string, filePath?: string): void {
		const fileInfo = filePath ? ` for "${filePath}"` : '';
		console.error(`File system error during ${operation}${fileInfo}:`, error);

		let userMessage = `Failed to ${operation}${fileInfo}`;

		// Provide specific error messages based on error type
		if (error.message.includes('ENOENT') || error.message.includes('not found')) {
			userMessage += ': File or folder not found.';
		} else if (error.message.includes('EACCES') || error.message.includes('permission')) {
			userMessage += ': Permission denied. Check file permissions.';
		} else if (error.message.includes('EEXIST') || error.message.includes('already exists')) {
			userMessage += ': File already exists.';
		} else if (error.message.includes('ENOSPC') || error.message.includes('space')) {
			userMessage += ': Insufficient disk space.';
		} else if (error.message.includes('EROFS') || error.message.includes('read-only')) {
			userMessage += ': File system is read-only.';
		} else {
			userMessage += `: ${error.message}`;
		}

		new Notice(userMessage, 6000);
	}

	/**
	 * Handle validation errors with helpful suggestions
	 */
	static handleValidationError(message: string, suggestion?: string): void {
		console.warn('Validation error:', message);

		let userMessage = message;
		if (suggestion) {
			userMessage += ` ${suggestion}`;
		}

		new Notice(userMessage, 5000);
	}

	/**
	 * Show a warning message to the user
	 */
	static showWarning(message: string, duration: number = 5000): void {
		console.warn(message);
		new Notice(message, duration);
	}
}

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
			this.worker = await createWorker({
				langPath: 'https://tessdata.projectnaptha.com/4.0.0',
			});
			await this.worker.loadLanguage('eng');
			await this.worker.initialize('eng');
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
			// Convert ArrayBuffer to Blob for Tesseract
			const blob = new Blob([imageData], { type: 'image/jpeg' });

			// Perform OCR
			const result = await this.worker.recognize(blob);

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
		// Validate title
		if (!title || title.trim().length === 0) {
			throw new Error('Note title cannot be empty');
		}

		// Normalize folder path
		const normalizedFolder = normalizePath(folderPath);

		// Check if folder exists, warn and create if needed
		const folderExists = this.vault.getAbstractFileByPath(normalizedFolder);
		if (!folderExists && normalizedFolder) {
			console.log(`Creating folder: ${normalizedFolder}`);
			ErrorHandler.showWarning(`Folder "${normalizedFolder}" does not exist. Creating it now.`, 4000);
		}

		// Ensure folder exists
		await this.ensureFolderExists(normalizedFolder);

		// Generate file path
		let fileName = `${title}.md`;
		let filePath = normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;

		// Handle duplicate filenames
		const originalPath = filePath;
		filePath = await this.getUniqueFilePath(filePath);
		if (filePath !== originalPath) {
			console.log(`File already exists, using unique name: ${filePath}`);
		}

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
		// Validate target path
		if (!targetPath || targetPath.trim().length === 0) {
			throw new Error('Target note path cannot be empty');
		}

		const file = this.vault.getAbstractFileByPath(targetPath);
		if (!(file instanceof TFile)) {
			ErrorHandler.showWarning(`Target note "${targetPath}" does not exist. Content insertion skipped.`);
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
						// Pattern not found, append to end with warning
						console.warn(`Pattern "${insertionPoint.pattern}" not found in ${targetPath}, appending to end`);
						ErrorHandler.showWarning(`Pattern not found in note. Content appended to end instead.`, 4000);
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
						// Pattern not found, append to end with warning
						console.warn(`Pattern "${insertionPoint.pattern}" not found in ${targetPath}, appending to end`);
						ErrorHandler.showWarning(`Pattern not found in note. Content appended to end instead.`, 4000);
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
						// Heading not found, create it and add content with warning
						console.warn(`Heading "${insertionPoint.heading}" not found in ${targetPath}, creating it`);
						ErrorHandler.showWarning(`Heading not found in note. Creating it now.`, 4000);
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

	/**
	 * Validate template syntax
	 */
	static validateTemplate(template: string): { valid: boolean; error?: string; warnings?: string[] } {
		if (!template || template.trim().length === 0) {
			return { valid: true };
		}

		const warnings: string[] = [];

		// Check for malformed placeholders
		const malformedPattern = /\{\{(?!\d+\}\})[^}]*\}\}/g;
		const malformed = template.match(malformedPattern);
		if (malformed) {
			return {
				valid: false,
				error: `Malformed placeholder(s) found: ${malformed.join(', ')}. Use {{1}}, {{2}}, etc.`
			};
		}

		// Check for unclosed placeholders
		const unclosedOpen = (template.match(/\{\{/g) || []).length;
		const unclosedClose = (template.match(/\}\}/g) || []).length;
		if (unclosedOpen !== unclosedClose) {
			return {
				valid: false,
				error: 'Unclosed placeholder braces found. Make sure all {{ have matching }}'
			};
		}

		// Extract all placeholder numbers
		const placeholderPattern = /\{\{(\d+)\}\}/g;
		const matches = [...template.matchAll(placeholderPattern)];
		const placeholderNumbers = matches.map(m => parseInt(m[1]));

		// Warn about high placeholder numbers (might indicate typo)
		const maxPlaceholder = Math.max(...placeholderNumbers, 0);
		if (maxPlaceholder > 10) {
			warnings.push(`High placeholder number detected ({{${maxPlaceholder}}}). Make sure this is intentional.`);
		}

		// Warn about gaps in placeholder sequence
		if (placeholderNumbers.length > 0) {
			const uniqueNumbers = [...new Set(placeholderNumbers)].sort((a, b) => a - b);
			for (let i = 1; i < uniqueNumbers[uniqueNumbers.length - 1]; i++) {
				if (!uniqueNumbers.includes(i)) {
					warnings.push(`Placeholder {{${i}}} is missing but higher numbers are used.`);
				}
			}
		}

		return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
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
 * FolderMonitor class for monitoring a folder and automatically processing new images
 */
class FolderMonitor {
	private plugin: NotebookOCRPlugin;
	private intervalId: number | null = null;
	private processedFiles: Set<string>;

	/**
	 * Constructor with plugin reference
	 */
	constructor(plugin: NotebookOCRPlugin) {
		this.plugin = plugin;
		this.processedFiles = new Set<string>();
	}

	/**
	 * Get the set of processed files (for persistence)
	 */
	getProcessedFiles(): string[] {
		return Array.from(this.processedFiles);
	}

	/**
	 * Set the processed files (for loading from persistence)
	 */
	setProcessedFiles(files: string[]): void {
		this.processedFiles = new Set(files);
	}

	/**
	 * Start monitoring the configured folder with the specified interval
	 */
	start(folderPath: string, interval: 'hourly' | 'daily'): void {
		// Stop any existing monitoring
		this.stop();

		// Convert interval to milliseconds
		const intervalMs = interval === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

		// Start monitoring
		console.log(`Starting folder monitoring for ${folderPath} with ${interval} interval`);

		// Check immediately on start
		this.checkForNewImages(folderPath);

		// Set up interval for periodic checks
		this.intervalId = window.setInterval(() => {
			this.checkForNewImages(folderPath);
		}, intervalMs);
	}

	/**
	 * Stop monitoring and cleanup
	 */
	stop(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
			console.log('Folder monitoring stopped');
		}
	}

	/**
	 * Check the monitored folder for new images and process them
	 */
	async checkForNewImages(folderPath: string): Promise<void> {
		try {
			console.log(`Checking for new images in ${folderPath}`);

			// Get the folder
			const folder = this.plugin.app.vault.getAbstractFileByPath(normalizePath(folderPath));

			if (!(folder instanceof TFolder)) {
				console.warn(`Monitored folder not found: ${folderPath}`);
				ErrorHandler.showWarning(`Monitored folder "${folderPath}" not found. Please check your settings.`);
				return;
			}

			// Get all files in the folder
			const files = folder.children.filter(file => file instanceof TFile) as TFile[];

			// Filter for image files that haven't been processed
			const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
			const newImages = files.filter(file => {
				const extension = file.extension.toLowerCase();
				return imageExtensions.includes(extension) && !this.processedFiles.has(file.path);
			});

			if (newImages.length === 0) {
				console.log('No new images found');
				return;
			}

			console.log(`Found ${newImages.length} new image(s) to process`);

			// Show initial progress notification
			new Notice(`Found ${newImages.length} new image${newImages.length > 1 ? 's' : ''} in ${folderPath}. Processing...`);

			let successCount = 0;
			let errorCount = 0;

			// Process each new image through the image processing pipeline
			for (const imageFile of newImages) {
				try {
					await this.processImageFile(imageFile);
					// Mark as processed after successful processing
					await this.markAsProcessed(imageFile);
					successCount++;
				} catch (error) {
					console.error(`Error processing ${imageFile.path}:`, error);
					ErrorHandler.handleOCRError(
						error instanceof Error ? error : new Error('Unknown error'),
						imageFile.name
					);
					errorCount++;
				}
			}

			// Show summary notification
			if (successCount > 0 || errorCount > 0) {
				const summaryParts = [];
				if (successCount > 0) {
					summaryParts.push(`✓ ${successCount} processed`);
				}
				if (errorCount > 0) {
					summaryParts.push(`✗ ${errorCount} failed`);
				}
				new Notice(`Folder monitoring complete: ${summaryParts.join(', ')}`, 8000);
			}

		} catch (error) {
			console.error('Error checking for new images:', error);
			ErrorHandler.handleFileSystemError(
				error instanceof Error ? error : new Error('Unknown error'),
				'check monitored folder',
				folderPath
			);
		}
	}

	/**
	 * Process a single image file through the OCR pipeline
	 */
	private async processImageFile(imageFile: TFile): Promise<void> {
		if (!this.plugin.ocrService || !this.plugin.ocrService.isAvailable()) {
			throw new Error('OCR service is not available');
		}

		if (!this.plugin.vaultManager || !this.plugin.ruleEngine) {
			throw new Error('Plugin not fully initialized');
		}

		// Read image file as ArrayBuffer
		const imageData = await this.plugin.app.vault.readBinary(imageFile);

		// Pass image data to OCR service
		const ocrResult = await this.plugin.ocrService.processImage(imageData);

		// Handle OCR errors
		if (ocrResult.error) {
			throw new Error(`OCR failed: ${ocrResult.error}`);
		}

		if (!ocrResult.text || ocrResult.text.trim().length === 0) {
			throw new Error('No text found in image');
		}

		// Pass OCR text to rule engine for matching
		const matches = await this.plugin.ruleEngine.matchAndExecute(ocrResult.text);

		const actionExecutor = new ActionExecutor(this.plugin.vaultManager);

		if (matches.length > 0) {
			// Execute matched rule actions via ActionExecutor
			for (const match of matches) {
				const results = await actionExecutor.executeActions(match);

				// Check if all actions succeeded
				const allSucceeded = results.every(r => r.success);
				if (!allSucceeded) {
					const failedActions = results.filter(r => !r.success);
					// Use ErrorHandler for better error messages
					failedActions.forEach(result => {
						ErrorHandler.handleRuleError(
							new Error(result.error || 'Unknown error'),
							match.rule,
							result.action
						);
					});
					throw new Error(`Some actions failed: ${failedActions.map(r => r.error).join(', ')}`);
				}
			}
		} else {
			// Apply default action if no rules match
			await this.plugin['applyDefaultAction'](ocrResult.text, imageFile.name);
		}
	}

	/**
	 * Mark a file as processed and optionally move it to the processed folder
	 */
	async markAsProcessed(imageFile: TFile): Promise<void> {
		// Add file to processed set
		this.processedFiles.add(imageFile.path);

		// Persist processed file list to plugin data
		await this.saveProcessedFiles();

		// If moveProcessedImages is enabled, move file to processed folder
		if (this.plugin.settings.moveProcessedImages) {
			try {
				const processedFolderPath = normalizePath(this.plugin.settings.processedImagesFolderPath);

				// Ensure processed folder exists
				const processedFolder = this.plugin.app.vault.getAbstractFileByPath(processedFolderPath);
				if (!processedFolder) {
					await this.plugin.app.vault.createFolder(processedFolderPath);
				}

				// Generate new path for the file
				const newPath = normalizePath(`${processedFolderPath}/${imageFile.name}`);

				// Check if file already exists at destination
				let finalPath = newPath;
				let counter = 1;
				while (this.plugin.app.vault.getAbstractFileByPath(finalPath)) {
					const nameParts = imageFile.name.split('.');
					const extension = nameParts.pop();
					const baseName = nameParts.join('.');
					finalPath = normalizePath(`${processedFolderPath}/${baseName} ${counter}.${extension}`);
					counter++;
				}

				// Move the file
				await this.plugin.app.vault.rename(imageFile, finalPath);

				// Update the processed files set with the new path
				this.processedFiles.delete(imageFile.path);
				this.processedFiles.add(finalPath);
				await this.saveProcessedFiles();

				console.log(`Moved processed image to ${finalPath}`);
			} catch (error) {
				console.error('Error moving processed image:', error);
				// Don't throw - we still want to mark it as processed even if move fails
			}
		}
	}

	/**
	 * Save the processed files list to plugin data
	 */
	private async saveProcessedFiles(): Promise<void> {
		const data = await this.plugin.loadData() || {};
		data.processedFiles = Array.from(this.processedFiles);
		await this.plugin.saveData(data);
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
	folderMonitor: FolderMonitor | null = null;

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

		// Initialize folder monitor
		this.folderMonitor = new FolderMonitor(this);

		// Load processed files from plugin data
		const data = await this.loadData();
		if (data && data.processedFiles) {
			this.folderMonitor.setProcessedFiles(data.processedFiles);
		}

		// Start folder monitor if enabled in settings
		if (this.settings.folderMonitoringEnabled) {
			this.folderMonitor.start(
				this.settings.monitoredFolderPath,
				this.settings.monitoringInterval
			);
		}

		// Add settings tab
		this.addSettingTab(new NotebookOCRSettingTab(this.app, this));

		// Register commands
		this.registerCommands();

		// Add ribbon icon for quick access to import command
		this.addRibbonIcon('camera', 'Import from notebook images', () => {
			this.openImagePicker();
		});
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

		// Add camera capture command (mobile only)
		if (PlatformHelper.hasCameraAccess() && this.settings.enableCameraCapture) {
			this.addCommand({
				id: 'capture-and-import',
				name: 'Capture and import',
				callback: () => this.openCameraCapture()
			});
		}

		// Add test processing rules command
		this.addCommand({
			id: 'test-processing-rules',
			name: 'Test processing rules',
			callback: () => this.openRuleTester()
		});

		// Add process folder now command
		this.addCommand({
			id: 'process-folder-now',
			name: 'Process folder now',
			callback: () => this.processFolderNow()
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
	 * Open camera capture for mobile devices
	 */
	private async openCameraCapture(): Promise<void> {
		// Check for camera access availability
		if (!PlatformHelper.hasCameraAccess()) {
			new Notice('Camera capture is only available on mobile devices. Please use the image picker instead.');
			return;
		}

		if (!this.settings.enableCameraCapture) {
			new Notice('Camera capture is disabled in settings.');
			return;
		}

		// Create a file input element with camera capture
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.capture = 'environment'; // Use rear camera by default
		input.multiple = false; // Single capture at a time

		// Handle file selection
		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const files = target.files;

			if (files && files.length > 0) {
				const file = files[0];

				try {
					// Save captured image to configured folder
					const savedFile = await this.saveCapturedImage(file);

					// Process captured image immediately
					await this.processImages([file]);

					new Notice(`Image captured and processed successfully`);
				} catch (error) {
					console.error('Error processing captured image:', error);
					new Notice(`Failed to process captured image: ${error instanceof Error ? error.message : 'Unknown error'}`);
				}
			}
		};

		// Trigger the camera
		input.click();
	}

	/**
	 * Save a captured image to the vault
	 */
	private async saveCapturedImage(file: File): Promise<TFile> {
		// Normalize folder path
		const folderPath = normalizePath(this.settings.saveCapturesToFolder);

		// Ensure folder exists
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}

		// Generate filename with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
		const extension = file.name.split('.').pop() || 'jpg';
		let fileName = `capture_${timestamp}.${extension}`;
		let filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

		// Handle duplicate filenames
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(filePath)) {
			fileName = `capture_${timestamp}_${counter}.${extension}`;
			filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
			counter++;
		}

		// Read file as ArrayBuffer
		const arrayBuffer = await file.arrayBuffer();

		// Create file in vault
		const createdFile = await this.app.vault.createBinary(filePath, arrayBuffer);

		console.log(`Saved captured image to ${filePath}`);
		return createdFile;
	}

	/**
	 * Process selected images through the OCR pipeline
	 */
	private async processImages(files: File[]): Promise<void> {
		if (!this.ocrService || !this.ocrService.isAvailable()) {
			ErrorHandler.handleValidationError(
				'OCR service is not available.',
				'Please check plugin settings and ensure the OCR engine is properly initialized.'
			);
			return;
		}

		if (!this.vaultManager || !this.ruleEngine) {
			ErrorHandler.handleValidationError(
				'Plugin not fully initialized.',
				'Please reload Obsidian and try again.'
			);
			return;
		}

		// Show initial notice with progress
		const totalFiles = files.length;
		new Notice(`Starting OCR processing for ${totalFiles} image${totalFiles > 1 ? 's' : ''}...`);

		let successCount = 0;
		let errorCount = 0;
		const actionExecutor = new ActionExecutor(this.vaultManager);
		const actionsSummary: string[] = [];

		// Process each image
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const fileNumber = i + 1;

			try {
				// Show progress for multiple images
				if (totalFiles > 1) {
					new Notice(`Processing image ${fileNumber}/${totalFiles}: ${file.name}...`);
				}

				// Read image file as ArrayBuffer
				const imageData = await file.arrayBuffer();

				// Pass image data to OCR service
				const ocrResult = await this.ocrService.processImage(imageData);

				// Handle OCR errors
				if (ocrResult.error) {
					ErrorHandler.handleOCRError(new Error(ocrResult.error), file.name);
					errorCount++;
					continue;
				}

				if (!ocrResult.text || ocrResult.text.trim().length === 0) {
					ErrorHandler.handleOCRError(new Error('No text found in image'), file.name);
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
							// Track what actions were taken
							const actionTypes = results.map(r => {
								if (r.action.type === 'create-note' && r.createdFile) {
									return `created note "${r.createdFile.basename}"`;
								}
								return r.action.type.replace('-', ' ');
							});
							actionsSummary.push(`${file.name}: ${actionTypes.join(', ')}`);
						} else {
							errorCount++;
							const failedActions = results.filter(r => !r.success);
							failedActions.forEach(result => {
								ErrorHandler.handleRuleError(
									new Error(result.error || 'Unknown error'),
									match.rule,
									result.action
								);
							});
						}
					}
				} else {
					// Apply default action if no rules match
					await this.applyDefaultAction(ocrResult.text, file.name);
					successCount++;
					actionsSummary.push(`${file.name}: applied default action`);
				}

			} catch (error) {
				console.error(`Error processing image ${file.name}:`, error);
				ErrorHandler.handleOCRError(
					error instanceof Error ? error : new Error('Unknown error'),
					file.name
				);
				errorCount++;
			}
		}

		// Display success notification with summary of actions taken
		if (successCount > 0 || errorCount > 0) {
			const summaryParts = [];
			if (successCount > 0) {
				summaryParts.push(`✓ ${successCount} processed successfully`);
			}
			if (errorCount > 0) {
				summaryParts.push(`✗ ${errorCount} failed`);
			}

			let summaryMessage = `Image processing complete: ${summaryParts.join(', ')}`;

			// Add details about actions taken (limit to first 3 for brevity)
			if (actionsSummary.length > 0 && actionsSummary.length <= 3) {
				summaryMessage += '\n\nActions taken:\n' + actionsSummary.map(s => `• ${s}`).join('\n');
			} else if (actionsSummary.length > 3) {
				summaryMessage += `\n\n${actionsSummary.length} actions completed. Check console for details.`;
				console.log('Actions summary:', actionsSummary);
			}

			new Notice(summaryMessage, 10000);
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
	 * Open the rule tester modal
	 */
	private openRuleTester(): void {
		const modal = new RuleTesterModal(this.app, this);
		modal.open();
	}

	/**
	 * Manually trigger folder monitoring to process folder immediately
	 */
	private async processFolderNow(): Promise<void> {
		if (!this.folderMonitor) {
			new Notice('Folder monitor not initialized');
			return;
		}

		if (!this.settings.folderMonitoringEnabled) {
			new Notice('Folder monitoring is disabled. Enable it in settings first.');
			return;
		}

		new Notice(`Checking ${this.settings.monitoredFolderPath} for new images...`);
		await this.folderMonitor.checkForNewImages(this.settings.monitoredFolderPath);
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

		// Stop folder monitor
		if (this.folderMonitor) {
			this.folderMonitor.stop();
		}
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
 * Modal for testing processing rules against sample text
 */
class RuleTesterModal extends Modal {
	private plugin: NotebookOCRPlugin;

	constructor(app: App, plugin: NotebookOCRPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.createEl('h2', { text: 'Test Processing Rules' });

		contentEl.createEl('p', {
			text: 'Test your processing rules against sample OCR text to see which rules match and what actions would be executed.',
			cls: 'setting-item-description'
		});

		// Sample text input
		const sampleTextSetting = new Setting(contentEl)
			.setName('Sample OCR Text')
			.setDesc('Enter sample text to test against your rules');

		const sampleTextarea = sampleTextSetting.controlEl.createEl('textarea', {
			placeholder: 'Enter sample OCR text here...\n\nFor example:\nProject: My New Project\nDue: 2024-12-31\nStatus: Active'
		});
		sampleTextarea.style.width = '100%';
		sampleTextarea.style.minHeight = '150px';
		sampleTextarea.style.fontFamily = 'monospace';
		sampleTextarea.style.fontSize = '0.9em';

		// Test button
		new Setting(contentEl)
			.setName('Test Rules')
			.setDesc('Test all enabled rules against the sample text')
			.addButton(button => button
				.setButtonText('Test')
				.setCta()
				.onClick(async () => {
					await this.testRules(contentEl, sampleTextarea.value);
				}));

		// Results container
		const resultsContainer = contentEl.createDiv({ cls: 'notebook-ocr-test-results' });
		resultsContainer.style.marginTop = '20px';

		// Close button
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.marginTop = '20px';

		const closeButton = buttonContainer.createEl('button', { text: 'Close' });
		closeButton.addEventListener('click', () => {
			this.close();
		});
	}

	/**
	 * Test all rules against the sample text and display results
	 */
	private async testRules(containerEl: HTMLElement, sampleText: string): Promise<void> {
		const resultsContainer = containerEl.querySelector('.notebook-ocr-test-results') as HTMLElement;
		if (!resultsContainer) return;

		resultsContainer.empty();

		if (!sampleText.trim()) {
			resultsContainer.createEl('p', {
				text: 'Please enter sample text to test.',
				cls: 'setting-item-description'
			});
			return;
		}

		if (!this.plugin.ruleEngine) {
			resultsContainer.createEl('p', {
				text: 'Rule engine not available.',
				cls: 'setting-item-description'
			});
			return;
		}

		// Get enabled rules
		const enabledRules = this.plugin.settings.processingRules.filter(rule => rule.enabled);

		if (enabledRules.length === 0) {
			const noRulesDiv = resultsContainer.createDiv();
			noRulesDiv.style.padding = '15px';
			noRulesDiv.style.backgroundColor = 'var(--background-secondary)';
			noRulesDiv.style.borderRadius = '5px';
			noRulesDiv.createEl('p', {
				text: 'No enabled rules found. Create and enable rules in the plugin settings to test them.',
				cls: 'setting-item-description'
			});
			return;
		}

		// Test rules
		const matches = await this.plugin.ruleEngine.matchAndExecute(sampleText);

		// Display results header
		const headerDiv = resultsContainer.createDiv();
		headerDiv.style.padding = '10px';
		headerDiv.style.backgroundColor = 'var(--background-secondary)';
		headerDiv.style.borderRadius = '5px';
		headerDiv.style.marginBottom = '15px';

		if (matches.length > 0) {
			headerDiv.createEl('strong', { text: `✓ ${matches.length} rule${matches.length > 1 ? 's' : ''} matched` });
		} else {
			headerDiv.createEl('strong', { text: '✗ No rules matched' });
			headerDiv.createEl('p', {
				text: `Default action would be applied: ${this.plugin.settings.defaultAction}`,
				cls: 'setting-item-description'
			});
		}

		// Display each match
		matches.forEach((match, index) => {
			const matchDiv = resultsContainer.createDiv();
			matchDiv.style.padding = '15px';
			matchDiv.style.border = '2px solid var(--interactive-accent)';
			matchDiv.style.borderRadius = '5px';
			matchDiv.style.marginBottom = '15px';

			// Rule name and priority
			const titleDiv = matchDiv.createDiv();
			titleDiv.style.marginBottom = '10px';
			titleDiv.createEl('h3', { text: `Match ${index + 1}: ${match.rule.name}` });
			titleDiv.createEl('p', {
				text: `Priority: ${match.rule.priority}`,
				cls: 'setting-item-description'
			});

			// Matched text
			const matchedTextDiv = matchDiv.createDiv();
			matchedTextDiv.style.marginBottom = '10px';
			matchedTextDiv.createEl('strong', { text: 'Matched Text:' });
			const matchedPre = matchedTextDiv.createEl('pre');
			matchedPre.style.marginTop = '5px';
			matchedPre.style.padding = '10px';
			matchedPre.style.backgroundColor = 'var(--background-secondary)';
			matchedPre.style.borderRadius = '3px';
			matchedPre.style.whiteSpace = 'pre-wrap';
			matchedPre.textContent = match.matchedText;

			// Capture groups
			if (match.captureGroups.length > 0) {
				const captureDiv = matchDiv.createDiv();
				captureDiv.style.marginBottom = '10px';
				captureDiv.createEl('strong', { text: 'Capture Groups:' });

				const captureList = captureDiv.createEl('ul');
				captureList.style.marginTop = '5px';

				match.captureGroups.forEach((group, groupIndex) => {
					const listItem = captureList.createEl('li');
					listItem.style.fontFamily = 'monospace';
					listItem.innerHTML = `<strong>{{${groupIndex + 1}}}</strong>: ${group}`;
				});
			}

			// Actions
			const actionsDiv = matchDiv.createDiv();
			actionsDiv.createEl('strong', { text: 'Actions to Execute:' });

			const actionsList = actionsDiv.createEl('ol');
			actionsList.style.marginTop = '5px';

			match.rule.actions.forEach((action) => {
				const actionItem = actionsList.createEl('li');
				actionItem.style.marginBottom = '10px';

				const actionType = actionItem.createEl('div');
				actionType.innerHTML = `<strong>Type:</strong> ${action.type}`;

				// Show action details based on type
				if (action.type === 'create-note') {
					const config = action.config as CreateNoteConfig;
					const detailsDiv = actionItem.createDiv();
					detailsDiv.style.marginTop = '5px';
					detailsDiv.style.paddingLeft = '15px';
					detailsDiv.style.borderLeft = '2px solid var(--background-modifier-border)';

					const renderedTitle = RuleEngine.renderTemplate(config.titleTemplate, match.captureGroups);
					detailsDiv.innerHTML += `<div><strong>Folder:</strong> ${config.folderPath || '(root)'}</div>`;
					detailsDiv.innerHTML += `<div><strong>Title:</strong> ${renderedTitle}</div>`;

					if (Object.keys(config.frontmatter).length > 0) {
						detailsDiv.innerHTML += `<div style="margin-top: 5px;"><strong>Frontmatter:</strong></div>`;
						const fmList = detailsDiv.createEl('ul');
						fmList.style.marginTop = '2px';
						for (const [key, value] of Object.entries(config.frontmatter)) {
							const fmItem = fmList.createEl('li');
							fmItem.style.fontFamily = 'monospace';
							fmItem.innerHTML = `${key}: ${RuleEngine.renderTemplate(value, match.captureGroups)}`;
						}
					}

					if (config.bodyTemplate) {
						const renderedBody = RuleEngine.renderTemplate(config.bodyTemplate, match.captureGroups);
						detailsDiv.innerHTML += `<div style="margin-top: 5px;"><strong>Body:</strong></div>`;
						const bodyPre = detailsDiv.createEl('pre');
						bodyPre.style.marginTop = '2px';
						bodyPre.style.padding = '5px';
						bodyPre.style.backgroundColor = 'var(--background-secondary)';
						bodyPre.style.borderRadius = '3px';
						bodyPre.style.whiteSpace = 'pre-wrap';
						bodyPre.style.fontSize = '0.85em';
						bodyPre.textContent = renderedBody;
					}
				} else if (action.type === 'insert-content') {
					const config = action.config as InsertContentConfig;
					const detailsDiv = actionItem.createDiv();
					detailsDiv.style.marginTop = '5px';
					detailsDiv.style.paddingLeft = '15px';
					detailsDiv.style.borderLeft = '2px solid var(--background-modifier-border)';

					const renderedTarget = RuleEngine.renderTemplate(config.targetNote, match.captureGroups);
					const renderedContent = RuleEngine.renderTemplate(config.contentTemplate, match.captureGroups);

					detailsDiv.innerHTML += `<div><strong>Target Note:</strong> ${renderedTarget}</div>`;
					detailsDiv.innerHTML += `<div><strong>Insertion Point:</strong> ${config.insertionPoint.type}</div>`;

					if (config.insertionPoint.pattern) {
						detailsDiv.innerHTML += `<div><strong>Pattern:</strong> ${config.insertionPoint.pattern}</div>`;
					}
					if (config.insertionPoint.heading) {
						detailsDiv.innerHTML += `<div><strong>Heading:</strong> ${config.insertionPoint.heading}</div>`;
					}

					detailsDiv.innerHTML += `<div style="margin-top: 5px;"><strong>Content:</strong></div>`;
					const contentPre = detailsDiv.createEl('pre');
					contentPre.style.marginTop = '2px';
					contentPre.style.padding = '5px';
					contentPre.style.backgroundColor = 'var(--background-secondary)';
					contentPre.style.borderRadius = '3px';
					contentPre.style.whiteSpace = 'pre-wrap';
					contentPre.style.fontSize = '0.85em';
					contentPre.textContent = renderedContent;
				} else if (action.type === 'modify-frontmatter') {
					const config = action.config as ModifyFrontmatterConfig;
					const detailsDiv = actionItem.createDiv();
					detailsDiv.style.marginTop = '5px';
					detailsDiv.style.paddingLeft = '15px';
					detailsDiv.style.borderLeft = '2px solid var(--background-modifier-border)';

					const renderedTarget = RuleEngine.renderTemplate(config.targetNote, match.captureGroups);
					detailsDiv.innerHTML += `<div><strong>Target Note:</strong> ${renderedTarget}</div>`;
					detailsDiv.innerHTML += `<div><strong>Append to Arrays:</strong> ${config.appendToArrays ? 'Yes' : 'No'}</div>`;

					detailsDiv.innerHTML += `<div style="margin-top: 5px;"><strong>Properties:</strong></div>`;
					const propsList = detailsDiv.createEl('ul');
					propsList.style.marginTop = '2px';
					for (const [key, value] of Object.entries(config.properties)) {
						const propItem = propsList.createEl('li');
						propItem.style.fontFamily = 'monospace';
						propItem.innerHTML = `${key}: ${RuleEngine.renderTemplate(value, match.captureGroups)}`;
					}
				}
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Modal for editing processing rules
 */
class RuleEditorModal extends Modal {
	private plugin: NotebookOCRPlugin;
	private rule: ProcessingRule;
	private onSave: (rule: ProcessingRule) => Promise<void>;
	private workingRule: ProcessingRule;

	constructor(app: App, plugin: NotebookOCRPlugin, rule: ProcessingRule, onSave: (rule: ProcessingRule) => Promise<void>) {
		super(app);
		this.plugin = plugin;
		this.rule = rule;
		this.onSave = onSave;
		// Create a working copy of the rule
		this.workingRule = JSON.parse(JSON.stringify(rule));
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.createEl('h2', { text: this.rule.id.startsWith('rule-') && this.rule.name === 'New Rule' ? 'Create Processing Rule' : 'Edit Processing Rule' });

		// Rule name input
		new Setting(contentEl)
			.setName('Rule Name')
			.setDesc('A descriptive name for this rule')
			.addText(text => text
				.setPlaceholder('Enter rule name')
				.setValue(this.workingRule.name)
				.onChange((value) => {
					this.workingRule.name = value;
				}));

		// Regex pattern input
		const patternSetting = new Setting(contentEl)
			.setName('Pattern')
			.setDesc('Regular expression pattern to match OCR text');

		const patternTextarea = patternSetting.controlEl.createEl('textarea', {
			placeholder: 'Enter regex pattern (e.g., Project:\\s*(.+))',
			value: this.workingRule.pattern
		});
		patternTextarea.style.width = '100%';
		patternTextarea.style.minHeight = '80px';
		patternTextarea.style.fontFamily = 'monospace';
		patternTextarea.style.fontSize = '0.9em';
		patternTextarea.addEventListener('input', () => {
			this.workingRule.pattern = patternTextarea.value;
			// Validate pattern in real-time
			this.validatePattern(contentEl);
		});

		// Pattern validation message container
		const validationContainer = contentEl.createDiv({ cls: 'notebook-ocr-pattern-validation' });
		validationContainer.style.marginTop = '5px';
		validationContainer.style.marginBottom = '15px';

		// Initial validation
		this.validatePattern(contentEl);

		// Action configuration section
		contentEl.createEl('h3', { text: 'Actions' });
		contentEl.createEl('p', {
			text: 'Define what happens when this pattern matches OCR text. You can add multiple actions.',
			cls: 'setting-item-description'
		});

		// Actions container
		const actionsContainer = contentEl.createDiv({ cls: 'notebook-ocr-actions-container' });
		actionsContainer.style.marginTop = '10px';
		actionsContainer.style.marginBottom = '20px';

		// Render existing actions
		this.renderActions(actionsContainer);

		// Add Action button
		new Setting(contentEl)
			.setName('Add Action')
			.setDesc('Add a new action to this rule')
			.addButton(button => button
				.setButtonText('Add Action')
				.onClick(() => {
					// Create a new action with default values
					const newAction: RuleAction = {
						type: 'create-note',
						config: {
							folderPath: '',
							titleTemplate: '',
							frontmatter: {},
							bodyTemplate: ''
						} as CreateNoteConfig
					};

					this.workingRule.actions.push(newAction);
					this.renderActions(actionsContainer);
				}));

		// Pattern tester section
		const testerSection = contentEl.createDiv({ cls: 'notebook-ocr-pattern-tester' });
		testerSection.style.marginTop = '20px';
		testerSection.style.marginBottom = '20px';

		// Collapsible header
		const testerHeader = testerSection.createDiv({ cls: 'notebook-ocr-tester-header' });
		testerHeader.style.display = 'flex';
		testerHeader.style.alignItems = 'center';
		testerHeader.style.cursor = 'pointer';
		testerHeader.style.padding = '10px';
		testerHeader.style.backgroundColor = 'var(--background-secondary)';
		testerHeader.style.borderRadius = '5px';
		testerHeader.style.marginBottom = '10px';

		const testerToggle = testerHeader.createSpan({ text: '▶' });
		testerToggle.style.marginRight = '10px';
		testerToggle.style.fontSize = '12px';

		testerHeader.createEl('h3', { text: 'Pattern Tester' });
		testerHeader.style.margin = '0';

		// Collapsible content
		const testerContent = testerSection.createDiv({ cls: 'notebook-ocr-tester-content' });
		testerContent.style.display = 'none';

		// Toggle collapse/expand
		let isExpanded = false;
		testerHeader.addEventListener('click', () => {
			isExpanded = !isExpanded;
			testerContent.style.display = isExpanded ? 'block' : 'none';
			testerToggle.textContent = isExpanded ? '▼' : '▶';
		});

		// Sample text input
		const sampleTextSetting = new Setting(testerContent)
			.setName('Sample Text')
			.setDesc('Enter sample OCR text to test your pattern against');

		const sampleTextarea = sampleTextSetting.controlEl.createEl('textarea', {
			placeholder: 'Enter sample text here...\nFor example:\nProject: My New Project\nDue: 2024-12-31'
		});
		sampleTextarea.style.width = '100%';
		sampleTextarea.style.minHeight = '100px';
		sampleTextarea.style.fontFamily = 'monospace';
		sampleTextarea.style.fontSize = '0.9em';

		// Test button
		const testButtonSetting = new Setting(testerContent)
			.setName('Test Pattern')
			.setDesc('Test the pattern against the sample text')
			.addButton(button => button
				.setButtonText('Test')
				.setCta()
				.onClick(() => {
					this.testPattern(testerContent, sampleTextarea.value);
				}));

		// Results container
		const resultsContainer = testerContent.createDiv({ cls: 'notebook-ocr-test-results' });
		resultsContainer.style.marginTop = '15px';

		// Save and Cancel buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.marginTop = '20px';

		const saveButton = buttonContainer.createEl('button', { text: 'Save' });
		saveButton.classList.add('mod-cta');
		saveButton.addEventListener('click', async () => {
			// Validate before saving
			if (!this.workingRule.name.trim()) {
				ErrorHandler.handleValidationError('Please enter a rule name.');
				return;
			}

			if (!this.workingRule.pattern.trim()) {
				ErrorHandler.handleValidationError('Please enter a pattern.');
				return;
			}

			// Validate regex
			const validation = this.plugin.ruleEngine?.validateRegex(this.workingRule.pattern);
			if (validation && !validation.valid) {
				ErrorHandler.handleValidationError(
					`Invalid regex pattern: ${validation.error}`,
					'Please check your pattern syntax.'
				);
				return;
			}

			// Validate that at least one action is configured
			if (this.workingRule.actions.length === 0) {
				ErrorHandler.handleValidationError(
					'No actions configured.',
					'Please add at least one action to this rule.'
				);
				return;
			}

			// Validate each action's configuration
			for (let i = 0; i < this.workingRule.actions.length; i++) {
				const action = this.workingRule.actions[i];
				const actionNum = i + 1;

				if (action.type === 'create-note') {
					const config = action.config as CreateNoteConfig;
					if (!config.titleTemplate.trim()) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Title template is required for create-note actions.`
						);
						return;
					}
					// Validate title template syntax
					const titleValidation = RuleEngine.validateTemplate(config.titleTemplate);
					if (!titleValidation.valid) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Invalid title template - ${titleValidation.error}`
						);
						return;
					}
					if (titleValidation.warnings) {
						titleValidation.warnings.forEach(warning => {
							console.warn(`Action ${actionNum} title template: ${warning}`);
						});
					}
					// Validate body template syntax
					if (config.bodyTemplate) {
						const bodyValidation = RuleEngine.validateTemplate(config.bodyTemplate);
						if (!bodyValidation.valid) {
							ErrorHandler.handleValidationError(
								`Action ${actionNum}: Invalid body template - ${bodyValidation.error}`
							);
							return;
						}
					}
				} else if (action.type === 'insert-content') {
					const config = action.config as InsertContentConfig;
					if (!config.targetNote.trim()) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Target note is required for insert-content actions.`
						);
						return;
					}
					// Validate target note template syntax
					const targetValidation = RuleEngine.validateTemplate(config.targetNote);
					if (!targetValidation.valid) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Invalid target note template - ${targetValidation.error}`
						);
						return;
					}
					if (!config.contentTemplate.trim()) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Content template is required for insert-content actions.`
						);
						return;
					}
					// Validate content template syntax
					const contentValidation = RuleEngine.validateTemplate(config.contentTemplate);
					if (!contentValidation.valid) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Invalid content template - ${contentValidation.error}`
						);
						return;
					}
					// Validate insertion point configuration
					if (config.insertionPoint.type === 'before-pattern' || config.insertionPoint.type === 'after-pattern') {
						if (!config.insertionPoint.pattern || !config.insertionPoint.pattern.trim()) {
							ErrorHandler.handleValidationError(
								`Action ${actionNum}: Pattern is required for ${config.insertionPoint.type} insertion point.`
							);
							return;
						}
					}
					if (config.insertionPoint.type === 'under-heading') {
						if (!config.insertionPoint.heading || !config.insertionPoint.heading.trim()) {
							ErrorHandler.handleValidationError(
								`Action ${actionNum}: Heading is required for under-heading insertion point.`
							);
							return;
						}
					}
				} else if (action.type === 'modify-frontmatter') {
					const config = action.config as ModifyFrontmatterConfig;
					if (!config.targetNote.trim()) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: Target note is required for modify-frontmatter actions.`
						);
						return;
					}
					if (Object.keys(config.properties).length === 0) {
						ErrorHandler.handleValidationError(
							`Action ${actionNum}: At least one property is required for modify-frontmatter actions.`
						);
						return;
					}
				}
			}

			// Save the rule
			await this.onSave(this.workingRule);
			new Notice(`✓ Rule "${this.workingRule.name}" saved successfully`);
			this.close();
		});

		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});
	}

	/**
	 * Validate the regex pattern and display validation message
	 */
	private validatePattern(containerEl: HTMLElement) {
		const validationContainer = containerEl.querySelector('.notebook-ocr-pattern-validation') as HTMLElement;
		if (!validationContainer) return;

		validationContainer.empty();

		if (!this.workingRule.pattern.trim()) {
			return;
		}

		const validation = this.plugin.ruleEngine?.validateRegex(this.workingRule.pattern);
		if (validation) {
			if (validation.valid) {
				const successMsg = validationContainer.createDiv();
				successMsg.textContent = '✓ Valid regex pattern';
				successMsg.style.color = 'var(--text-success)';
			} else {
				const errorMsg = validationContainer.createDiv();
				errorMsg.textContent = `✗ Invalid regex: ${validation.error}`;
				errorMsg.style.color = 'var(--text-error)';
			}
		}
	}

	/**
	 * Render the actions list
	 */
	private renderActions(container: HTMLElement) {
		container.empty();

		if (this.workingRule.actions.length === 0) {
			container.createEl('p', {
				text: 'No actions configured. Click "Add Action" to create one.',
				cls: 'setting-item-description'
			});
			return;
		}

		this.workingRule.actions.forEach((action, index) => {
			const actionItem = container.createDiv({ cls: 'notebook-ocr-action-item' });
			actionItem.style.padding = '15px';
			actionItem.style.border = '1px solid var(--background-modifier-border)';
			actionItem.style.borderRadius = '5px';
			actionItem.style.marginBottom = '10px';

			// Action header
			const actionHeader = actionItem.createDiv({ cls: 'notebook-ocr-action-header' });
			actionHeader.style.display = 'flex';
			actionHeader.style.justifyContent = 'space-between';
			actionHeader.style.alignItems = 'center';
			actionHeader.style.marginBottom = '10px';

			const actionTitle = actionHeader.createEl('h4', { text: `Action ${index + 1}` });
			actionTitle.style.margin = '0';

			const removeButton = actionHeader.createEl('button', { text: 'Remove' });
			removeButton.style.color = 'var(--text-error)';
			removeButton.addEventListener('click', () => {
				this.workingRule.actions.splice(index, 1);
				this.renderActions(container);
			});

			// Action type dropdown
			new Setting(actionItem)
				.setName('Action Type')
				.setDesc('What type of action to perform')
				.addDropdown(dropdown => dropdown
					.addOption('create-note', 'Create Note')
					.addOption('insert-content', 'Insert Content')
					.addOption('modify-frontmatter', 'Modify Frontmatter')
					.setValue(action.type)
					.onChange((value) => {
						action.type = value as 'create-note' | 'insert-content' | 'modify-frontmatter';

						// Reset config based on type
						if (value === 'create-note') {
							action.config = {
								folderPath: '',
								titleTemplate: '',
								frontmatter: {},
								bodyTemplate: ''
							} as CreateNoteConfig;
						} else if (value === 'insert-content') {
							action.config = {
								targetNote: '',
								insertionPoint: { type: 'end' },
								contentTemplate: ''
							} as InsertContentConfig;
						} else if (value === 'modify-frontmatter') {
							action.config = {
								targetNote: '',
								properties: {},
								appendToArrays: false
							} as ModifyFrontmatterConfig;
						}

						this.renderActions(container);
					}));

			// Render configuration UI based on action type
			if (action.type === 'create-note') {
				this.renderCreateNoteConfig(actionItem, action.config as CreateNoteConfig);
			} else if (action.type === 'insert-content') {
				this.renderInsertContentConfig(actionItem, action.config as InsertContentConfig);
			} else if (action.type === 'modify-frontmatter') {
				this.renderModifyFrontmatterConfig(actionItem, action.config as ModifyFrontmatterConfig);
			}
		});
	}

	/**
	 * Render Create Note configuration UI
	 */
	private renderCreateNoteConfig(container: HTMLElement, config: CreateNoteConfig) {
		new Setting(container)
			.setName('Folder Path')
			.setDesc('Where to create the note (e.g., "Projects" or "Notes/Ideas")')
			.addText(text => text
				.setPlaceholder('Folder path')
				.setValue(config.folderPath)
				.onChange((value) => {
					config.folderPath = value;
				}));

		new Setting(container)
			.setName('Title Template')
			.setDesc('Note title. Use {{1}}, {{2}}, etc. for capture groups')
			.addText(text => text
				.setPlaceholder('e.g., Project: {{1}}')
				.setValue(config.titleTemplate)
				.onChange((value) => {
					config.titleTemplate = value;
				}));

		// Frontmatter properties
		const frontmatterSetting = new Setting(container)
			.setName('Frontmatter Properties')
			.setDesc('YAML frontmatter as JSON (e.g., {"tags": "project", "status": "{{1}}"})')
			.setClass('notebook-ocr-frontmatter-setting');

		const frontmatterTextarea = frontmatterSetting.controlEl.createEl('textarea', {
			placeholder: '{"tags": "project", "status": "{{1}}"}',
			value: JSON.stringify(config.frontmatter, null, 2)
		});
		frontmatterTextarea.style.width = '100%';
		frontmatterTextarea.style.minHeight = '60px';
		frontmatterTextarea.style.fontFamily = 'monospace';
		frontmatterTextarea.style.fontSize = '0.9em';
		frontmatterTextarea.addEventListener('input', () => {
			try {
				config.frontmatter = JSON.parse(frontmatterTextarea.value);
				frontmatterTextarea.style.borderColor = '';
			} catch (e) {
				frontmatterTextarea.style.borderColor = 'var(--text-error)';
			}
		});

		// Body template
		const bodySetting = new Setting(container)
			.setName('Body Template')
			.setDesc('Note content. Use {{1}}, {{2}}, etc. for capture groups');

		const bodyTextarea = bodySetting.controlEl.createEl('textarea', {
			placeholder: 'Note content here...\n\nCapture group 1: {{1}}',
			value: config.bodyTemplate
		});
		bodyTextarea.style.width = '100%';
		bodyTextarea.style.minHeight = '100px';
		bodyTextarea.style.fontFamily = 'monospace';
		bodyTextarea.style.fontSize = '0.9em';
		bodyTextarea.addEventListener('input', () => {
			config.bodyTemplate = bodyTextarea.value;
		});
	}

	/**
	 * Render Insert Content configuration UI
	 */
	private renderInsertContentConfig(container: HTMLElement, config: InsertContentConfig) {
		new Setting(container)
			.setName('Target Note')
			.setDesc('Path to the note where content will be inserted. Can use {{1}}, {{2}}, etc.')
			.addText(text => text
				.setPlaceholder('e.g., Daily/2024-01-01.md or {{1}}.md')
				.setValue(config.targetNote)
				.onChange((value) => {
					config.targetNote = value;
				}));

		// Insertion point type
		new Setting(container)
			.setName('Insertion Point')
			.setDesc('Where to insert the content in the target note')
			.addDropdown(dropdown => dropdown
				.addOption('beginning', 'Beginning of note')
				.addOption('end', 'End of note')
				.addOption('before-pattern', 'Before pattern')
				.addOption('after-pattern', 'After pattern')
				.addOption('under-heading', 'Under heading')
				.setValue(config.insertionPoint.type)
				.onChange((value) => {
					config.insertionPoint.type = value as InsertionPoint['type'];
					this.renderActions(container.parentElement as HTMLElement);
				}));

		// Conditional fields based on insertion point type
		if (config.insertionPoint.type === 'before-pattern' || config.insertionPoint.type === 'after-pattern') {
			new Setting(container)
				.setName('Pattern')
				.setDesc('Regex pattern to find insertion point')
				.addText(text => text
					.setPlaceholder('e.g., ^## Tasks')
					.setValue(config.insertionPoint.pattern || '')
					.onChange((value) => {
						config.insertionPoint.pattern = value;
					}));
		}

		if (config.insertionPoint.type === 'under-heading') {
			new Setting(container)
				.setName('Heading')
				.setDesc('Heading text (e.g., "## Tasks")')
				.addText(text => text
					.setPlaceholder('e.g., ## Tasks')
					.setValue(config.insertionPoint.heading || '')
					.onChange((value) => {
						config.insertionPoint.heading = value;
					}));
		}

		// Content template
		const contentSetting = new Setting(container)
			.setName('Content Template')
			.setDesc('Content to insert. Use {{1}}, {{2}}, etc. for capture groups');

		const contentTextarea = contentSetting.controlEl.createEl('textarea', {
			placeholder: '- [ ] {{1}}\n  Due: {{2}}',
			value: config.contentTemplate
		});
		contentTextarea.style.width = '100%';
		contentTextarea.style.minHeight = '80px';
		contentTextarea.style.fontFamily = 'monospace';
		contentTextarea.style.fontSize = '0.9em';
		contentTextarea.addEventListener('input', () => {
			config.contentTemplate = contentTextarea.value;
		});
	}

	/**
	 * Render Modify Frontmatter configuration UI
	 */
	private renderModifyFrontmatterConfig(container: HTMLElement, config: ModifyFrontmatterConfig) {
		new Setting(container)
			.setName('Target Note')
			.setDesc('Path to the note to modify. Can use {{1}}, {{2}}, etc.')
			.addText(text => text
				.setPlaceholder('e.g., Projects/{{1}}.md')
				.setValue(config.targetNote)
				.onChange((value) => {
					config.targetNote = value;
				}));

		// Properties
		const propertiesSetting = new Setting(container)
			.setName('Properties')
			.setDesc('Frontmatter properties to set as JSON (e.g., {"tags": "{{1}}", "status": "active"})');

		const propertiesTextarea = propertiesSetting.controlEl.createEl('textarea', {
			placeholder: '{"tags": "{{1}}", "status": "active"}',
			value: JSON.stringify(config.properties, null, 2)
		});
		propertiesTextarea.style.width = '100%';
		propertiesTextarea.style.minHeight = '60px';
		propertiesTextarea.style.fontFamily = 'monospace';
		propertiesTextarea.style.fontSize = '0.9em';
		propertiesTextarea.addEventListener('input', () => {
			try {
				config.properties = JSON.parse(propertiesTextarea.value);
				propertiesTextarea.style.borderColor = '';
			} catch (e) {
				propertiesTextarea.style.borderColor = 'var(--text-error)';
			}
		});

		// Append to arrays option
		new Setting(container)
			.setName('Append to Arrays')
			.setDesc('If enabled, values will be added to existing array properties instead of replacing them')
			.addToggle(toggle => toggle
				.setValue(config.appendToArrays)
				.onChange((value) => {
					config.appendToArrays = value;
				}));
	}

	/**
	 * Test the pattern against sample text and display results
	 */
	private testPattern(container: HTMLElement, sampleText: string) {
		const resultsContainer = container.querySelector('.notebook-ocr-test-results') as HTMLElement;
		if (!resultsContainer) return;

		resultsContainer.empty();

		// Validate pattern first
		if (!this.workingRule.pattern.trim()) {
			resultsContainer.createEl('p', {
				text: 'Please enter a pattern to test.',
				cls: 'setting-item-description'
			});
			return;
		}

		if (!sampleText.trim()) {
			resultsContainer.createEl('p', {
				text: 'Please enter sample text to test against.',
				cls: 'setting-item-description'
			});
			return;
		}

		// Test the pattern
		const testResult = this.plugin.ruleEngine?.testPattern(this.workingRule.pattern, sampleText);

		if (!testResult) {
			resultsContainer.createEl('p', {
				text: 'Unable to test pattern. Rule engine not available.',
				cls: 'setting-item-description'
			});
			return;
		}

		// Display validation errors
		if (testResult.error) {
			const errorDiv = resultsContainer.createDiv();
			errorDiv.style.padding = '10px';
			errorDiv.style.backgroundColor = 'var(--background-modifier-error)';
			errorDiv.style.borderRadius = '5px';
			errorDiv.style.marginBottom = '10px';

			errorDiv.createEl('strong', { text: '✗ Invalid Regex Pattern' });
			errorDiv.createEl('p', { text: testResult.error });
			return;
		}

		// Display match result
		const matchResultDiv = resultsContainer.createDiv();
		matchResultDiv.style.padding = '10px';
		matchResultDiv.style.borderRadius = '5px';
		matchResultDiv.style.marginBottom = '10px';

		if (testResult.matched) {
			matchResultDiv.style.backgroundColor = 'var(--background-modifier-success)';
			matchResultDiv.createEl('strong', { text: '✓ Pattern Matched!' });
		} else {
			matchResultDiv.style.backgroundColor = 'var(--background-modifier-error)';
			matchResultDiv.createEl('strong', { text: '✗ Pattern Did Not Match' });
			matchResultDiv.createEl('p', { text: 'The pattern did not match the sample text. Try adjusting your regex pattern.' });
			return;
		}

		// Display capture groups
		if (testResult.captureGroups.length > 0) {
			const captureGroupsDiv = resultsContainer.createDiv();
			captureGroupsDiv.style.padding = '10px';
			captureGroupsDiv.style.border = '1px solid var(--background-modifier-border)';
			captureGroupsDiv.style.borderRadius = '5px';
			captureGroupsDiv.style.marginBottom = '10px';

			captureGroupsDiv.createEl('strong', { text: 'Capture Groups:' });

			const captureList = captureGroupsDiv.createEl('ul');
			captureList.style.marginTop = '5px';
			captureList.style.marginBottom = '0';

			testResult.captureGroups.forEach((group, index) => {
				const listItem = captureList.createEl('li');
				listItem.style.fontFamily = 'monospace';
				listItem.innerHTML = `<strong>{{${index + 1}}}</strong>: ${group}`;
			});
		} else {
			const noCaptureDiv = resultsContainer.createDiv();
			noCaptureDiv.style.padding = '10px';
			noCaptureDiv.style.border = '1px solid var(--background-modifier-border)';
			noCaptureDiv.style.borderRadius = '5px';
			noCaptureDiv.style.marginBottom = '10px';

			noCaptureDiv.createEl('p', {
				text: 'No capture groups found. Add parentheses () to your pattern to capture parts of the match.',
				cls: 'setting-item-description'
			});
		}

		// Display template previews
		if (testResult.captureGroups.length > 0 && this.workingRule.actions.length > 0) {
			const previewDiv = resultsContainer.createDiv();
			previewDiv.style.padding = '10px';
			previewDiv.style.border = '1px solid var(--background-modifier-border)';
			previewDiv.style.borderRadius = '5px';

			previewDiv.createEl('strong', { text: 'Template Previews:' });

			this.workingRule.actions.forEach((action, actionIndex) => {
				const actionPreview = previewDiv.createDiv();
				actionPreview.style.marginTop = '10px';
				actionPreview.style.paddingLeft = '10px';
				actionPreview.style.borderLeft = '2px solid var(--interactive-accent)';

				actionPreview.createEl('em', { text: `Action ${actionIndex + 1}: ${action.type}` });

				if (action.type === 'create-note') {
					const config = action.config as CreateNoteConfig;
					const titlePreview = actionPreview.createDiv();
					titlePreview.style.marginTop = '5px';
					titlePreview.innerHTML = `<strong>Title:</strong> <code>${RuleEngine.renderTemplate(config.titleTemplate, testResult.captureGroups)}</code>`;

					if (config.bodyTemplate) {
						const bodyPreview = actionPreview.createDiv();
						bodyPreview.style.marginTop = '5px';
						const renderedBody = RuleEngine.renderTemplate(config.bodyTemplate, testResult.captureGroups);
						bodyPreview.innerHTML = `<strong>Body:</strong><pre style="margin-top: 5px; padding: 5px; background: var(--background-secondary); border-radius: 3px; white-space: pre-wrap;">${renderedBody}</pre>`;
					}
				} else if (action.type === 'insert-content') {
					const config = action.config as InsertContentConfig;
					const targetPreview = actionPreview.createDiv();
					targetPreview.style.marginTop = '5px';
					targetPreview.innerHTML = `<strong>Target:</strong> <code>${RuleEngine.renderTemplate(config.targetNote, testResult.captureGroups)}</code>`;

					const contentPreview = actionPreview.createDiv();
					contentPreview.style.marginTop = '5px';
					const renderedContent = RuleEngine.renderTemplate(config.contentTemplate, testResult.captureGroups);
					contentPreview.innerHTML = `<strong>Content:</strong><pre style="margin-top: 5px; padding: 5px; background: var(--background-secondary); border-radius: 3px; white-space: pre-wrap;">${renderedContent}</pre>`;
				} else if (action.type === 'modify-frontmatter') {
					const config = action.config as ModifyFrontmatterConfig;
					const targetPreview = actionPreview.createDiv();
					targetPreview.style.marginTop = '5px';
					targetPreview.innerHTML = `<strong>Target:</strong> <code>${RuleEngine.renderTemplate(config.targetNote, testResult.captureGroups)}</code>`;

					const propsPreview = actionPreview.createDiv();
					propsPreview.style.marginTop = '5px';
					propsPreview.innerHTML = '<strong>Properties:</strong>';

					const propsList = propsPreview.createEl('ul');
					propsList.style.marginTop = '5px';
					propsList.style.marginBottom = '0';

					for (const [key, value] of Object.entries(config.properties)) {
						const propItem = propsList.createEl('li');
						propItem.style.fontFamily = 'monospace';
						propItem.innerHTML = `<strong>${key}:</strong> ${RuleEngine.renderTemplate(value, testResult.captureGroups)}`;
					}
				}
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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

		// Add introductory help text
		const introDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		introDiv.style.marginBottom = '20px';
		introDiv.style.padding = '10px';
		introDiv.style.backgroundColor = 'var(--background-secondary)';
		introDiv.style.borderRadius = '5px';
		introDiv.innerHTML = `
			<p><strong>Welcome to Notebook OCR Plugin!</strong></p>
			<p>This plugin helps you digitize handwritten notebook pages using OCR (Optical Character Recognition) and automatically organize the extracted text using customizable rules.</p>
			<p>💡 <strong>Quick Start:</strong> Use the camera icon in the ribbon or the command palette to import your first image. Unmatched text will be added to your daily note by default.</p>
		`;

		// OCR Backend Setting
		containerEl.createEl('h3', { text: 'OCR Settings' });

		new Setting(containerEl)
			.setName('OCR Backend')
			.setDesc('Choose between local (Tesseract.js) or cloud-based OCR. Local processing is recommended for privacy and offline use.')
			.addDropdown(dropdown => dropdown
				.addOption('tesseract', 'Local (Tesseract.js) - Recommended')
				.addOption('cloud', 'Cloud API - Coming Soon')
				.setValue(this.plugin.settings.ocrBackend)
				.onChange(async (value) => {
					this.plugin.settings.ocrBackend = value as 'tesseract' | 'cloud';
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide cloud settings
				}));

		// Add additional help text for OCR backend
		const ocrHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		ocrHelpDiv.style.marginTop = '-10px';
		ocrHelpDiv.style.marginBottom = '15px';
		ocrHelpDiv.style.paddingLeft = '15px';
		ocrHelpDiv.innerHTML = `
			<strong>Local (Tesseract.js):</strong> Works offline, privacy-friendly, free. Moderate accuracy for handwriting.<br>
			<strong>Cloud API:</strong> Better accuracy, faster processing. Requires internet and API key. (Feature coming soon)
		`;

		// Cloud API settings (shown only when cloud backend is selected)
		if (this.plugin.settings.ocrBackend === 'cloud') {
			const cloudWarningDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			cloudWarningDiv.style.padding = '10px';
			cloudWarningDiv.style.backgroundColor = 'var(--background-modifier-error)';
			cloudWarningDiv.style.borderRadius = '5px';
			cloudWarningDiv.style.marginBottom = '15px';
			cloudWarningDiv.innerHTML = `
				<strong>⚠️ Cloud OCR is not yet implemented.</strong><br>
				This feature is coming soon. The plugin will fall back to local Tesseract.js processing.
			`;

			new Setting(containerEl)
				.setName('Cloud API Provider')
				.setDesc('Select your cloud OCR provider. Note: This feature is not yet available.')
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
				.setDesc('Enter your API key for the selected provider. Your API key is stored securely and never shared.')
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

		const dailyNoteHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		dailyNoteHelpDiv.style.marginBottom = '15px';
		dailyNoteHelpDiv.innerHTML = `
			Configure how unmatched OCR text is handled. By default, text that doesn't match any processing rules will be inserted into your daily note.
		`;

		new Setting(containerEl)
			.setName('Import Heading')
			.setDesc('Heading under which imported notes will be placed in daily notes. If the heading doesn\'t exist, it will be created automatically. Leave empty to append to the end of the note.')
			.addText(text => text
				.setPlaceholder('## Imported Notes')
				.setValue(this.plugin.settings.dailyNoteImportHeading)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteImportHeading = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Action')
			.setDesc('What to do with OCR text when no processing rules match. "Insert into Daily Note" adds text to today\'s note, "Discard" ignores it, "Prompt User" asks you each time.')
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
			.setDesc('Regex pattern to detect separate notes within OCR text. Lines matching this pattern will be formatted as bullet points. Example: "^[-*]\\s" matches lines starting with - or *')
			.addText(text => text
				.setPlaceholder('^[-*]\\s')
				.setValue(this.plugin.settings.noteSeparatorPattern)
				.onChange(async (value) => {
					this.plugin.settings.noteSeparatorPattern = value;
					await this.plugin.saveSettings();
				}));

		// Folder Monitoring Settings
		containerEl.createEl('h3', { text: 'Folder Monitoring' });

		const folderMonitorHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		folderMonitorHelpDiv.style.marginBottom = '15px';
		folderMonitorHelpDiv.innerHTML = `
			Automatically process new images added to a specific folder. Perfect for workflows where you regularly drop scanned images into your vault.
		`;

		new Setting(containerEl)
			.setName('Enable Folder Monitoring')
			.setDesc('Automatically process new images in a monitored folder. The plugin will check for new images at the configured interval and process them using your rules.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.folderMonitoringEnabled)
				.onChange(async (value) => {
					this.plugin.settings.folderMonitoringEnabled = value;
					await this.plugin.saveSettings();

					// Restart monitor when settings change
					if (this.plugin.folderMonitor) {
						if (value) {
							this.plugin.folderMonitor.start(
								this.plugin.settings.monitoredFolderPath,
								this.plugin.settings.monitoringInterval
							);
						} else {
							this.plugin.folderMonitor.stop();
						}
					}

					this.display(); // Refresh to show/hide monitoring settings
				}));

		if (this.plugin.settings.folderMonitoringEnabled) {
			new Setting(containerEl)
				.setName('Monitored Folder')
				.setDesc('Path to the folder to monitor for new images (relative to vault root). The folder will be created if it doesn\'t exist. Example: "Inbox" or "Scans/Notebooks"')
				.addText(text => text
					.setPlaceholder('Inbox')
					.setValue(this.plugin.settings.monitoredFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.monitoredFolderPath = value;
						await this.plugin.saveSettings();

						// Restart monitor with new folder path
						if (this.plugin.folderMonitor && this.plugin.settings.folderMonitoringEnabled) {
							this.plugin.folderMonitor.start(
								this.plugin.settings.monitoredFolderPath,
								this.plugin.settings.monitoringInterval
							);
						}
					}));

			new Setting(containerEl)
				.setName('Monitoring Interval')
				.setDesc('How often to check for new images. "Hourly" checks every hour, "Daily" checks once per day. Use "Process folder now" command for immediate processing.')
				.addDropdown(dropdown => dropdown
					.addOption('hourly', 'Hourly')
					.addOption('daily', 'Daily')
					.setValue(this.plugin.settings.monitoringInterval)
					.onChange(async (value) => {
						this.plugin.settings.monitoringInterval = value as 'hourly' | 'daily';
						await this.plugin.saveSettings();

						// Restart monitor with new interval
						if (this.plugin.folderMonitor && this.plugin.settings.folderMonitoringEnabled) {
							this.plugin.folderMonitor.start(
								this.plugin.settings.monitoredFolderPath,
								this.plugin.settings.monitoringInterval
							);
						}
					}));

			new Setting(containerEl)
				.setName('Move Processed Images')
				.setDesc('Move images to a separate folder after successful processing. This helps keep your monitored folder clean and prevents reprocessing the same images.')
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
					.setDesc('Path to folder for processed images (relative to vault root). Processed images will be moved here to keep your inbox clean.')
					.addText(text => text
						.setPlaceholder('Processed')
						.setValue(this.plugin.settings.processedImagesFolderPath)
						.onChange(async (value) => {
							this.plugin.settings.processedImagesFolderPath = value;
							await this.plugin.saveSettings();
						}));
			}
		}

		// Mobile Settings (conditionally shown only on mobile platform)
		if (PlatformHelper.isMobile()) {
			containerEl.createEl('h3', { text: 'Mobile Settings' });

			const mobileHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			mobileHelpDiv.style.marginBottom = '15px';
			mobileHelpDiv.innerHTML = `
				📱 Mobile-specific settings for camera capture and image processing on iOS and Android devices.
			`;

			new Setting(containerEl)
				.setName('Enable Camera Capture')
				.setDesc('Enable camera capture command on mobile devices. This adds a "Capture and import" command that launches your device camera to capture and immediately process notebook pages.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enableCameraCapture)
					.onChange(async (value) => {
						this.plugin.settings.enableCameraCapture = value;
						await this.plugin.saveSettings();

						// Reload commands to add/remove camera capture command
						// Note: In a real implementation, we would need to reload the plugin
						// For now, just save the setting
						new Notice('Please reload the plugin for camera capture changes to take effect');
					}));

			new Setting(containerEl)
				.setName('Save Captures To')
				.setDesc('Folder path for saving camera captures (relative to vault root). Captured images will be saved here before processing.')
				.addText(text => text
					.setPlaceholder('Captures')
					.setValue(this.plugin.settings.saveCapturesToFolder)
					.onChange(async (value) => {
						this.plugin.settings.saveCapturesToFolder = value;
						await this.plugin.saveSettings();
					}));
		}

		// Processing Rules section
		containerEl.createEl('h3', { text: 'Processing Rules' });

		const rulesHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		rulesHelpDiv.style.marginBottom = '15px';
		rulesHelpDiv.style.padding = '10px';
		rulesHelpDiv.style.backgroundColor = 'var(--background-secondary)';
		rulesHelpDiv.style.borderRadius = '5px';
		rulesHelpDiv.innerHTML = `
			<p><strong>Processing rules</strong> let you automatically organize OCR text based on patterns you define.</p>
			<p><strong>How it works:</strong></p>
			<ol style="margin: 5px 0; padding-left: 20px;">
				<li>Define a regex pattern to match specific text (e.g., "Project: (.+)")</li>
				<li>Configure actions to take when the pattern matches (create note, insert content, etc.)</li>
				<li>Use capture groups ({{1}}, {{2}}, etc.) in templates to reuse matched text</li>
			</ol>
			<p>💡 <strong>Tip:</strong> Check out the <code>example-rules.json</code> file in the plugin folder for ready-to-use rule examples!</p>
			<p>🧪 <strong>Testing:</strong> Use the pattern tester in each rule editor to validate your patterns before saving.</p>
		`;

		// Add Rule button
		new Setting(containerEl)
			.setName('Add Processing Rule')
			.setDesc('Create a new rule to automatically process and organize OCR text based on patterns. Rules are tested in priority order (drag to reorder).')
			.addButton(button => button
				.setButtonText('Add Rule')
				.setCta()
				.onClick(async () => {
					// Create a new rule with default values
					const newRule: ProcessingRule = {
						id: this.generateRuleId(),
						name: 'New Rule',
						enabled: true,
						priority: this.plugin.settings.processingRules.length,
						pattern: '',
						actions: []
					};

					// Open the rule editor modal
					const modal = new RuleEditorModal(this.app, this.plugin, newRule, async (savedRule) => {
						// Add the rule to settings
						this.plugin.settings.processingRules.push(savedRule);
						await this.plugin.saveSettings();

						// Update rule engine
						if (this.plugin.ruleEngine) {
							this.plugin.ruleEngine.setRules(this.plugin.settings.processingRules);
						}

						// Refresh the display
						this.display();
					});

					modal.open();
				}));

		// Display existing rules
		if (this.plugin.settings.processingRules.length > 0) {
			const rulesContainer = containerEl.createDiv({ cls: 'notebook-ocr-rules-container' });
			rulesContainer.style.marginTop = '20px';

			// Add drag-and-drop styling
			rulesContainer.style.display = 'flex';
			rulesContainer.style.flexDirection = 'column';
			rulesContainer.style.gap = '10px';

			this.plugin.settings.processingRules.forEach((rule, index) => {
				const ruleItem = rulesContainer.createDiv({ cls: 'notebook-ocr-rule-item' });
				ruleItem.style.padding = '10px';
				ruleItem.style.border = '1px solid var(--background-modifier-border)';
				ruleItem.style.borderRadius = '5px';
				ruleItem.style.display = 'flex';
				ruleItem.style.alignItems = 'center';
				ruleItem.style.gap = '10px';
				ruleItem.style.cursor = 'move';
				ruleItem.draggable = true;

				// Drag handle
				const dragHandle = ruleItem.createSpan({ cls: 'notebook-ocr-drag-handle' });
				dragHandle.textContent = '⋮⋮';
				dragHandle.style.cursor = 'grab';
				dragHandle.style.fontSize = '16px';
				dragHandle.style.color = 'var(--text-muted)';

				// Rule info container
				const ruleInfo = ruleItem.createDiv({ cls: 'notebook-ocr-rule-info' });
				ruleInfo.style.flex = '1';
				ruleInfo.style.minWidth = '0';

				// Rule name
				const ruleName = ruleInfo.createDiv({ cls: 'notebook-ocr-rule-name' });
				ruleName.textContent = rule.name;
				ruleName.style.fontWeight = '500';
				ruleName.style.marginBottom = '4px';

				// Rule pattern preview
				const rulePattern = ruleInfo.createDiv({ cls: 'notebook-ocr-rule-pattern' });
				rulePattern.textContent = rule.pattern ? `Pattern: ${rule.pattern.substring(0, 50)}${rule.pattern.length > 50 ? '...' : ''}` : 'No pattern set';
				rulePattern.style.fontSize = '0.9em';
				rulePattern.style.color = 'var(--text-muted)';
				rulePattern.style.fontFamily = 'monospace';

				// Actions container
				const actionsContainer = ruleItem.createDiv({ cls: 'notebook-ocr-rule-actions' });
				actionsContainer.style.display = 'flex';
				actionsContainer.style.gap = '5px';
				actionsContainer.style.alignItems = 'center';

				// Enable/disable toggle
				const toggleContainer = actionsContainer.createDiv();
				const toggle = new Setting(toggleContainer)
					.addToggle(toggle => toggle
						.setValue(rule.enabled)
						.onChange(async (value) => {
							rule.enabled = value;
							await this.plugin.saveSettings();

							// Update rule engine
							if (this.plugin.ruleEngine) {
								this.plugin.ruleEngine.setRules(this.plugin.settings.processingRules);
							}
						}));
				toggle.settingEl.style.border = 'none';
				toggle.settingEl.style.padding = '0';

				// Edit button
				const editButton = actionsContainer.createEl('button', { text: 'Edit' });
				editButton.style.padding = '4px 8px';
				editButton.addEventListener('click', () => {
					const modal = new RuleEditorModal(this.app, this.plugin, rule, async (savedRule) => {
						// Update the rule in settings
						const ruleIndex = this.plugin.settings.processingRules.findIndex(r => r.id === savedRule.id);
						if (ruleIndex !== -1) {
							this.plugin.settings.processingRules[ruleIndex] = savedRule;
							await this.plugin.saveSettings();

							// Update rule engine
							if (this.plugin.ruleEngine) {
								this.plugin.ruleEngine.setRules(this.plugin.settings.processingRules);
							}

							// Refresh the display
							this.display();
						}
					});

					modal.open();
				});

				// Delete button
				const deleteButton = actionsContainer.createEl('button', { text: 'Delete' });
				deleteButton.style.padding = '4px 8px';
				deleteButton.style.color = 'var(--text-error)';
				deleteButton.addEventListener('click', async () => {
					// Confirm deletion
					if (confirm(`Are you sure you want to delete the rule "${rule.name}"?`)) {
						// Remove the rule from settings
						this.plugin.settings.processingRules = this.plugin.settings.processingRules.filter(r => r.id !== rule.id);
						await this.plugin.saveSettings();

						// Update rule engine
						if (this.plugin.ruleEngine) {
							this.plugin.ruleEngine.setRules(this.plugin.settings.processingRules);
						}

						// Refresh the display
						this.display();
					}
				});

				// Drag and drop handlers
				ruleItem.addEventListener('dragstart', (e) => {
					e.dataTransfer!.effectAllowed = 'move';
					e.dataTransfer!.setData('text/plain', index.toString());
					ruleItem.style.opacity = '0.5';
				});

				ruleItem.addEventListener('dragend', (e) => {
					ruleItem.style.opacity = '1';
				});

				ruleItem.addEventListener('dragover', (e) => {
					e.preventDefault();
					e.dataTransfer!.dropEffect = 'move';
					ruleItem.style.borderColor = 'var(--interactive-accent)';
				});

				ruleItem.addEventListener('dragleave', (e) => {
					ruleItem.style.borderColor = 'var(--background-modifier-border)';
				});

				ruleItem.addEventListener('drop', async (e) => {
					e.preventDefault();
					ruleItem.style.borderColor = 'var(--background-modifier-border)';

					const fromIndex = parseInt(e.dataTransfer!.getData('text/plain'));
					const toIndex = index;

					if (fromIndex !== toIndex) {
						// Reorder the rules
						const rules = [...this.plugin.settings.processingRules];
						const [movedRule] = rules.splice(fromIndex, 1);
						rules.splice(toIndex, 0, movedRule);

						// Update priorities
						rules.forEach((r, i) => {
							r.priority = i;
						});

						this.plugin.settings.processingRules = rules;
						await this.plugin.saveSettings();

						// Update rule engine
						if (this.plugin.ruleEngine) {
							this.plugin.ruleEngine.setRules(this.plugin.settings.processingRules);
						}

						// Refresh the display
						this.display();
					}
				});
			});
		} else {
			const noRulesDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			noRulesDiv.style.padding = '15px';
			noRulesDiv.style.backgroundColor = 'var(--background-secondary)';
			noRulesDiv.style.borderRadius = '5px';
			noRulesDiv.style.textAlign = 'center';
			noRulesDiv.innerHTML = `
				<p><strong>No processing rules configured yet.</strong></p>
				<p>Click "Add Rule" above to create your first rule and start automatically organizing your notebook content!</p>
				<p style="margin-top: 10px;">📚 <strong>Need inspiration?</strong> Check out <code>example-rules.json</code> for common patterns like:</p>
				<ul style="text-align: left; display: inline-block; margin: 5px 0;">
					<li>Capturing hashtag ideas</li>
					<li>Creating project task lists</li>
					<li>Organizing meeting notes</li>
					<li>Tracking expenses</li>
					<li>And more!</li>
				</ul>
			`;
		}
	}

	/**
	 * Generate a unique rule ID
	 */
	private generateRuleId(): string {
		return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}
}
