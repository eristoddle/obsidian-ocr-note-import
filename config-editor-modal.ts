import { App, Modal, Setting, Notice } from 'obsidian';
import {
	PreprocessingConfig,
	NotebookPreset,
	SplitDirection,
	RotationAngle,
	RotationTiming
} from './preprocessing-types';

/**
 * Type definition for the plugin interface needed by ConfigEditorModal
 */
interface NotebookOCRPlugin {
	settings: {
		customPreprocessingConfigs: PreprocessingConfig[];
	};
	saveSettings(): Promise<void>;
	preprocessingConfigManager?: {
		getAllConfigs(): PreprocessingConfig[];
		getConfig(id: string): PreprocessingConfig | undefined;
		setDefaultConfig(id: string): void;
		saveConfig(config: PreprocessingConfig): void;
		deleteConfig(id: string): boolean;
		duplicateConfig(id: string, newName: string): PreprocessingConfig | null;
		validateConfig(config: PreprocessingConfig): string[];
	} | null;
	settingTab?: {
		display(): void;
	} | null;
}

/**
 * Configuration Editor Modal
 * Allows users to create or edit custom preprocessing configurations
 */
export class ConfigEditorModal extends Modal {
	private plugin: NotebookOCRPlugin;
	private config: PreprocessingConfig;
	private isNewConfig: boolean;
	private onSave?: (config: PreprocessingConfig) => void;

	/**
	 * Creates a new configuration editor modal
	 * @param app - Obsidian app instance
	 * @param plugin - Plugin instance
	 * @param config - Optional existing config to edit (creates new if not provided)
	 * @param onSave - Optional callback when config is saved
	 */
	constructor(
		app: App,
		plugin: NotebookOCRPlugin,
		config?: PreprocessingConfig,
		onSave?: (config: PreprocessingConfig) => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;

		// Clone config for editing or create new config
		if (config) {
			this.config = this.cloneConfig(config);
			this.isNewConfig = false;
		} else {
			this.config = this.createNewConfig();
			this.isNewConfig = true;
		}
	}

	/**
	 * Clone a configuration for editing
	 */
	private cloneConfig(config: PreprocessingConfig): PreprocessingConfig {
		return {
			...config,
			split: { ...config.split },
			rotation: {
				...config.rotation,
				perPageAngles: config.rotation.perPageAngles
					? [...config.rotation.perPageAngles]
					: undefined
			}
		};
	}

	/**
	 * Create a new default configuration
	 */
	private createNewConfig(): PreprocessingConfig {
		return {
			id: `custom-${Date.now()}`,
			name: 'New Configuration',
			description: '',
			preset: NotebookPreset.CUSTOM,
			split: {
				enabled: false,
				direction: SplitDirection.HORIZONTAL,
				pageCount: 2
			},
			rotation: {
				enabled: false,
				timing: RotationTiming.BEFORE_SPLIT,
				wholeImageAngle: RotationAngle.NONE,
				perPageAngles: [RotationAngle.NONE, RotationAngle.NONE]
			}
		};
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.createEl('h2', {
			text: this.isNewConfig ? 'Create Configuration' : 'Edit Configuration'
		});

		// Render all sections
		this.renderNameAndDescription(contentEl);
		this.renderSplitSettings(contentEl);
		this.renderRotationSettings(contentEl);
		this.renderButtons(contentEl);
	}

	/**
	 * Render configuration name and description inputs
	 */
	private renderNameAndDescription(containerEl: HTMLElement): void {
		// Configuration name
		new Setting(containerEl)
			.setName('Configuration Name')
			.setDesc('A descriptive name for this configuration')
			.addText(text => text
				.setPlaceholder('Enter configuration name')
				.setValue(this.config.name)
				.onChange((value) => {
					this.config.name = value;
				}));

		// Configuration description
		new Setting(containerEl)
			.setName('Description')
			.setDesc('Describe what notebook format this configuration is for')
			.addTextArea(textarea => {
				textarea
					.setPlaceholder('e.g., Two A6 pages scanned side-by-side')
					.setValue(this.config.description)
					.onChange((value) => {
						this.config.description = value;
					});
				textarea.inputEl.rows = 3;
				textarea.inputEl.style.width = '100%';
			});
	}

	/**
	 * Render split settings UI
	 */
	private renderSplitSettings(containerEl: HTMLElement): void {
		// Section heading
		containerEl.createEl('h3', { text: 'Split Settings' });

		// Enable splitting toggle
		new Setting(containerEl)
			.setName('Enable Splitting')
			.setDesc('Split the image into multiple pages')
			.addToggle(toggle => toggle
				.setValue(this.config.split.enabled)
				.onChange((value) => {
					this.config.split.enabled = value;
					// Refresh the modal to show/hide split options
					this.onOpen();
				}));

		// Show split options only if enabled
		if (this.config.split.enabled) {
			// Split direction
			new Setting(containerEl)
				.setName('Split Direction')
				.setDesc('Direction to split the image')
				.addDropdown(dropdown => dropdown
					.addOption(SplitDirection.HORIZONTAL, 'Horizontal (top to bottom)')
					.addOption(SplitDirection.VERTICAL, 'Vertical (left to right)')
					.setValue(this.config.split.direction)
					.onChange((value) => {
						this.config.split.direction = value as SplitDirection;
					}));

			// Number of pages
			new Setting(containerEl)
				.setName('Number of Pages')
				.setDesc('How many pages to split the image into (2-4)')
				.addDropdown(dropdown => dropdown
					.addOption('2', '2 pages')
					.addOption('3', '3 pages')
					.addOption('4', '4 pages')
					.setValue(String(this.config.split.pageCount))
					.onChange((value) => {
						this.config.split.pageCount = parseInt(value);
						// Update per-page rotation angles array if needed
						if (this.config.rotation.timing === RotationTiming.AFTER_SPLIT) {
							this.updatePerPageAngles();
							this.onOpen();
						}
					}));
		}
	}

	/**
	 * Render rotation settings UI
	 */
	private renderRotationSettings(containerEl: HTMLElement): void {
		// Section heading
		containerEl.createEl('h3', { text: 'Rotation Settings' });

		// Enable rotation toggle
		new Setting(containerEl)
			.setName('Enable Rotation')
			.setDesc('Rotate the image or individual pages')
			.addToggle(toggle => toggle
				.setValue(this.config.rotation.enabled)
				.onChange((value) => {
					this.config.rotation.enabled = value;
					// Refresh the modal to show/hide rotation options
					this.onOpen();
				}));

		// Show rotation options only if enabled
		if (this.config.rotation.enabled) {
			// Rotation timing
			new Setting(containerEl)
				.setName('Rotation Timing')
				.setDesc('When to apply rotation')
				.addDropdown(dropdown => dropdown
					.addOption(RotationTiming.BEFORE_SPLIT, 'Before Split (whole image)')
					.addOption(RotationTiming.AFTER_SPLIT, 'After Split (per page)')
					.setValue(this.config.rotation.timing)
					.onChange((value) => {
						this.config.rotation.timing = value as RotationTiming;
						// Initialize per-page angles if switching to after-split
						if (value === RotationTiming.AFTER_SPLIT) {
							this.updatePerPageAngles();
						}
						// Refresh the modal to show appropriate rotation controls
						this.onOpen();
					}));

			// Whole image rotation (before split)
			if (this.config.rotation.timing === RotationTiming.BEFORE_SPLIT) {
				new Setting(containerEl)
					.setName('Rotation Angle')
					.setDesc('Angle to rotate the whole image')
					.addDropdown(dropdown => dropdown
						.addOption(String(RotationAngle.NONE), '0° (no rotation)')
						.addOption(String(RotationAngle.CLOCKWISE_90), '90° clockwise')
						.addOption(String(RotationAngle.CLOCKWISE_180), '180°')
						.addOption(String(RotationAngle.CLOCKWISE_270), '270° clockwise')
						.setValue(String(this.config.rotation.wholeImageAngle || RotationAngle.NONE))
						.onChange((value) => {
							this.config.rotation.wholeImageAngle = parseInt(value) as RotationAngle;
						}));
			}

			// Per-page rotation (after split)
			if (this.config.rotation.timing === RotationTiming.AFTER_SPLIT) {
				const pageCount = this.config.split.enabled ? this.config.split.pageCount : 1;

				// Ensure per-page angles array exists and has correct length
				this.updatePerPageAngles();

				// Create rotation controls for each page
				for (let i = 0; i < pageCount; i++) {
					new Setting(containerEl)
						.setName(`Page ${i + 1} Rotation`)
						.setDesc(`Rotation angle for page ${i + 1}`)
						.addDropdown(dropdown => dropdown
							.addOption(String(RotationAngle.NONE), '0° (no rotation)')
							.addOption(String(RotationAngle.CLOCKWISE_90), '90° clockwise')
							.addOption(String(RotationAngle.CLOCKWISE_180), '180°')
							.addOption(String(RotationAngle.CLOCKWISE_270), '270° clockwise')
							.setValue(String(this.config.rotation.perPageAngles![i]))
							.onChange((value) => {
								this.config.rotation.perPageAngles![i] = parseInt(value) as RotationAngle;
							}));
				}
			}
		}
	}

	/**
	 * Update per-page angles array to match page count
	 */
	private updatePerPageAngles(): void {
		const pageCount = this.config.split.enabled ? this.config.split.pageCount : 1;

		if (!this.config.rotation.perPageAngles) {
			this.config.rotation.perPageAngles = [];
		}

		// Adjust array length to match page count
		while (this.config.rotation.perPageAngles.length < pageCount) {
			this.config.rotation.perPageAngles.push(RotationAngle.NONE);
		}
		while (this.config.rotation.perPageAngles.length > pageCount) {
			this.config.rotation.perPageAngles.pop();
		}
	}

	/**
	 * Render save and cancel buttons
	 */
	/**
	 * Render save and cancel buttons
	 */
	private renderButtons(containerEl: HTMLElement): void {
		const buttonContainer = containerEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.marginTop = '20px';

		// Preview button
		const previewButton = buttonContainer.createEl('button', { text: 'Preview with Sample Image' });
		previewButton.addEventListener('click', async () => {
			await this.openPreview();
		});

		// Cancel button
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});

		// Save button
		const saveButton = buttonContainer.createEl('button', { text: 'Save' });
		saveButton.classList.add('mod-cta');
		saveButton.addEventListener('click', async () => {
			await this.handleSave();
		});
	}

	/**
	 * Open preview with sample image
	 */
	private async openPreview(): Promise<void> {
		const sampleImage = await this.createSampleImage();

		// Import dynamically to avoid circular dependencies if possible,
		// but here we need to import it at the top.
		// Assuming PreprocessingPreviewModal is imported.
		const { PreprocessingPreviewModal } = await import('./preprocessing-preview-modal');

		const previewModal = new PreprocessingPreviewModal(
			this.app,
			{
				imageData: sampleImage,
				config: this.config,
				mode: 'testing',
				onConfirm: (customSplitPositions) => {
					if (customSplitPositions && this.config.split.enabled) {
						this.config.split.customPositions = customSplitPositions;
						new Notice('Custom split positions saved to configuration');
					}
				}
			}
		);
		previewModal.open();
	}

	/**
	 * Create a sample image for previewing
	 */
	private async createSampleImage(): Promise<ArrayBuffer> {
		const canvas = document.createElement('canvas');
		canvas.width = 1000;
		canvas.height = 800;
		const ctx = canvas.getContext('2d');

		if (!ctx) {
			throw new Error('Failed to create canvas context');
		}

		// Draw background
		ctx.fillStyle = '#f0f0f0';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw some "notebook" lines
		ctx.strokeStyle = '#ccc';
		ctx.lineWidth = 1;

		// Vertical divider hint
		ctx.beginPath();
		ctx.moveTo(500, 0);
		ctx.lineTo(500, 800);
		ctx.stroke();

		// Horizontal lines
		for (let i = 40; i < 800; i += 30) {
			ctx.beginPath();
			ctx.moveTo(20, i);
			ctx.lineTo(980, i);
			ctx.stroke();
		}

		// Add some text
		ctx.fillStyle = '#333';
		ctx.font = '24px sans-serif';
		ctx.fillText('Sample Notebook Page (Left)', 100, 100);
		ctx.fillText('Sample Notebook Page (Right)', 600, 100);

		ctx.font = '16px sans-serif';
		ctx.fillText('This is a generated sample image for testing your configuration.', 100, 150);
		ctx.fillText('Use this to verify split lines and rotation.', 600, 150);

		// Convert to ArrayBuffer
		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Failed to create sample image blob'));
					return;
				}
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as ArrayBuffer);
				reader.onerror = () => reject(new Error('Failed to read sample image blob'));
				reader.readAsArrayBuffer(blob);
			}, 'image/jpeg');
		});
	}

	/**
	 * Handle save button click
	 */
	private async handleSave(): Promise<void> {
		// Validate configuration name
		if (!this.config.name.trim()) {
			new Notice('Please enter a configuration name');
			return;
		}

		// Validate configuration using config manager
		if (this.plugin.preprocessingConfigManager) {
			const errors = this.plugin.preprocessingConfigManager.validateConfig(this.config);
			if (errors.length > 0) {
				new Notice(`Configuration validation failed:\n${errors.join('\n')}`, 8000);
				return;
			}
		}

		// Save configuration
		if (this.plugin.preprocessingConfigManager) {
			this.plugin.preprocessingConfigManager.saveConfig(this.config);
		}

		// Add to custom configs if new
		if (this.isNewConfig) {
			this.plugin.settings.customPreprocessingConfigs.push(this.config);
		} else {
			// Update existing config in array
			const index = this.plugin.settings.customPreprocessingConfigs.findIndex(
				c => c.id === this.config.id
			);
			if (index !== -1) {
				this.plugin.settings.customPreprocessingConfigs[index] = this.config;
			}
		}

		// Save plugin settings
		await this.plugin.saveSettings();

		// Call onSave callback if provided
		if (this.onSave) {
			this.onSave(this.config);
		}

		// Show success message
		new Notice(`Configuration ${this.isNewConfig ? 'created' : 'updated'}: ${this.config.name}`);

		// Refresh settings display
		if (this.plugin.settingTab) {
			this.plugin.settingTab.display();
		}

		// Close modal
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
