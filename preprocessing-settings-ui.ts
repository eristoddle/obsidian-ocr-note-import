import { App, Setting, Notice } from 'obsidian';
import { PreprocessingConfig, NotebookPreset, PRESET_CONFIGS, RotationTiming } from './preprocessing-types';
import { ConfigEditorModal } from './config-editor-modal';

/**
 * Type definition for the plugin interface needed by PreprocessingSettingsUI
 */
interface NotebookOCRPlugin {
	settings: {
		enablePreprocessing: boolean;
		defaultPreprocessingConfigId: string | null;
		customPreprocessingConfigs: PreprocessingConfig[];
		splitPageNoteMode: 'separate' | 'combined';
		splitPageSeparator: string;
		includePreprocessingMetadata: boolean;
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
 * Preprocessing Settings UI component
 * Handles rendering of notebook preprocessing settings in the settings tab
 */
export class PreprocessingSettingsUI {
	private app: App;
	private plugin: NotebookOCRPlugin;

	constructor(app: App, plugin: NotebookOCRPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Display preprocessing settings section
	 * Shows/hides preprocessing settings based on enable toggle
	 */
	display(containerEl: HTMLElement): void {
		// Enable/Disable Preprocessing Toggle
		new Setting(containerEl)
			.setName('Enable Notebook Preprocessing')
			.setDesc('Enable automatic image splitting and rotation for multi-page notebook scans')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePreprocessing)
				.onChange(async (value) => {
					this.plugin.settings.enablePreprocessing = value;
					await this.plugin.saveSettings();

					// Trigger a refresh to show/hide preprocessing settings
					if (this.plugin.settingTab) {
						this.plugin.settingTab.display();
					}
				}));

		// Show preprocessing settings only if enabled
		if (this.plugin.settings.enablePreprocessing) {
			this.displayDefaultConfigSelection(containerEl);
			this.displayPresetConfigurations(containerEl);
			this.displayCustomConfigurations(containerEl);
			this.displayNoteCreationSettings(containerEl);
		}
	}

	/**
	 * Display default configuration selection dropdown
	 */
	private displayDefaultConfigSelection(containerEl: HTMLElement): void {
		if (!this.plugin.preprocessingConfigManager) {
			return;
		}

		const configs = this.plugin.preprocessingConfigManager.getAllConfigs();

		new Setting(containerEl)
			.setName('Default Configuration')
			.setDesc('Select the default preprocessing configuration to use when processing images')
			.addDropdown(dropdown => {
				// Populate dropdown with all available configurations
				configs.forEach(config => {
					dropdown.addOption(config.id, config.name);
				});

				dropdown
					.setValue(this.plugin.settings.defaultPreprocessingConfigId || 'preset-single-page')
					.onChange(async (value) => {
						this.plugin.settings.defaultPreprocessingConfigId = value;
						await this.plugin.saveSettings();

						// Update config manager
						if (this.plugin.preprocessingConfigManager) {
							this.plugin.preprocessingConfigManager.setDefaultConfig(value);
						}
					});
			});
	}

	/**
	 * Display preset configurations section
	 */
	private displayPresetConfigurations(containerEl: HTMLElement): void {
		// Section heading
		containerEl.createEl('h4', { text: 'Preset Configurations' });

		const presetsHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		presetsHelpDiv.style.marginBottom = '15px';
		presetsHelpDiv.innerHTML = `
			Predefined configurations for common notebook formats. These presets cannot be edited or deleted.
		`;

		// Display each preset
		const presetKeys = [
			NotebookPreset.SINGLE_PAGE,
			NotebookPreset.POCKET_SIDE_BY_SIDE,
			NotebookPreset.A5_PORTRAIT,
			NotebookPreset.A5_LANDSCAPE
		];

		presetKeys.forEach(presetKey => {
			const config = PRESET_CONFIGS[presetKey];
			this.displayConfigurationItem(containerEl, config, true);
		});
	}

	/**
	 * Display custom configurations section
	 */
	private displayCustomConfigurations(containerEl: HTMLElement): void {
		// Section heading
		containerEl.createEl('h4', { text: 'Custom Configurations' });

		const customHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		customHelpDiv.style.marginBottom = '15px';
		customHelpDiv.innerHTML = `
			Create custom configurations for non-standard notebook formats or scanning setups.
		`;

		// Add create configuration button
		new Setting(containerEl)
			.setName('Create Custom Configuration')
			.setDesc('Create a new custom preprocessing configuration')
			.addButton(button => button
				.setButtonText('Create Configuration')
				.setCta()
				.onClick(() => {
					const modal = new ConfigEditorModal(this.app, this.plugin);
					modal.open();
				}));

		// Display custom configurations
		const customConfigs = this.plugin.settings.customPreprocessingConfigs || [];

		if (customConfigs.length === 0) {
			const noCustomDiv = containerEl.createDiv({ cls: 'setting-item-description' });
			noCustomDiv.style.padding = '15px';
			noCustomDiv.style.backgroundColor = 'var(--background-secondary)';
			noCustomDiv.style.borderRadius = '5px';
			noCustomDiv.style.textAlign = 'center';
			noCustomDiv.innerHTML = `
				<p><strong>No custom configurations yet.</strong></p>
				<p>Click "Create Configuration" above to create your first custom configuration.</p>
			`;
		} else {
			customConfigs.forEach(config => {
				this.displayConfigurationItem(containerEl, config, false);
			});
		}
	}

	/**
	 * Display a single configuration item (preset or custom)
	 */
	private displayConfigurationItem(containerEl: HTMLElement, config: PreprocessingConfig, isPreset: boolean): void {
		const configItem = containerEl.createDiv({ cls: 'notebook-ocr-config-item' });
		configItem.style.padding = '10px';
		configItem.style.border = '1px solid var(--background-modifier-border)';
		configItem.style.borderRadius = '5px';
		configItem.style.marginBottom = '10px';

		// Config info container
		const configInfo = configItem.createDiv({ cls: 'notebook-ocr-config-info' });

		// Config name
		const configName = configInfo.createDiv({ cls: 'notebook-ocr-config-name' });
		configName.textContent = config.name;
		configName.style.fontWeight = '500';
		configName.style.marginBottom = '4px';

		// Config description
		const configDesc = configInfo.createDiv({ cls: 'notebook-ocr-config-description' });
		configDesc.textContent = config.description;
		configDesc.style.fontSize = '0.9em';
		configDesc.style.color = 'var(--text-muted)';
		configDesc.style.marginBottom = '8px';

		// Config details
		const configDetails = configInfo.createDiv({ cls: 'notebook-ocr-config-details' });
		configDetails.style.fontSize = '0.85em';
		configDetails.style.color = 'var(--text-muted)';
		configDetails.style.fontFamily = 'monospace';

		const details: string[] = [];

		// Split settings
		if (config.split.enabled) {
			details.push(`Split: ${config.split.direction} into ${config.split.pageCount} pages`);
		} else {
			details.push('Split: disabled');
		}

		// Rotation settings
		if (config.rotation.enabled) {
			if (config.rotation.timing === RotationTiming.BEFORE_SPLIT && config.rotation.wholeImageAngle) {
				details.push(`Rotation: ${config.rotation.wholeImageAngle}° before split`);
			} else if (config.rotation.timing === RotationTiming.AFTER_SPLIT && config.rotation.perPageAngles) {
				details.push(`Rotation: per-page after split`);
			}
		} else {
			details.push('Rotation: disabled');
		}

		configDetails.textContent = details.join(' | ');

		// Actions container (only for custom configs)
		if (!isPreset) {
			const actionsContainer = configItem.createDiv({ cls: 'notebook-ocr-config-actions' });
			actionsContainer.style.display = 'flex';
			actionsContainer.style.gap = '5px';
			actionsContainer.style.marginTop = '10px';

			// Edit button
			const editButton = actionsContainer.createEl('button', { text: 'Edit' });
			editButton.style.padding = '4px 8px';
			editButton.addEventListener('click', () => {
				const modal = new ConfigEditorModal(this.app, this.plugin, config);
				modal.open();
			});

			// Duplicate button
			const duplicateButton = actionsContainer.createEl('button', { text: 'Duplicate' });
			duplicateButton.style.padding = '4px 8px';
			duplicateButton.addEventListener('click', async () => {
				if (!this.plugin.preprocessingConfigManager) {
					return;
				}

				const newName = `${config.name} (Copy)`;
				const duplicated = this.plugin.preprocessingConfigManager.duplicateConfig(config.id, newName);

				if (duplicated) {
					// Add to custom configs
					this.plugin.settings.customPreprocessingConfigs.push(duplicated);
					await this.plugin.saveSettings();

					new Notice(`Configuration duplicated: ${newName}`);

					// Refresh display
					if (this.plugin.settingTab) {
						this.plugin.settingTab.display();
					}
				} else {
					new Notice('Failed to duplicate configuration');
				}
			});

			// Delete button
			const deleteButton = actionsContainer.createEl('button', { text: 'Delete' });
			deleteButton.style.padding = '4px 8px';
			deleteButton.style.color = 'var(--text-error)';
			deleteButton.addEventListener('click', async () => {
				if (confirm(`Are you sure you want to delete the configuration "${config.name}"?`)) {
					if (!this.plugin.preprocessingConfigManager) {
						return;
					}

					const deleted = this.plugin.preprocessingConfigManager.deleteConfig(config.id);

					if (deleted) {
						// Remove from custom configs
						this.plugin.settings.customPreprocessingConfigs =
							this.plugin.settings.customPreprocessingConfigs.filter(c => c.id !== config.id);
						await this.plugin.saveSettings();

						new Notice(`Configuration deleted: ${config.name}`);

						// Refresh display
						if (this.plugin.settingTab) {
							this.plugin.settingTab.display();
						}
					} else {
						new Notice('Failed to delete configuration (presets cannot be deleted)');
					}
				}
			});
		}
	}

	/**
	 * Display note creation settings for split pages
	 */
	private displayNoteCreationSettings(containerEl: HTMLElement): void {
		// Section heading
		containerEl.createEl('h4', { text: 'Note Creation Settings' });

		const noteHelpDiv = containerEl.createDiv({ cls: 'setting-item-description' });
		noteHelpDiv.style.marginBottom = '15px';
		noteHelpDiv.innerHTML = `
			Configure how split pages are converted into notes.
		`;

		// Split page note mode
		new Setting(containerEl)
			.setName('Split Page Note Mode')
			.setDesc('How to create notes from split pages: separate notes for each page or combine all pages into one note')
			.addDropdown(dropdown => dropdown
				.addOption('separate', 'Separate Notes (one per page)')
				.addOption('combined', 'Combined Note (all pages together)')
				.setValue(this.plugin.settings.splitPageNoteMode)
				.onChange(async (value) => {
					this.plugin.settings.splitPageNoteMode = value as 'separate' | 'combined';
					await this.plugin.saveSettings();

					// Trigger a refresh to show/hide separator setting
					if (this.plugin.settingTab) {
						this.plugin.settingTab.display();
					}
				}));

		// Page separator (only shown for combined mode)
		if (this.plugin.settings.splitPageNoteMode === 'combined') {
			new Setting(containerEl)
				.setName('Page Separator')
				.setDesc('Text to insert between pages in combined notes')
				.addText(text => text
					.setPlaceholder('\\n\\n---\\n\\n')
					.setValue(this.plugin.settings.splitPageSeparator)
					.onChange(async (value) => {
						this.plugin.settings.splitPageSeparator = value;
						await this.plugin.saveSettings();
					}));
		}

		// Include preprocessing metadata
		new Setting(containerEl)
			.setName('Include Preprocessing Metadata')
			.setDesc('Add preprocessing configuration details to note frontmatter')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includePreprocessingMetadata)
				.onChange(async (value) => {
					this.plugin.settings.includePreprocessingMetadata = value;
					await this.plugin.saveSettings();
				}));
	}
}
