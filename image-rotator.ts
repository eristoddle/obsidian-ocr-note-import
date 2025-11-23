/**
 * Image rotator for correcting orientation
 *
 * Rotates images by 90°, 180°, or 270° clockwise to correct orientation issues.
 * Automatically adjusts canvas dimensions for 90° and 270° rotations.
 *
 * @example
 * ```typescript
 * const rotator = new ImageRotator();
 *
 * // Rotate an image 90° clockwise
 * const rotatedImage = await rotator.rotate(imageData, RotationAngle.CLOCKWISE_90);
 *
 * // No rotation (returns original)
 * const sameImage = await rotator.rotate(imageData, RotationAngle.NONE);
 * ```
 */

import { RotationAngle, PreprocessingError, PreprocessingErrorType } from './preprocessing-types';

export class ImageRotator {
    /**
     * Rotate an image by specified angle
     *
     * If angle is NONE (0°), returns the original image unchanged.
     * For 90° and 270° rotations, swaps width and height dimensions.
     *
     * @param imageData - The image data as an ArrayBuffer
     * @param angle - Rotation angle (0°, 90°, 180°, or 270° clockwise)
     * @returns Promise resolving to the rotated image as an ArrayBuffer
     * @throws PreprocessingError if rotation fails
     */
    async rotate(imageData: ArrayBuffer, angle: RotationAngle): Promise<ArrayBuffer> {
        if (angle === RotationAngle.NONE) {
            return imageData;
        }

        const img = await this.loadImage(imageData);

        // Calculate new dimensions after rotation
        const { width, height } = this.calculateRotatedDimensions(img.width, img.height, angle);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new PreprocessingError(
                PreprocessingErrorType.ROTATION_FAILED,
                'Failed to get canvas context'
            );
        }

        // Apply rotation transformation
        ctx.translate(width / 2, height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Convert to ArrayBuffer
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new PreprocessingError(
                        PreprocessingErrorType.ROTATION_FAILED,
                        'Failed to create blob from canvas'
                    ));
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result as ArrayBuffer);
                };
                reader.onerror = () => {
                    reject(new PreprocessingError(
                        PreprocessingErrorType.ROTATION_FAILED,
                        'Failed to read blob as ArrayBuffer'
                    ));
                };
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', 0.95);
        });
    }

    /**
     * Calculate dimensions after rotation
     * For 90° and 270° rotations, swaps width and height
     * For 0° and 180° rotations, keeps dimensions unchanged
     * @param width - Original image width
     * @param height - Original image height
     * @param angle - Rotation angle
     * @returns New dimensions after rotation
     * @private
     */
    private calculateRotatedDimensions(
        width: number,
        height: number,
        angle: RotationAngle
    ): { width: number; height: number } {
        if (angle === RotationAngle.CLOCKWISE_90 || angle === RotationAngle.CLOCKWISE_270) {
            return { width: height, height: width };
        }
        return { width, height };
    }

    /**
     * Load image from ArrayBuffer
     * Creates an HTMLImageElement from raw image data
     * @param imageData - The image data as an ArrayBuffer
     * @returns Promise resolving to the loaded image element
     * @throws PreprocessingError if image fails to load
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
                reject(new PreprocessingError(
                    PreprocessingErrorType.ROTATION_FAILED,
                    'Failed to load image for rotation'
                ));
            };

            img.src = url;
        });
    }
}
