import { App, Modal, Setting } from 'obsidian';
import { PreprocessingConfig } from './preprocessing-types';

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
	private onSelect: (configId: string | null) => void;

	/**
	 * Creates a new configuration selection modal
	 * @param app - Obsidian app instance
	 * @param plugin - Plugin instance
	 * @param onSelect - Callback function called with selected config ID (null for no preprocessing)
	 */
	constructor(
		app: App,
		plugin: NotebookOCRPlugin,
		onSelect: (configId: string | null) => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Select Preprocessing Configuration' });

		// Get all available configurations
		const configs = this.plugin.preprocessingConfigManager?.getAllConfigs() || [];
		const defaultId = this.plugin.settings.defaultPreprocessingConfigId;

		// No preprocessing option
		new Setting(contentEl)
			.setName('No Preprocessing')
			.setDesc('Process image without splitting or rotation')
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

				new Setting(contentEl)
					.setName(name)
					.setDesc(config.description || 'No description')
					.addButton(button => button
						.setButtonText('Select')
						.onClick(() => {
							this.onSelect(config.id);
							this.close();
						}));
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
