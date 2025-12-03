/**
 * Property-based tests for PreprocessingConfigManager
 *
 * Feature: notebook-image-preprocessing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PreprocessingConfigManager } from './preprocessing-config-manager';
import {
    PreprocessingConfig,
    NotebookPreset,
    SplitDirection,
    RotationAngle,
    RotationTiming,
    PRESET_CONFIGS
} from './preprocessing-types';

describe('PreprocessingConfigManager', () => {
    let manager: PreprocessingConfigManager;

    beforeEach(() => {
        manager = new PreprocessingConfigManager();
    });

    /**
     * Feature: notebook-image-preprocessing, Property 1: Preset selection applies correct settings
     * Validates: Requirements 1.4
     *
     * For any notebook preset, when a user selects that preset, the applied configuration
     * should match the preset's defined split and rotation settings
     */
    it('Property 1: Preset selection applies correct settings', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(NotebookPreset)),
                (preset) => {
                    // Get the preset configuration from PRESET_CONFIGS
                    const expectedConfig = PRESET_CONFIGS[preset];

                    // Get the configuration from the manager
                    const actualConfig = manager.getConfig(expectedConfig.id);

                    // Verify the configuration exists
                    expect(actualConfig).toBeDefined();

                    if (actualConfig) {
                        // Verify all settings match
                        expect(actualConfig.id).toBe(expectedConfig.id);
                        expect(actualConfig.name).toBe(expectedConfig.name);
                        expect(actualConfig.preset).toBe(expectedConfig.preset);

                        // Verify split settings
                        expect(actualConfig.split.enabled).toBe(expectedConfig.split.enabled);
                        expect(actualConfig.split.direction).toBe(expectedConfig.split.direction);
                        expect(actualConfig.split.pageCount).toBe(expectedConfig.split.pageCount);

                        // Verify rotation settings
                        expect(actualConfig.rotation.enabled).toBe(expectedConfig.rotation.enabled);
                        expect(actualConfig.rotation.timing).toBe(expectedConfig.rotation.timing);
                        expect(actualConfig.rotation.wholeImageAngle).toBe(expectedConfig.rotation.wholeImageAngle);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: notebook-image-preprocessing, Property 2: Page count validation
     * Validates: Requirements 2.4
     *
     * For any page count value, validation should succeed if and only if
     * the value is between 2 and 4 (inclusive)
     */
    it('Property 2: Page count validation', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -10, max: 20 }),
                fc.constantFrom(SplitDirection.HORIZONTAL, SplitDirection.VERTICAL),
                (pageCount, direction) => {
                    const config: PreprocessingConfig = {
                        id: 'test-config',
                        name: 'Test Config',
                        description: 'Test',
                        preset: NotebookPreset.CUSTOM,
                        split: {
                            enabled: true,
                            direction: direction,
                            pageCount: pageCount
                        },
                        rotation: {
                            enabled: false,
                            timing: RotationTiming.BEFORE_SPLIT
                        }
                    };

                    const errors = manager.validateConfig(config);
                    const hasPageCountError = errors.some(e => e.includes('Page count must be between 2 and 4'));

                    // Validation should fail if and only if pageCount is not in [2, 4]
                    const shouldBeValid = pageCount >= 2 && pageCount <= 4;
                    expect(hasPageCountError).toBe(!shouldBeValid);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: notebook-image-preprocessing, Property 3: Configuration persistence round-trip
     * Validates: Requirements 2.5, 3.5
     *
     * For any custom preprocessing configuration, saving it and then retrieving it
     * should return an equivalent configuration with the same settings
     */
    it('Property 3: Configuration persistence round-trip', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 100 }),
                fc.boolean(),
                fc.constantFrom(SplitDirection.HORIZONTAL, SplitDirection.VERTICAL),
                fc.integer({ min: 2, max: 4 }),
                fc.boolean(),
                fc.constantFrom(RotationTiming.BEFORE_SPLIT, RotationTiming.AFTER_SPLIT),
                fc.constantFrom(
                    RotationAngle.NONE,
                    RotationAngle.CLOCKWISE_90,
                    RotationAngle.CLOCKWISE_180,
                    RotationAngle.CLOCKWISE_270
                ),
                (name, description, splitEnabled, splitDirection, pageCount, rotationEnabled, rotationTiming, rotationAngle) => {
                    const configId = `custom-test-${Date.now()}-${Math.random()}`;

                    const originalConfig: PreprocessingConfig = {
                        id: configId,
                        name: name,
                        description: description,
                        preset: NotebookPreset.CUSTOM,
                        split: {
                            enabled: splitEnabled,
                            direction: splitDirection,
                            pageCount: pageCount
                        },
                        rotation: {
                            enabled: rotationEnabled,
                            timing: rotationTiming,
                            wholeImageAngle: rotationTiming === RotationTiming.BEFORE_SPLIT ? rotationAngle : undefined,
                            perPageAngles: rotationTiming === RotationTiming.AFTER_SPLIT ?
                                Array(pageCount).fill(rotationAngle) as RotationAngle[] : undefined
                        }
                    };

                    // Save the configuration
                    manager.saveConfig(originalConfig);

                    // Retrieve the configuration
                    const retrievedConfig = manager.getConfig(configId);

                    // Verify it exists and matches
                    expect(retrievedConfig).toBeDefined();

                    if (retrievedConfig) {
                        expect(retrievedConfig.id).toBe(originalConfig.id);
                        expect(retrievedConfig.name).toBe(originalConfig.name);
                        expect(retrievedConfig.description).toBe(originalConfig.description);
                        expect(retrievedConfig.preset).toBe(originalConfig.preset);

                        expect(retrievedConfig.split.enabled).toBe(originalConfig.split.enabled);
                        expect(retrievedConfig.split.direction).toBe(originalConfig.split.direction);
                        expect(retrievedConfig.split.pageCount).toBe(originalConfig.split.pageCount);

                        expect(retrievedConfig.rotation.enabled).toBe(originalConfig.rotation.enabled);
                        expect(retrievedConfig.rotation.timing).toBe(originalConfig.rotation.timing);
                        expect(retrievedConfig.rotation.wholeImageAngle).toBe(originalConfig.rotation.wholeImageAngle);

                        if (originalConfig.rotation.perPageAngles) {
                            expect(retrievedConfig.rotation.perPageAngles).toEqual(originalConfig.rotation.perPageAngles);
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: notebook-image-preprocessing, Property 4: Default configuration retrieval
     * Validates: Requirements 6.3
     *
     * For any configuration set as default, retrieving the default configuration
     * should return that same configuration
     */
    it('Property 4: Default configuration retrieval', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(NotebookPreset)),
                (preset) => {
                    const presetConfig = PRESET_CONFIGS[preset];

                    // Set this preset as default
                    manager.setDefaultConfig(presetConfig.id);

                    // Retrieve the default configuration
                    const defaultConfig = manager.getDefaultConfig();

                    // Verify it matches the preset we set
                    expect(defaultConfig).toBeDefined();
                    if (defaultConfig) {
                        expect(defaultConfig.id).toBe(presetConfig.id);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: notebook-image-preprocessing, Property 5: Custom configuration deletion
     * Validates: Requirements 6.4
     *
     * For any custom configuration (non-preset), deleting it should remove it from
     * the saved configurations, and for any preset configuration, deletion should fail
     */
    it('Property 5: Custom configuration deletion', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(NotebookPreset)),
                fc.string({ minLength: 1, maxLength: 50 }),
                (preset, customName) => {
                    if (preset === NotebookPreset.CUSTOM) {
                        // Test custom configuration deletion
                        const customConfig: PreprocessingConfig = {
                            id: `custom-test-${Date.now()}-${Math.random()}`,
                            name: customName,
                            description: 'Test custom config',
                            preset: NotebookPreset.CUSTOM,
                            split: {
                                enabled: false,
                                direction: SplitDirection.HORIZONTAL,
                                pageCount: 2
                            },
                            rotation: {
                                enabled: false,
                                timing: RotationTiming.BEFORE_SPLIT
                            }
                        };

                        // Save the custom configuration
                        manager.saveConfig(customConfig);

                        // Verify it exists
                        expect(manager.getConfig(customConfig.id)).toBeDefined();

                        // Delete it
                        const deleteResult = manager.deleteConfig(customConfig.id);

                        // Deletion should succeed
                        expect(deleteResult).toBe(true);

                        // Configuration should no longer exist
                        expect(manager.getConfig(customConfig.id)).toBeUndefined();
                    } else {
                        // Test preset configuration deletion (should fail)
                        const presetConfig = PRESET_CONFIGS[preset];

                        // Verify preset exists
                        expect(manager.getConfig(presetConfig.id)).toBeDefined();

                        // Attempt to delete preset
                        const deleteResult = manager.deleteConfig(presetConfig.id);

                        // Deletion should fail
                        expect(deleteResult).toBe(false);

                        // Preset should still exist
                        expect(manager.getConfig(presetConfig.id)).toBeDefined();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: notebook-image-preprocessing, Property 6: Configuration duplication creates independent copy
     * Validates: Requirements 6.5
     *
     * For any configuration, duplicating it should create a new configuration with the same settings
     * but a different ID, and modifying the duplicate should not affect the original
     */
    it('Property 6: Configuration duplication creates independent copy', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.values(NotebookPreset)),
                fc.string({ minLength: 1, maxLength: 50 }),
                (preset, newName) => {
                    const originalConfig = PRESET_CONFIGS[preset];

                    // Duplicate the configuration
                    const duplicate = manager.duplicateConfig(originalConfig.id, newName);

                    // Verify duplicate was created
                    expect(duplicate).not.toBeNull();

                    if (duplicate) {
                        // Verify it has a different ID
                        expect(duplicate.id).not.toBe(originalConfig.id);

                        // Verify it has the new name
                        expect(duplicate.name).toBe(newName);

                        // Verify it's marked as custom
                        expect(duplicate.preset).toBe(NotebookPreset.CUSTOM);

                        // Verify settings match original
                        expect(duplicate.split.enabled).toBe(originalConfig.split.enabled);
                        expect(duplicate.split.direction).toBe(originalConfig.split.direction);
                        expect(duplicate.split.pageCount).toBe(originalConfig.split.pageCount);

                        expect(duplicate.rotation.enabled).toBe(originalConfig.rotation.enabled);
                        expect(duplicate.rotation.timing).toBe(originalConfig.rotation.timing);

                        // Modify the duplicate
                        duplicate.split.enabled = !duplicate.split.enabled;
                        manager.saveConfig(duplicate);

                        // Verify original is unchanged
                        const originalAfterModification = manager.getConfig(originalConfig.id);
                        expect(originalAfterModification).toBeDefined();
                        if (originalAfterModification) {
                            expect(originalAfterModification.split.enabled).toBe(originalConfig.split.enabled);
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    describe('Preset ID Migration', () => {
        /**
         * Test migration from preset-pocket-side-by-side to preset-split-vertically
         */
        it('should migrate preset-pocket-side-by-side to preset-split-vertically', () => {
            const oldId = 'preset-pocket-side-by-side';
            const expectedNewId = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY].id;

            const migratedId = manager.migratePresetId(oldId);

            expect(migratedId).toBe(expectedNewId);
        });

        /**
         * Test migration from preset-a5-landscape to preset-rotate-90-clockwise
         */
        it('should migrate preset-a5-landscape to preset-rotate-90-clockwise', () => {
            const oldId = 'preset-a5-landscape';
            const expectedNewId = PRESET_CONFIGS[NotebookPreset.ROTATE_90_CLOCKWISE].id;

            const migratedId = manager.migratePresetId(oldId);

            expect(migratedId).toBe(expectedNewId);
        });

        /**
         * Test removal of preset-single-page (maps to no-preprocessing)
         */
        it('should migrate preset-single-page to preset-no-preprocessing', () => {
            const oldId = 'preset-single-page';
            const expectedNewId = PRESET_CONFIGS[NotebookPreset.NO_PREPROCESSING].id;

            const migratedId = manager.migratePresetId(oldId);

            expect(migratedId).toBe(expectedNewId);
        });

        /**
         * Test removal of preset-a5-portrait (maps to no-preprocessing)
         */
        it('should migrate preset-a5-portrait to preset-no-preprocessing', () => {
            const oldId = 'preset-a5-portrait';
            const expectedNewId = PRESET_CONFIGS[NotebookPreset.NO_PREPROCESSING].id;

            const migratedId = manager.migratePresetId(oldId);

            expect(migratedId).toBe(expectedNewId);
        });

        /**
         * Test fallback to default when no mapping exists
         */
        it('should fallback to default preset when no mapping exists', () => {
            const unknownId = 'preset-unknown-old-preset';
            const expectedDefaultId = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY].id;

            const migratedId = manager.migratePresetId(unknownId);

            expect(migratedId).toBe(expectedDefaultId);
        });

        /**
         * Test that current preset IDs are not changed
         */
        it('should not change current preset IDs', () => {
            const currentId = PRESET_CONFIGS[NotebookPreset.TOP_SPIRAL_NOTEBOOK].id;

            const migratedId = manager.migratePresetId(currentId);

            expect(migratedId).toBe(currentId);
        });

        /**
         * Test setDefaultConfigWithMigration with old preset ID
         */
        it('should migrate and set default config with old preset ID', () => {
            const oldId = 'preset-pocket-side-by-side';
            const expectedNewId = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY].id;

            const resultId = manager.setDefaultConfigWithMigration(oldId);

            expect(resultId).toBe(expectedNewId);
            expect(manager.getDefaultConfig()?.id).toBe(expectedNewId);
        });

        /**
         * Test setDefaultConfigWithMigration with null
         */
        it('should use default preset when null is provided', () => {
            const expectedDefaultId = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY].id;

            const resultId = manager.setDefaultConfigWithMigration(null);

            expect(resultId).toBe(expectedDefaultId);
            expect(manager.getDefaultConfig()?.id).toBe(expectedDefaultId);
        });

        /**
         * Test setDefaultConfigWithMigration with current preset ID
         */
        it('should not change current preset IDs when setting default', () => {
            const currentId = PRESET_CONFIGS[NotebookPreset.ROTATE_90_COUNTERCLOCKWISE].id;

            const resultId = manager.setDefaultConfigWithMigration(currentId);

            expect(resultId).toBe(currentId);
            expect(manager.getDefaultConfig()?.id).toBe(currentId);
        });
    });
});
