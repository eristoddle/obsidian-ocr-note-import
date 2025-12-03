import { App, Modal, Setting, Notice } from 'obsidian';
import { PreprocessingConfig } from './preprocessing-types';
import { PreprocessingPreviewModal } from './preprocessing-preview-modal';

/**
 * Type definition for the plugin interface needed by ConfigSelectionModal
 */
interface NotebookOCRPlugin {
	settings: {
		defaultPreprocessingConfigId: string | null;
		customPreprocessingConfigs: PreprocessingConfig[];
	};
	preprocessingConfigManager?: {
		getAllConfigs(): PreprocessingConfig[];
		getConfig(id: string): PreprocessingConfig | undefined;
	} | null;
}

/**
 * Configuration Selection Modal
 * Allows users to select a preprocessing configuration before processing an image
 */
export class ConfigSelectionModal extends Modal {
	private plugin: NotebookOCRPlugin;
	private onSelect: (configId: string | null, customSplitPositions?: number[]) => void;
	private imageData: ArrayBuffer | null;

	/**
	 * Creates a new configuration selection modal
	 * @param app - Obsidian app instance
	 * @param plugin - Plugin instance
	 * @param onSelect - Callback function called with selected config ID (null for no preprocessing) and optional custom split positions
	 * @param imageData - Optional image data for previewing
	 */
	constructor(
		app: App,
		plugin: NotebookOCRPlugin,
		onSelect: (configId: string | null, customSplitPositions?: number[]) => void,
		imageData: ArrayBuffer | null = null
	) {
		super(app);
		this.plugin = plugin;
		this.onSelect = onSelect;
		this.imageData = imageData;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select Preprocessing Configuration' });

		if (this.imageData) {
			contentEl.createEl('p', {
				text: 'Select a configuration to apply. You can preview the effect on the first image.',
				cls: 'setting-item-description'
			});
		}

		// Get all available configurations
		const configs = this.plugin.preprocessingConfigManager?.getAllConfigs() || [];
		const defaultId = this.plugin.settings.defaultPreprocessingConfigId;

		// No preprocessing option
		new Setting(contentEl)
			.setName('No Preprocessing')
			.setDesc('Process the image without any transformations (no splitting or rotation)')
			.addButton(button => button
				.setButtonText('Select')
				.onClick(() => {
					this.onSelect(null);
					this.close();
				}));

		// Available configurations section
		if (configs.length > 0) {
			contentEl.createEl('h3', { text: 'Available Configurations' });

			configs.forEach(config => {
				const isDefault = config.id === defaultId;
				const name = isDefault ? `${config.name} (Default)` : config.name;

				const setting = new Setting(contentEl)
					.setName(name)
					.setDesc(config.description || 'No description');

				// Apply bold styling to default configuration
				if (isDefault) {
					const nameEl = setting.nameEl;
					nameEl.style.fontWeight = 'bold';
				}

				// Add Preview button if image data is available
				if (this.imageData) {
					setting.addButton(button => button
						.setButtonText('Preview')
						.onClick(() => {
							this.openPreview(config);
						}));
				}

				// Add Select button
				setting.addButton(button => button
					.setButtonText('Select')
					.setCta()
					.onClick(() => {
						this.onSelect(config.id);
						this.close();
					}));
			});
		}
	}

	/**
	 * Open the preview modal for a specific configuration
	 */
	private openPreview(config: PreprocessingConfig) {
		if (!this.imageData) return;

		const previewModal = new PreprocessingPreviewModal(
			this.app,
			{
				imageData: this.imageData,
				config: config,
				mode: 'processing',
				onConfirm: (customSplitPositions) => {
					// When user confirms in preview, select this config and close selection modal
					this.onSelect(config.id, customSplitPositions);
					this.close();
				}
			}
		);
		previewModal.open();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
