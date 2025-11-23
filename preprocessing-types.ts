/**
 * Preprocessing configuration types and interfaces for notebook image preprocessing
 */

/**
 * Notebook type preset enumeration
 */
export enum NotebookPreset {
    SINGLE_PAGE = 'single-page',
    POCKET_SIDE_BY_SIDE = 'pocket-side-by-side',
    A5_PORTRAIT = 'a5-portrait',
    A5_LANDSCAPE = 'a5-landscape',
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
    [NotebookPreset.SINGLE_PAGE]: {
        id: 'preset-single-page',
        name: 'Single Page (8.5x11)',
        description: 'Standard single-page notebook scan, no splitting needed',
        preset: NotebookPreset.SINGLE_PAGE,
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
    [NotebookPreset.POCKET_SIDE_BY_SIDE]: {
        id: 'preset-pocket-side-by-side',
        name: 'Pocket Notebooks Side-by-Side (3.5x5.5)',
        description: 'Two pocket notebook pages scanned horizontally side-by-side',
        preset: NotebookPreset.POCKET_SIDE_BY_SIDE,
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
    [NotebookPreset.A5_PORTRAIT]: {
        id: 'preset-a5-portrait',
        name: 'A5 Portrait',
        description: 'A5 notebook scanned in portrait orientation',
        preset: NotebookPreset.A5_PORTRAIT,
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
    [NotebookPreset.A5_LANDSCAPE]: {
        id: 'preset-a5-landscape',
        name: 'A5 Landscape (needs rotation)',
        description: 'A5 notebook scanned in landscape, rotated to portrait',
        preset: NotebookPreset.A5_LANDSCAPE,
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
