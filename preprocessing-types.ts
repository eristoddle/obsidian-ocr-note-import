/**
 * Preprocessing configuration types and interfaces for notebook image preprocessing
 */

/**
 * Notebook type preset enumeration
 */
export enum NotebookPreset {
    NO_PREPROCESSING = 'no-preprocessing',
    SPLIT_VERTICALLY = 'split-vertically',
    ROTATE_90_CLOCKWISE = 'rotate-90-clockwise',
    ROTATE_90_COUNTERCLOCKWISE = 'rotate-90-counterclockwise',
    TOP_SPIRAL_NOTEBOOK = 'top-spiral-notebook',
    CUSTOM = 'custom'
}

/**
 * Split direction enumeration
 */
export enum SplitDirection {
    HORIZONTAL = 'horizontal',
    VERTICAL = 'vertical'
}

/**
 * Rotation angle enumeration
 */
export enum RotationAngle {
    NONE = 0,
    CLOCKWISE_90 = 90,
    CLOCKWISE_180 = 180,
    CLOCKWISE_270 = 270
}

/**
 * Rotation timing enumeration
 */
export enum RotationTiming {
    BEFORE_SPLIT = 'before-split',
    AFTER_SPLIT = 'after-split'
}

/**
 * Split configuration interface
 */
export interface SplitConfig {
    enabled: boolean;
    direction: SplitDirection;
    pageCount: number;  // 2, 3, or 4
    customPositions?: number[];  // Custom split positions in pixels
}

/**
 * Rotation configuration interface
 */
export interface RotationConfig {
    enabled: boolean;
    timing: RotationTiming;
    wholeImageAngle?: RotationAngle;  // Used when timing is BEFORE_SPLIT
    perPageAngles?: RotationAngle[];  // Used when timing is AFTER_SPLIT
}

/**
 * Preprocessing configuration interface
 */
export interface PreprocessingConfig {
    id: string;
    name: string;
    description: string;
    preset: NotebookPreset;
    split: SplitConfig;
    rotation: RotationConfig;
}

/**
 * Result of preprocessing operation
 */
export interface PreprocessingResult {
    pages: ArrayBuffer[];
    config: PreprocessingConfig;
    transformations: string[];  // Description of applied transformations
}

/**
 * Preview thumbnail interface
 */
export interface PreviewThumbnail {
    pageNumber: number;
    dataUrl: string;
    transformations: string[];
}

/**
 * Predefined preset configurations
 */
export const PRESET_CONFIGS: Record<NotebookPreset, PreprocessingConfig> = {
    [NotebookPreset.NO_PREPROCESSING]: {
        id: 'preset-no-preprocessing',
        name: 'No Preprocessing',
        description: 'Process image without any transformations',
        preset: NotebookPreset.NO_PREPROCESSING,
        split: {
            enabled: false,
            direction: SplitDirection.HORIZONTAL,
            pageCount: 1
        },
        rotation: {
            enabled: false,
            timing: RotationTiming.BEFORE_SPLIT
        }
    },
    [NotebookPreset.SPLIT_VERTICALLY]: {
        id: 'preset-split-vertically',
        name: 'Split Vertically',
        description: 'Split image into two pages side-by-side (left and right)',
        preset: NotebookPreset.SPLIT_VERTICALLY,
        split: {
            enabled: true,
            direction: SplitDirection.VERTICAL,
            pageCount: 2
        },
        rotation: {
            enabled: false,
            timing: RotationTiming.AFTER_SPLIT
        }
    },
    [NotebookPreset.ROTATE_90_CLOCKWISE]: {
        id: 'preset-rotate-90-clockwise',
        name: 'Rotate 90° Clockwise',
        description: 'Rotate entire image 90 degrees clockwise',
        preset: NotebookPreset.ROTATE_90_CLOCKWISE,
        split: {
            enabled: false,
            direction: SplitDirection.HORIZONTAL,
            pageCount: 1
        },
        rotation: {
            enabled: true,
            timing: RotationTiming.BEFORE_SPLIT,
            wholeImageAngle: RotationAngle.CLOCKWISE_90
        }
    },
    [NotebookPreset.ROTATE_90_COUNTERCLOCKWISE]: {
        id: 'preset-rotate-90-counterclockwise',
        name: 'Rotate 90° Counterclockwise',
        description: 'Rotate entire image 90 degrees counterclockwise',
        preset: NotebookPreset.ROTATE_90_COUNTERCLOCKWISE,
        split: {
            enabled: false,
            direction: SplitDirection.HORIZONTAL,
            pageCount: 1
        },
        rotation: {
            enabled: true,
            timing: RotationTiming.BEFORE_SPLIT,
            wholeImageAngle: RotationAngle.CLOCKWISE_270
        }
    },
    [NotebookPreset.TOP_SPIRAL_NOTEBOOK]: {
        id: 'preset-top-spiral-notebook',
        name: 'Top Spiral Notebook',
        description: 'Split horizontally and rotate top page 180° (for top-spiral notebooks)',
        preset: NotebookPreset.TOP_SPIRAL_NOTEBOOK,
        split: {
            enabled: true,
            direction: SplitDirection.HORIZONTAL,
            pageCount: 2
        },
        rotation: {
            enabled: true,
            timing: RotationTiming.AFTER_SPLIT,
            perPageAngles: [RotationAngle.CLOCKWISE_180, RotationAngle.NONE]
        }
    },
    [NotebookPreset.CUSTOM]: {
        id: 'custom-default',
        name: 'Custom Configuration',
        description: 'User-defined custom configuration',
        preset: NotebookPreset.CUSTOM,
        split: {
            enabled: false,
            direction: SplitDirection.HORIZONTAL,
            pageCount: 1
        },
        rotation: {
            enabled: false,
            timing: RotationTiming.BEFORE_SPLIT
        }
    }
};

/**
 * Preprocessing error types
 */
export enum PreprocessingErrorType {
    INVALID_DIMENSIONS = 'invalid_dimensions',
    SPLIT_FAILED = 'split_failed',
    ROTATION_FAILED = 'rotation_failed',
    INVALID_CONFIG = 'invalid_config',
    IMAGE_LOAD_FAILED = 'image_load_failed'
}

/**
 * Preprocessing error class
 */
export class PreprocessingError extends Error {
    type: PreprocessingErrorType;
    configId?: string;

    constructor(type: PreprocessingErrorType, message: string, configId?: string) {
        super(message);
        this.type = type;
        this.configId = configId;
        this.name = 'PreprocessingError';
    }
}
