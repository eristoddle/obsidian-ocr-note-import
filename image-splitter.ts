/**
 * Image splitter for dividing multi-page scans
 *
 * Splits a single image containing multiple notebook pages into separate page images.
 * Supports both horizontal (top-to-bottom) and vertical (left-to-right) splitting.
 *
 * @example
 * ```typescript
 * const splitter = new ImageSplitter();
 *
 * // Split an image vertically into 2 pages (side-by-side)
 * const config = {
 *   enabled: true,
 *   direction: SplitDirection.VERTICAL,
 *   pageCount: 2
 * };
 *
 * const pages = await splitter.split(imageData, config);
 * // pages[0] = left page, pages[1] = right page
 * ```
 */

import { SplitConfig, SplitDirection } from './preprocessing-types';

export class ImageSplitter {
    /**
     * Split an image into multiple pages
     *
     * If splitting is disabled, returns the original image in an array.
     * Otherwise, divides the image according to the configuration.
     * The last page receives any remaining pixels from uneven divisions.
     *
     * @param imageData - The image data as an ArrayBuffer
     * @param config - Split configuration specifying direction and page count
     * @returns Array of page images as ArrayBuffers
     * @throws Error if image loading or canvas operations fail
     */
    async split(imageData: ArrayBuffer, config: SplitConfig): Promise<ArrayBuffer[]> {
        if (!config.enabled) {
            return [imageData];
        }

        const img = await this.loadImage(imageData);
        const pages: ArrayBuffer[] = [];

        if (config.direction === SplitDirection.HORIZONTAL) {
            // Split horizontally (top to bottom)
            const pageHeight = Math.floor(img.height / config.pageCount);

            for (let i = 0; i < config.pageCount; i++) {
                const y = i * pageHeight;
                const height = (i === config.pageCount - 1)
                    ? img.height - y  // Last page gets remaining pixels
                    : pageHeight;

                const pageData = await this.extractRegion(img, 0, y, img.width, height);
                pages.push(pageData);
            }
        } else {
            // Split vertically (left to right)
            const pageWidth = Math.floor(img.width / config.pageCount);

            for (let i = 0; i < config.pageCount; i++) {
                const x = i * pageWidth;
                const width = (i === config.pageCount - 1)
                    ? img.width - x  // Last page gets remaining pixels
                    : pageWidth;

                const pageData = await this.extractRegion(img, x, 0, width, img.height);
                pages.push(pageData);
            }
        }

        return pages;
    }

    /**
     * Load image from ArrayBuffer
     * Creates an HTMLImageElement from raw image data
     * @param imageData - The image data as an ArrayBuffer
     * @returns Promise resolving to the loaded image element
     * @throws Error if image fails to load
     * @private
     */
    private async loadImage(imageData: ArrayBuffer): Promise<HTMLImageElement> {
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
                reject(new Error('Failed to load image for splitting'));
            };

            img.src = url;
        });
    }

    /**
     * Extract a region from an image
     * Uses canvas to extract a rectangular region and convert it to ArrayBuffer
     * @param img - The source image element
     * @param x - X coordinate of the region's top-left corner
     * @param y - Y coordinate of the region's top-left corner
     * @param width - Width of the region to extract
     * @param height - Height of the region to extract
     * @returns Promise resolving to the extracted region as an ArrayBuffer (JPEG format, 95% quality)
     * @throws Error if canvas operations or blob conversion fail
     * @private
     */
    private async extractRegion(
        img: HTMLImageElement,
        x: number,
        y: number,
        width: number,
        height: number
    ): Promise<ArrayBuffer> {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        // Draw the specified region
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

        // Convert to ArrayBuffer
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to create blob from canvas'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result as ArrayBuffer);
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read blob as ArrayBuffer'));
                };
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', 0.95);
        });
    }

    /**
     * Validate that image dimensions are suitable for splitting
     * Ensures each resulting page will be at least 100px in the split dimension
     * @param width - Image width in pixels
     * @param height - Image height in pixels
     * @param config - Split configuration to validate against
     * @returns Error message if dimensions are invalid, null if valid
     */
    validateDimensions(width: number, height: number, config: SplitConfig): string | null {
        if (!config.enabled) {
            return null;
        }

        const minPageDimension = 100;  // Minimum pixels for a page dimension

        if (config.direction === SplitDirection.HORIZONTAL) {
            const pageHeight = height / config.pageCount;
            if (pageHeight < minPageDimension) {
                return `Image height (${height}px) is too small to split into ${config.pageCount} pages. Each page would be ${pageHeight}px tall.`;
            }
        } else {
            const pageWidth = width / config.pageCount;
            if (pageWidth < minPageDimension) {
                return `Image width (${width}px) is too small to split into ${config.pageCount} pages. Each page would be ${pageWidth}px wide.`;
            }
        }

        return null;
    }
}
