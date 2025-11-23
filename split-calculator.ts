/**
 * Split calculator for preprocessing preview visualization
 * Handles calculation and validation of split positions for image splitting
 */

import { SplitConfig, SplitDirection } from './preprocessing-types';

/**
 * Page region interface representing a rectangular area in the image
 */
export interface PageRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * SplitCalculator class for calculating and validating split positions
 */
export class SplitCalculator {
    private readonly MIN_PAGE_DIMENSION = 100;

    /**
     * Calculate default split positions based on configuration
     * @param imageWidth Width of the source image
     * @param imageHeight Height of the source image
     * @param config Split configuration
     * @returns Array of split positions in pixels
     */
    calculateDefaultPositions(
        imageWidth: number,
        imageHeight: number,
        config: SplitConfig
    ): number[] {
        if (!config.enabled || config.pageCount < 2) {
            return [0];
        }

        const positions: number[] = [0];

        if (config.direction === SplitDirection.HORIZONTAL) {
            const pageHeight = Math.floor(imageHeight / config.pageCount);
            for (let i = 1; i < config.pageCount; i++) {
                positions.push(i * pageHeight);
            }
        } else {
            // VERTICAL
            const pageWidth = Math.floor(imageWidth / config.pageCount);
            for (let i = 1; i < config.pageCount; i++) {
                positions.push(i * pageWidth);
            }
        }

        return positions;
    }

    /**
     * Calculate page regions from split positions
     * @param imageWidth Width of the source image
     * @param imageHeight Height of the source image
     * @param splitPositions Array of split positions
     * @param direction Split direction
     * @returns Array of page regions
     */
    calculatePageRegions(
        imageWidth: number,
        imageHeight: number,
        splitPositions: number[],
        direction: SplitDirection
    ): PageRegion[] {
        const regions: PageRegion[] = [];

        if (direction === SplitDirection.HORIZONTAL) {
            for (let i = 0; i < splitPositions.length; i++) {
                const y = splitPositions[i];
                const nextY = i < splitPositions.length - 1 ? splitPositions[i + 1] : imageHeight;
                const height = nextY - y;

                regions.push({
                    x: 0,
                    y,
                    width: imageWidth,
                    height,
                    pageNumber: i + 1
                });
            }
        } else {
            // VERTICAL
            for (let i = 0; i < splitPositions.length; i++) {
                const x = splitPositions[i];
                const nextX = i < splitPositions.length - 1 ? splitPositions[i + 1] : imageWidth;
                const width = nextX - x;

                regions.push({
                    x,
                    y: 0,
                    width,
                    height: imageHeight,
                    pageNumber: i + 1
                });
            }
        }

        return regions;
    }

    /**
     * Validate that split positions create valid pages
     * @param imageWidth Width of the source image
     * @param imageHeight Height of the source image
     * @param splitPositions Array of split positions
     * @param direction Split direction
     * @returns Validation result with error message if invalid
     */
    validateSplitPositions(
        imageWidth: number,
        imageHeight: number,
        splitPositions: number[],
        direction: SplitDirection
    ): ValidationResult {
        if (splitPositions.length === 0) {
            return { valid: false, error: 'No split positions provided' };
        }

        if (splitPositions[0] !== 0) {
            return { valid: false, error: 'First split position must be 0' };
        }

        // Check positions are in ascending order
        for (let i = 1; i < splitPositions.length; i++) {
            if (splitPositions[i] <= splitPositions[i - 1]) {
                return { valid: false, error: 'Split positions must be in ascending order' };
            }
        }

        // Validate each page region meets minimum dimensions
        const regions = this.calculatePageRegions(imageWidth, imageHeight, splitPositions, direction);

        for (const region of regions) {
            if (region.width < this.MIN_PAGE_DIMENSION) {
                return {
                    valid: false,
                    error: `Page ${region.pageNumber} width (${region.width}px) is below minimum (${this.MIN_PAGE_DIMENSION}px)`
                };
            }
            if (region.height < this.MIN_PAGE_DIMENSION) {
                return {
                    valid: false,
                    error: `Page ${region.pageNumber} height (${region.height}px) is below minimum (${this.MIN_PAGE_DIMENSION}px)`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Find the closest split line to a point
     * @param x X coordinate
     * @param y Y coordinate
     * @param splitPositions Array of split positions
     * @param direction Split direction
     * @param threshold Maximum distance to consider (in pixels)
     * @returns Index of closest split line, or null if none within threshold
     */
    findClosestSplitLine(
        x: number,
        y: number,
        splitPositions: number[],
        direction: SplitDirection,
        threshold: number
    ): number | null {
        let closestIndex: number | null = null;
        let closestDistance = threshold;

        // Skip the first position (0) as it's the image boundary
        for (let i = 1; i < splitPositions.length; i++) {
            const position = splitPositions[i];
            let distance: number;

            if (direction === SplitDirection.HORIZONTAL) {
                distance = Math.abs(y - position);
            } else {
                // VERTICAL
                distance = Math.abs(x - position);
            }

            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    }
}
