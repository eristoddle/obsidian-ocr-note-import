/**
 * Main preprocessing manager for orchestrating image transformations
 *
 * Coordinates the preprocessing workflow by applying transformations in the correct order:
 * 1. Rotation before split (if configured)
 * 2. Image splitting (if configured)
 * 3. Rotation after split (if configured)
 *
 * Handles errors gracefully with fallback behavior for rotation failures.
 *
 * @example
 * ```typescript
 * const configManager = new PreprocessingConfigManager();
 * const preprocessingManager = new PreprocessingManager(configManager);
 *
 * // Preprocess with default configuration
 * const result = await preprocessingManager.preprocess(imageData);
 *
 * // Preprocess with specific configuration
 * const result = await preprocessingManager.preprocess(imageData, 'preset-pocket-side-by-side');
 *
 * // Access results
 * console.log(`Processed ${result.pages.length} pages`);
 * console.log('Transformations:', result.transformations);
 * ```
 */

import { ImageSplitter } from './image-splitter';
import { ImageRotator } from './image-rotator';
import { PreprocessingConfigManager } from './preprocessing-config-manager';
import {
    PreprocessingResult,
    RotationTiming,
    RotationAngle,
    PreprocessingError,
    PreprocessingErrorType
} from './preprocessing-types';

export class PreprocessingManager {
    private splitter: ImageSplitter;
    private rotator: ImageRotator;
    private configManager: PreprocessingConfigManager;

    /**
     * Creates a new PreprocessingManager instance
     * @param configManager - Configuration manager for accessing preprocessing configurations
     */
    constructor(configManager: PreprocessingConfigManager) {
        this.splitter = new ImageSplitter();
        this.rotator = new ImageRotator();
        this.configManager = configManager;
    }

    /**
     * Preprocess an image according to configuration
     *
     * Applies transformations in the following order:
     * 1. Validates configuration
     * 2. Applies whole-image rotation (if timing is BEFORE_SPLIT)
     * 3. Validates dimensions and splits image (if splitting enabled)
     * 4. Applies per-page rotation (if timing is AFTER_SPLIT)
     *
     * Rotation failures are handled gracefully by continuing with the original image.
     * Dimension validation failures throw an error immediately.
     *
     * @param imageData - The image data as ArrayBuffer
     * @param configId - Optional configuration ID. If not provided, uses default configuration
     * @returns PreprocessingResult containing processed pages, config, and transformations
     * @throws PreprocessingError if no configuration found, configuration is invalid, or dimensions are too small
     */
    async preprocess(
        imageData: ArrayBuffer,
        configId?: string,
        customSplitPositions?: number[]
    ): Promise<PreprocessingResult> {
        // Get configuration from ConfigManager (use default if no ID provided)
        const config = configId
            ? this.configManager.getConfig(configId)
            : this.configManager.getDefaultConfig();

        if (!config) {
            throw new PreprocessingError(
                PreprocessingErrorType.INVALID_CONFIG,
                'No preprocessing configuration found',
                configId
            );
        }

        // Validate configuration before processing
        const errors = this.configManager.validateConfig(config);
        if (errors.length > 0) {
            throw new PreprocessingError(
                PreprocessingErrorType.INVALID_CONFIG,
                `Invalid configuration: ${errors.join(', ')}`,
                config.id
            );
        }

        // Track transformations applied in array
        const transformations: string[] = [];
        let currentImage = imageData;
        let pages: ArrayBuffer[] = [currentImage];

        // Apply rotation before split if configured
        if (config.rotation.enabled &&
            config.rotation.timing === RotationTiming.BEFORE_SPLIT &&
            config.rotation.wholeImageAngle) {

            try {
                currentImage = await this.rotator.rotate(currentImage, config.rotation.wholeImageAngle);
                pages = [currentImage];
                transformations.push(`Rotated whole image ${config.rotation.wholeImageAngle}°`);
            } catch (error) {
                if (error instanceof PreprocessingError && error.type === PreprocessingErrorType.ROTATION_FAILED) {
                    // Fallback: continue with original image
                    console.warn('Rotation failed, continuing with original image:', error.message);
                    transformations.push(`Rotation failed, using original image`);
                } else {
                    throw error;
                }
            }
        }

        // Apply splitting if configured
        if (config.split.enabled) {
            // Validate image dimensions before splitting
            const img = await this.loadImageForValidation(currentImage);
            const dimensionError = this.splitter.validateDimensions(
                img.width,
                img.height,
                config.split
            );

            if (dimensionError) {
                throw new PreprocessingError(
                    PreprocessingErrorType.INVALID_DIMENSIONS,
                    dimensionError,
                    config.id
                );
            }

            pages = await this.splitter.split(currentImage, config.split, customSplitPositions);
            transformations.push(
                `Split ${config.split.direction} into ${config.split.pageCount} pages`
            );
        }

        // Apply rotation after split if configured
        if (config.rotation.enabled &&
            config.rotation.timing === RotationTiming.AFTER_SPLIT &&
            config.rotation.perPageAngles) {

            const rotatedPages: ArrayBuffer[] = [];

            for (let i = 0; i < pages.length; i++) {
                const angle = config.rotation.perPageAngles[i] || RotationAngle.NONE;

                try {
                    const rotatedPage = await this.rotator.rotate(pages[i], angle);
                    rotatedPages.push(rotatedPage);

                    if (angle !== RotationAngle.NONE) {
                        transformations.push(`Rotated page ${i + 1} by ${angle}°`);
                    }
                } catch (error) {
                    if (error instanceof PreprocessingError && error.type === PreprocessingErrorType.ROTATION_FAILED) {
                        // Fallback: use original page without rotation
                        console.warn(`Rotation failed for page ${i + 1}, using original:`, error.message);
                        rotatedPages.push(pages[i]);
                        transformations.push(`Rotation failed for page ${i + 1}, using original`);
                    } else {
                        throw error;
                    }
                }
            }

            pages = rotatedPages;
        }

        // Return preprocessing result
        return {
            pages,
            config,
            transformations
        };
    }

    /**
     * Load image for validation purposes
     * Creates an HTMLImageElement to check dimensions before processing
     * @param imageData - The image data as ArrayBuffer
     * @returns Promise resolving to the loaded image element
     * @throws PreprocessingError if image fails to load
     * @private
     */
    private async loadImageForValidation(imageData: ArrayBuffer): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const blob = new Blob([imageData]);
            const url = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new PreprocessingError(
                    PreprocessingErrorType.IMAGE_LOAD_FAILED,
                    'Failed to load image'
                ));
            };

            img.src = url;
        });
    }
}
