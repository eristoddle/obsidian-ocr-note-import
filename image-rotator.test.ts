/**
 * Unit tests for ImageRotator
 *
 * Feature: notebook-image-preprocessing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ImageRotator } from './image-rotator';
import { RotationAngle } from './preprocessing-types';

describe('ImageRotator', () => {
    let rotator: ImageRotator;

    beforeEach(() => {
        rotator = new ImageRotator();
    });

    /**
     * Test that 0° rotation returns original image
     * Requirements: 3.2
     */
    it('returns original image when angle is 0°', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uint8Array({ minLength: 100, maxLength: 1000 }),
                async (imageBytes) => {
                    // Create ArrayBuffer from bytes
                    const imageData = imageBytes.buffer.slice(
                        imageBytes.byteOffset,
                        imageBytes.byteOffset + imageBytes.byteLength
                    );

                    // Rotate with 0° angle
                    const result = await rotator.rotate(imageData, RotationAngle.NONE);

                    // Should return the exact same ArrayBuffer
                    expect(result).toBe(imageData);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Test dimension calculations for all rotation angles
     * Requirements: 3.2
     */
    it('calculates correct dimensions for 90° rotation', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 2000 }),
                fc.integer({ min: 100, max: 2000 }),
                (width, height) => {
                    // Access private method through type assertion for testing
                    const dimensions = (rotator as any).calculateRotatedDimensions(
                        width,
                        height,
                        RotationAngle.CLOCKWISE_90
                    );

                    // 90° rotation should swap width and height
                    expect(dimensions.width).toBe(height);
                    expect(dimensions.height).toBe(width);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('calculates correct dimensions for 180° rotation', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 2000 }),
                fc.integer({ min: 100, max: 2000 }),
                (width, height) => {
                    const dimensions = (rotator as any).calculateRotatedDimensions(
                        width,
                        height,
                        RotationAngle.CLOCKWISE_180
                    );

                    // 180° rotation should keep same dimensions
                    expect(dimensions.width).toBe(width);
                    expect(dimensions.height).toBe(height);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('calculates correct dimensions for 270° rotation', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 2000 }),
                fc.integer({ min: 100, max: 2000 }),
                (width, height) => {
                    const dimensions = (rotator as any).calculateRotatedDimensions(
                        width,
                        height,
                        RotationAngle.CLOCKWISE_270
                    );

                    // 270° rotation should swap width and height
                    expect(dimensions.width).toBe(height);
                    expect(dimensions.height).toBe(width);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('calculates correct dimensions for 0° rotation', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 2000 }),
                fc.integer({ min: 100, max: 2000 }),
                (width, height) => {
                    const dimensions = (rotator as any).calculateRotatedDimensions(
                        width,
                        height,
                        RotationAngle.NONE
                    );

                    // 0° rotation should keep same dimensions
                    expect(dimensions.width).toBe(width);
                    expect(dimensions.height).toBe(height);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Test that all rotation angles are supported
     * Requirements: 3.2
     *
     * Note: Full rotation with Canvas APIs requires a browser environment.
     * This test verifies that the dimension calculations work for all angles.
     */
    it('supports all rotation angles', () => {
        const angles = [
            RotationAngle.NONE,
            RotationAngle.CLOCKWISE_90,
            RotationAngle.CLOCKWISE_180,
            RotationAngle.CLOCKWISE_270
        ];

        const width = 800;
        const height = 600;

        for (const angle of angles) {
            // Should calculate dimensions without error
            const dimensions = (rotator as any).calculateRotatedDimensions(width, height, angle);
            expect(dimensions).toBeDefined();
            expect(dimensions.width).toBeGreaterThan(0);
            expect(dimensions.height).toBeGreaterThan(0);
        }
    });
});
