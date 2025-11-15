import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
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

		// Add settings tab
		this.addSettingTab(new NotebookOCRSettingTab(this.app, this));

		// TODO: Initialize rule engine
		// TODO: Initialize vault manager
		// TODO: Initialize folder monitor
		// TODO: Register commands
		// TODO: Add ribbon icon
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
