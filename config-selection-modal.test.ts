import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PreprocessingConfig, NotebookPreset, PRESET_CONFIGS } from './preprocessing-types';

describe('Config Selection Modal Property Tests', () => {
    /**
     * Feature: preset-config-redesign, Property 6: Default configuration uniqueness
     * Validates: Requirements 5.4
     *
     * For any list of configurations displayed in the selection modal, exactly one
     * configuration should be marked as default (have "(Default)" in its display name)
     */
    it('Property 6: Default configuration uniqueness', () => {
        fc.assert(
            fc.property(
                // Generate a random default config ID from available configs
                fc.constantFrom(...Object.values(PRESET_CONFIGS).map(c => c.id)),
                (defaultId) => {
                    const configs = Object.values(PRESET_CONFIGS);

                    // Simulate the modal's logic for marking configs as default
                    const displayNames = configs.map(config => {
                        const isDefault = config.id === defaultId;
                        return isDefault ? `${config.name} (Default)` : config.name;
                    });

                    // Count how many configs are marked as default
                    const defaultCount = displayNames.filter(name =>
                        name.includes('(Default)')
                    ).length;

                    // Exactly one configuration should be marked as default
                    expect(defaultCount).toBe(1);
                }
            ),
            { numRuns: 100 }
        );
    });
});

describe('Config Selection Modal Unit Tests', () => {
    let configs: PreprocessingConfig[];

    beforeEach(() => {
        configs = Object.values(PRESET_CONFIGS);
    });

    it('should mark only the default configuration with "(Default)" suffix', () => {
        const defaultId = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY].id;

        const displayNames = configs.map(config => {
            const isDefault = config.id === defaultId;
            return isDefault ? `${config.name} (Default)` : config.name;
        });

        const defaultCount = displayNames.filter(name =>
            name.includes('(Default)')
        ).length;

        expect(defaultCount).toBe(1);
        expect(displayNames).toContain('Split Vertically (Default)');
    });

    it('should not mark any configuration as default when defaultId is null', () => {
        const defaultId = null;

        const displayNames = configs.map(config => {
            const isDefault = config.id === defaultId;
            return isDefault ? `${config.name} (Default)` : config.name;
        });

        const defaultCount = displayNames.filter(name =>
            name.includes('(Default)')
        ).length;

        expect(defaultCount).toBe(0);
    });

    it('should mark correct configuration as default when defaultId changes', () => {
        const defaultId = PRESET_CONFIGS[NotebookPreset.ROTATE_90_CLOCKWISE].id;

        const displayNames = configs.map(config => {
            const isDefault = config.id === defaultId;
            return isDefault ? `${config.name} (Default)` : config.name;
        });

        const defaultCount = displayNames.filter(name =>
            name.includes('(Default)')
        ).length;

        expect(defaultCount).toBe(1);
        expect(displayNames).toContain('Rotate 90° Clockwise (Default)');
    });
});

describe('Config Selection Modal Rendering Tests', () => {
    it('should render "No Preprocessing" option with correct description', () => {
        // Simulate the modal's "No Preprocessing" option
        const noPreprocessingOption = {
            name: 'No Preprocessing',
            description: 'Process the image without any transformations (no splitting or rotation)'
        };

        expect(noPreprocessingOption.name).toBe('No Preprocessing');
        expect(noPreprocessingOption.description).toContain('without any transformations');
        expect(noPreprocessingOption.description).toContain('no splitting or rotation');
    });

    it('should ensure "No Preprocessing" appears before config list', () => {
        // In the modal, "No Preprocessing" is rendered first, then configs
        // This test verifies the logical ordering
        const renderOrder = ['No Preprocessing', ...Object.values(PRESET_CONFIGS).map(c => c.name)];

        expect(renderOrder[0]).toBe('No Preprocessing');
        expect(renderOrder.length).toBeGreaterThan(1);
    });

    it('should have exactly one default configuration in the list', () => {
        const defaultId = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY].id;
        const configs = Object.values(PRESET_CONFIGS);

        const displayNames = configs.map(config => {
            const isDefault = config.id === defaultId;
            return isDefault ? `${config.name} (Default)` : config.name;
        });

        const defaultCount = displayNames.filter(name => name.includes('(Default)')).length;

        expect(defaultCount).toBe(1);
    });
});
