/**
 * Configuration manager for preprocessing settings
 *
 * Manages preprocessing configurations including predefined presets and custom user configurations.
 * Handles configuration CRUD operations, validation, and default configuration management.
 *
 * @example
 * ```typescript
 * const configManager = new PreprocessingConfigManager();
 *
 * // Get all available configurations
 * const configs = configManager.getAllConfigs();
 *
 * // Get a specific configuration
 * const config = configManager.getConfig('preset-pocket-side-by-side');
 *
 * // Create a custom configuration
 * const customConfig = {
 *   id: 'custom-123',
 *   name: 'My Custom Config',
 *   description: 'Split into 3 pages horizontally',
 *   preset: NotebookPreset.CUSTOM,
 *   split: { enabled: true, direction: SplitDirection.HORIZONTAL, pageCount: 3 },
 *   rotation: { enabled: false, timing: RotationTiming.BEFORE_SPLIT }
 * };
 * configManager.saveConfig(customConfig);
 * ```
 */

import {
    PreprocessingConfig,
    NotebookPreset,
    PRESET_CONFIGS,
    RotationTiming
} from './preprocessing-types';

export class PreprocessingConfigManager {
    private configs: Map<string, PreprocessingConfig>;
    private defaultConfigId: string | null;

    /**
     * Creates a new PreprocessingConfigManager instance
     * Automatically initializes with predefined preset configurations
     */
    constructor() {
        this.configs = new Map();
        this.defaultConfigId = null;
        this.initializePresets();
    }

    /**
     * Initialize with predefined presets
     * Loads all preset configurations and sets single-page as the default
     * @private
     */
    private initializePresets(): void {
        Object.values(PRESET_CONFIGS).forEach(config => {
            this.configs.set(config.id, config);
        });
        // Set single-page as default
        this.defaultConfigId = PRESET_CONFIGS[NotebookPreset.SINGLE_PAGE].id;
    }

    /**
     * Get all available configurations
     * Returns both preset and custom configurations
     * @returns Array of all preprocessing configurations
     */
    getAllConfigs(): PreprocessingConfig[] {
        return Array.from(this.configs.values());
    }

    /**
     * Get configuration by ID
     * @param id - The unique identifier of the configuration
     * @returns The configuration if found, undefined otherwise
     */
    getConfig(id: string): PreprocessingConfig | undefined {
        return this.configs.get(id);
    }

    /**
     * Get default configuration
     * Returns the configuration set as default, or undefined if no default is set
     * @returns The default configuration if set, undefined otherwise
     */
    getDefaultConfig(): PreprocessingConfig | undefined {
        return this.defaultConfigId ? this.configs.get(this.defaultConfigId) : undefined;
    }

    /**
     * Set default configuration
     * Only sets the default if the configuration ID exists
     * @param id - The ID of the configuration to set as default
     */
    setDefaultConfig(id: string): void {
        if (this.configs.has(id)) {
            this.defaultConfigId = id;
        }
    }

    /**
     * Add or update custom configuration
     * If a configuration with the same ID exists, it will be updated
     * @param config - The configuration to save
     */
    saveConfig(config: PreprocessingConfig): void {
        this.configs.set(config.id, config);
    }

    /**
     * Delete custom configuration
     * Preset configurations cannot be deleted and will return false
     * @param id - The ID of the configuration to delete
     * @returns true if deleted successfully, false if not found or is a preset
     */
    deleteConfig(id: string): boolean {
        const config = this.configs.get(id);
        if (!config || config.preset !== NotebookPreset.CUSTOM) {
            return false;
        }
        return this.configs.delete(id);
    }

    /**
     * Duplicate configuration as custom
     * Creates a new custom configuration based on an existing one
     * The duplicate will have a new ID and be marked as CUSTOM preset
     * @param id - The ID of the configuration to duplicate
     * @param newName - The name for the duplicated configuration
     * @returns The new configuration if successful, null if original not found
     */
    duplicateConfig(id: string, newName: string): PreprocessingConfig | null {
        const original = this.configs.get(id);
        if (!original) {
            return null;
        }

        const duplicate: PreprocessingConfig = {
            ...original,
            id: `custom-${Date.now()}`,
            name: newName,
            preset: NotebookPreset.CUSTOM,
            split: { ...original.split },
            rotation: {
                ...original.rotation,
                perPageAngles: original.rotation.perPageAngles ? [...original.rotation.perPageAngles] : undefined
            }
        };

        this.saveConfig(duplicate);
        return duplicate;
    }

    /**
     * Validate configuration
     * Checks that configuration settings are valid and consistent
     * @param config - The configuration to validate
     * @returns Array of error messages (empty if valid)
     */
    validateConfig(config: PreprocessingConfig): string[] {
        const errors: string[] = [];

        if (config.split.enabled) {
            if (config.split.pageCount < 2 || config.split.pageCount > 4) {
                errors.push('Page count must be between 2 and 4');
            }
        }

        if (config.rotation.enabled) {
            if (config.rotation.timing === RotationTiming.AFTER_SPLIT && config.rotation.perPageAngles) {
                if (config.split.enabled && config.rotation.perPageAngles.length !== config.split.pageCount) {
                    errors.push('Per-page rotation angles must match page count');
                }
            }
        }

        return errors;
    }
}
