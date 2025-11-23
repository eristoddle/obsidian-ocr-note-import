/**
 * Preview generator for showing preprocessing results
 *
 * Generates thumbnail previews of preprocessed pages for UI display.
 * Thumbnails are scaled to fit within a maximum size while maintaining aspect ratio.
 *
 * @example
 * ```typescript
 * const previewGenerator = new PreviewGenerator();
 *
 * // Generate previews from preprocessing result
 * const previews = await previewGenerator.generatePreviews(preprocessingResult);
 *
 * // Display previews in UI
 * previews.forEach(preview => {
 *   console.log(`Page ${preview.pageNumber}: ${preview.dataUrl}`);
 * });
 * ```
 */

import { PreprocessingResult, PreviewThumbnail } from './preprocessing-types';

export class PreviewGenerator {
    private maxThumbnailSize: number = 300;  // Max width or height in pixels

    /**
     * Generate preview thumbnails for a preprocessing result
     * Creates scaled-down versions of each page for display in the UI
     * Thumbnails maintain aspect ratio and never exceed maxThumbnailSize
     *
     * @param result - The preprocessing result containing pages and transformations
     * @returns Array of preview thumbnails with page numbers and data URLs
     * @throws Error if image loading or canvas operations fail
     */
    async generatePreviews(result: PreprocessingResult): Promise<PreviewThumbnail[]> {
        const previews: PreviewThumbnail[] = [];

        for (let i = 0; i < result.pages.length; i++) {
            const thumbnail = await this.createThumbnail(result.pages[i], i + 1);
            previews.push(thumbnail);
        }

        return previews;
    }

    /**
     * Create a thumbnail from a page image
     * Scales the image to fit within maxThumbnailSize while maintaining aspect ratio
     * Never upscales images (scale factor capped at 1.0)
     *
     * @param pageData - The page image data as ArrayBuffer
     * @param pageNumber - The page number (1-indexed)
     * @returns PreviewThumbnail with page number, data URL (JPEG format, 80% quality), and transformations
     * @throws Error if image loading or canvas operations fail
     * @private
     */
    private async createThumbnail(
        pageData: ArrayBuffer,
        pageNumber: number
    ): Promise<PreviewThumbnail> {
        const img = await this.loadImage(pageData);

        // Calculate thumbnail dimensions maintaining aspect ratio
        const scale = Math.min(
            this.maxThumbnailSize / img.width,
            this.maxThumbnailSize / img.height,
            1  // Don't upscale
        );

        const thumbWidth = Math.floor(img.width * scale);
        const thumbHeight = Math.floor(img.height * scale);

        // Create canvas with thumbnail dimensions
        const canvas = document.createElement('canvas');
        canvas.width = thumbWidth;
        canvas.height = thumbHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        // Draw scaled image on canvas
        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);

        // Convert canvas to data URL
        return {
            pageNumber,
            dataUrl: canvas.toDataURL('image/jpeg', 0.8),
            transformations: []
        };
    }

    /**
     * Load image from ArrayBuffer
     * Creates an HTMLImageElement from raw image data
     *
     * @param imageData - The image data as ArrayBuffer
     * @returns Promise resolving to HTMLImageElement
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
                reject(new Error('Failed to load image for preview'));
            };

            img.src = url;
        });
    }
}
