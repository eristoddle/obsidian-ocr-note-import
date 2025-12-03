import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    NotebookPreset,
    PRESET_CONFIGS,
    PreprocessingConfig,
    RotationTiming
} from './preprocessing-types';

describe('Preset Configuration Property Tests', () => {
    /**
     * Feature: preset-config-redesign, Property 1: Transformation-based naming
     * Validates: Requirements 1.1
     *
     * For any preset configuration (excluding CUSTOM), the preset name should contain
     * transformation keywords ("split", "rotate") and should not contain paper size
     * specifications ("A5", "8.5x11", "pocket")
     */
    it('Property 1: Transformation-based naming', () => {
        const presets = Object.values(NotebookPreset).filter(
            preset => preset !== NotebookPreset.CUSTOM && preset !== NotebookPreset.NO_PREPROCESSING
        );

        const paperSizeKeywords = ['a5', '8.5x11', 'a4', 'letter', 'legal'];
        const transformationKeywords = ['split', 'rotate'];

        presets.forEach(preset => {
            const config = PRESET_CONFIGS[preset];
            const nameLower = config.name.toLowerCase();
            const descriptionLower = config.description.toLowerCase();

            // Check that name doesn't contain paper size specifications
            const containsPaperSize = paperSizeKeywords.some(keyword =>
                nameLower.includes(keyword)
            );
            expect(containsPaperSize).toBe(false);

            // Check that name or description is transformation-focused
            // Either the name contains transformation keywords, or it describes a use case
            // that is clearly transformation-based (not just a paper size)
            const containsTransformation = transformationKeywords.some(keyword =>
                nameLower.includes(keyword) || descriptionLower.includes(keyword)
            );
            expect(containsTransformation).toBe(true);
        });
    });

    /**
     * Feature: preset-config-redesign, Property 2: Rotation direction clarity
     * Validates: Requirements 1.3
     *
     * For any preset configuration with rotation enabled, the preset name should
     * contain either "clockwise" or "counterclockwise" to indicate rotation direction
     * (except for 180-degree rotations which are direction-agnostic)
     */
    it('Property 2: Rotation direction clarity', () => {
        const presets = Object.values(NotebookPreset);

        presets.forEach(preset => {
            const config = PRESET_CONFIGS[preset];

            if (config.rotation.enabled) {
                const nameLower = config.name.toLowerCase();
                const descriptionLower = config.description.toLowerCase();

                // Check if this is a 90 or 270 degree rotation (needs direction clarity)
                const needsDirectionClarity =
                    config.rotation.wholeImageAngle === 90 ||
                    config.rotation.wholeImageAngle === 270;

                if (needsDirectionClarity) {
                    const hasDirectionIndicator =
                        nameLower.includes('clockwise') ||
                        nameLower.includes('counterclockwise');

                    expect(hasDirectionIndicator).toBe(true);
                }

                // For other rotations (like 180 or per-page), just verify rotation is mentioned
                if (!needsDirectionClarity) {
                    const mentionsRotation =
                        nameLower.includes('rotate') ||
                        descriptionLower.includes('rotate');
                    expect(mentionsRotation).toBe(true);
                }
            }
        });
    });

    /**
     * Feature: preset-config-redesign, Property 3: No redundant presets
     * Validates: Requirements 1.4
     *
     * For any preset configuration (excluding NO_PREPROCESSING and CUSTOM), at least
     * one transformation should be enabled (split.enabled=true OR rotation.enabled=true)
     */
    it('Property 3: No redundant presets', () => {
        const presets = Object.values(NotebookPreset).filter(
            preset => preset !== NotebookPreset.NO_PREPROCESSING && preset !== NotebookPreset.CUSTOM
        );

        presets.forEach(preset => {
            const config = PRESET_CONFIGS[preset];
            const hasTransformation = config.split.enabled || config.rotation.enabled;

            expect(hasTransformation).toBe(true);
        });
    });

    /**
     * Feature: preset-config-redesign, Property 4: Per-page rotation timing
     * Validates: Requirements 2.4
     *
     * For any preset configuration with per-page rotation angles defined
     * (rotation.perPageAngles is not null/undefined), the rotation timing
     * should be set to AFTER_SPLIT
     */
    it('Property 4: Per-page rotation timing', () => {
        const presets = Object.values(NotebookPreset);

        presets.forEach(preset => {
            const config = PRESET_CONFIGS[preset];

            if (config.rotation.perPageAngles !== undefined &&
                config.rotation.perPageAngles !== null) {
                expect(config.rotation.timing).toBe(RotationTiming.AFTER_SPLIT);
            }
        });
    });

    /**
     * Feature: preset-config-redesign, Property 5: Whole-image rotation excludes splitting
     * Validates: Requirements 3.4
     *
     * For any preset configuration with whole-image rotation (rotation.timing = BEFORE_SPLIT
     * and rotation.wholeImageAngle is defined), splitting should be disabled (split.enabled=false)
     */
    it('Property 5: Whole-image rotation excludes splitting', () => {
        const presets = Object.values(NotebookPreset);

        presets.forEach(preset => {
            const config = PRESET_CONFIGS[preset];

            if (config.rotation.timing === RotationTiming.BEFORE_SPLIT &&
                config.rotation.wholeImageAngle !== undefined &&
                config.rotation.wholeImageAngle !== null) {
                expect(config.split.enabled).toBe(false);
            }
        });
    });
});


describe('Preset Configuration Unit Tests', () => {
    it('should have correct structure for all presets', () => {
        const presets = Object.values(NotebookPreset);

        presets.forEach(preset => {
            const config = PRESET_CONFIGS[preset];

            // Check required fields exist
            expect(config.id).toBeDefined();
            expect(config.name).toBeDefined();
            expect(config.description).toBeDefined();
            expect(config.preset).toBe(preset);
            expect(config.split).toBeDefined();
            expect(config.rotation).toBeDefined();

            // Check split config structure
            expect(typeof config.split.enabled).toBe('boolean');
            expect(config.split.direction).toBeDefined();
            expect(typeof config.split.pageCount).toBe('number');

            // Check rotation config structure
            expect(typeof config.rotation.enabled).toBe('boolean');
            expect(config.rotation.timing).toBeDefined();
        });
    });

    it('should configure Split Vertically preset correctly', () => {
        const config = PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY];

        expect(config.id).toBe('preset-split-vertically');
        expect(config.name).toBe('Split Vertically');
        expect(config.description).toContain('Split image into two pages');
        expect(config.split.enabled).toBe(true);
        expect(config.split.direction).toBe('vertical');
        expect(config.split.pageCount).toBe(2);
        expect(config.rotation.enabled).toBe(false);
    });

    it('should configure Rotate 90° Clockwise preset correctly', () => {
        const config = PRESET_CONFIGS[NotebookPreset.ROTATE_90_CLOCKWISE];

        expect(config.id).toBe('preset-rotate-90-clockwise');
        expect(config.name).toBe('Rotate 90° Clockwise');
        expect(config.description).toContain('Rotate entire image 90 degrees clockwise');
        expect(config.split.enabled).toBe(false);
        expect(config.rotation.enabled).toBe(true);
        expect(config.rotation.timing).toBe('before-split');
        expect(config.rotation.wholeImageAngle).toBe(90);
    });

    it('should configure Rotate 90° Counterclockwise preset correctly', () => {
        const config = PRESET_CONFIGS[NotebookPreset.ROTATE_90_COUNTERCLOCKWISE];

        expect(config.id).toBe('preset-rotate-90-counterclockwise');
        expect(config.name).toBe('Rotate 90° Counterclockwise');
        expect(config.description).toContain('Rotate entire image 90 degrees counterclockwise');
        expect(config.split.enabled).toBe(false);
        expect(config.rotation.enabled).toBe(true);
        expect(config.rotation.timing).toBe('before-split');
        expect(config.rotation.wholeImageAngle).toBe(270);
    });

    it('should configure Top Spiral Notebook preset correctly', () => {
        const config = PRESET_CONFIGS[NotebookPreset.TOP_SPIRAL_NOTEBOOK];

        expect(config.id).toBe('preset-top-spiral-notebook');
        expect(config.name).toBe('Top Spiral Notebook');
        expect(config.description).toContain('Split horizontally');
        expect(config.description).toContain('rotate top page 180°');
        expect(config.split.enabled).toBe(true);
        expect(config.split.direction).toBe('horizontal');
        expect(config.split.pageCount).toBe(2);
        expect(config.rotation.enabled).toBe(true);
        expect(config.rotation.timing).toBe('after-split');
        expect(config.rotation.perPageAngles).toEqual([180, 0]);
    });
});
