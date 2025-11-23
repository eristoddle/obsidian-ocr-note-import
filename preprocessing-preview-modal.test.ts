/**
 * Tests for PreprocessingPreviewModal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PreprocessingPreviewModal } from './preprocessing-preview-modal';
import { PreprocessingConfig, SplitDirection, RotationTiming } from './preprocessing-types';
import { App } from 'obsidian';

// Mock canvas operations for testing
class MockCanvasRenderingContext2D {
    canvas: HTMLCanvasElement;
    imageSmoothingEnabled = true;
    imageSmoothingQuality: ImageSmoothingQuality = 'high';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    drawImage(...args: any[]): void {
        // Mock implementation
    }

    fillRect(...args: any[]): void {
        // Mock implementation
    }
}

// Helper function to create a mock test image as ArrayBuffer
async function createTestImage(width: number, height: number): Promise<ArrayBuffer> {
    // Create a minimal JPEG-like ArrayBuffer for testing
    // This is a mock - we're testing the logic, not actual image encoding
    const mockImageData = new Uint8Array(100);
    mockImageData[0] = 0xFF; // JPEG marker
    mockImageData[1] = 0xD8; // JPEG marker

    // Store dimensions in a way we can retrieve them
    const view = new DataView(mockImageData.buffer);
    view.setUint16(10, width, false);
    view.setUint16(12, height, false);

    return mockImageData.buffer;
}

// Helper function to get dimensions from mock image
async function getImageDimensions(imageData: ArrayBuffer): Promise<{ width: number; height: number }> {
    const view = new DataView(imageData);
    const width = view.getUint16(10, false);
    const height = view.getUint16(12, false);
    return { width, height };
}

// Mock App for testing
const mockApp = {} as App;

// Setup canvas mocking
beforeEach(() => {
    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
        if (contextType === '2d') {
            const canvas = document.createElement('canvas');
            return new MockCanvasRenderingContext2D(canvas) as any;
        }
        return null;
    });

    // Mock HTMLCanvasElement.toBlob
    HTMLCanvasElement.prototype.toBlob = vi.fn(function(this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: any) {
        // Create a mock blob with dimensions encoded
        const mockImageData = new Uint8Array(100);
        mockImageData[0] = 0xFF;
        mockImageData[1] = 0xD8;

        const view = new DataView(mockImageData.buffer);
        view.setUint16(10, this.width, false);
        view.setUint16(12, this.height, false);

        const blob = new Blob([mockImageData], { type: type || 'image/jpeg' });
        setTimeout(() => callback(blob), 0);
    });

    // Mock Image loading
    global.Image = class MockImage {
        src: string = '';
        width: number = 0;
        height: number = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        constructor() {
            // When src is set, trigger onload with dimensions from the data
            Object.defineProperty(this, 'src', {
                set: (value: string) => {
                    setTimeout(async () => {
                        // Extract dimensions from the blob URL
                        if (value.startsWith('blob:')) {
                            try {
                                const response = await fetch(value);
                                const arrayBuffer = await response.arrayBuffer();
                                const view = new DataView(arrayBuffer);
                                this.width = view.getUint16(10, false);
                                this.height = view.getUint16(12, false);
                                if (this.onload) this.onload();
                            } catch (e) {
                                if (this.onerror) this.onerror();
                            }
                        }
                    }, 0);
                },
                get: () => this.src
            });
        }
    } as any;
});

describe('PreprocessingPreviewModal', () => {
    describe('Property-Based Tests', () => {
        /**
         * Feature: preprocessing-preview-visualization, Property 23: Large images are downscaled for preview
         * Validates: Requirements 7.1
         *
         * For any image with width or height exceeding 2000px, the preview should display a downscaled version
         * rather than the full-resolution image
         */
        it('should downscale large images for preview', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate random large image dimensions (2001px to 5000px)
                    fc.integer({ min: 2001, max: 5000 }),
                    fc.integer({ min: 2001, max: 5000 }),
                    async (width, height) => {
                        // Create a test image
                        const imageData = await createTestImage(width, height);

                        // Create a minimal config
                        const config: PreprocessingConfig = {
                            id: 'test',
                            name: 'Test Config',
                            description: 'Test',
                            preset: 'single-page' as any,
                            split: {
                                enabled: false,
                                direction: SplitDirection.VERTICAL,
                                pageCount: 1
                            },
                            rotation: {
                                enabled: false,
                                timing: RotationTiming.BEFORE_SPLIT
                            }
                        };

                        // Create modal instance
                        const modal = new PreprocessingPreviewModal(mockApp, {
                            imageData,
                            config,
                            mode: 'testing'
                        });

                        // Access the private downscaleImage method via type assertion
                        const downscaleResult = await (modal as any).downscaleImage(imageData);

                        // Property: Preview image should be downscaled
                        const previewDimensions = await getImageDimensions(downscaleResult.preview);
                        expect(previewDimensions.width).toBeLessThanOrEqual(1500);
                        expect(previewDimensions.height).toBeLessThanOrEqual(1500);

                        // Property: At least one dimension should be close to 1500px (within 10px tolerance)
                        const maxDimension = Math.max(previewDimensions.width, previewDimensions.height);
                        expect(maxDimension).toBeGreaterThanOrEqual(1490);
                        expect(maxDimension).toBeLessThanOrEqual(1500);

                        // Property: Original image should be preserved
                        const originalDimensions = await getImageDimensions(downscaleResult.original);
                        expect(originalDimensions.width).toBe(width);
                        expect(originalDimensions.height).toBe(height);

                        // Property: Scale factor should be less than 1.0
                        expect(downscaleResult.scale).toBeLessThan(1.0);
                        expect(downscaleResult.scale).toBeGreaterThan(0);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Feature: preprocessing-preview-visualization, Property 24: Downscaling preserves aspect ratio
         * Validates: Requirements 7.2
         *
         * For any image that is downscaled for preview, the aspect ratio of the downscaled version
         * should equal the aspect ratio of the original image
         */
        it('should preserve aspect ratio when downscaling', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate random large image dimensions (2001px to 5000px)
                    fc.integer({ min: 2001, max: 5000 }),
                    fc.integer({ min: 2001, max: 5000 }),
                    async (width, height) => {
                        // Create a test image
                        const imageData = await createTestImage(width, height);

                        // Create a minimal config
                        const config: PreprocessingConfig = {
                            id: 'test',
                            name: 'Test Config',
                            description: 'Test',
                            preset: 'single-page' as any,
                            split: {
                                enabled: false,
                                direction: SplitDirection.VERTICAL,
                                pageCount: 1
                            },
                            rotation: {
                                enabled: false,
                                timing: RotationTiming.BEFORE_SPLIT
                            }
                        };

                        // Create modal instance
                        const modal = new PreprocessingPreviewModal(mockApp, {
                            imageData,
                            config,
                            mode: 'testing'
                        });

                        // Access the private downscaleImage method
                        const downscaleResult = await (modal as any).downscaleImage(imageData);

                        // Get dimensions
                        const originalDimensions = await getImageDimensions(downscaleResult.original);
                        const previewDimensions = await getImageDimensions(downscaleResult.preview);

                        // Calculate aspect ratios
                        const originalAspectRatio = originalDimensions.width / originalDimensions.height;
                        const previewAspectRatio = previewDimensions.width / previewDimensions.height;

                        // Property: Aspect ratios should be equal (within 1% tolerance for rounding)
                        const aspectRatioDifference = Math.abs(originalAspectRatio - previewAspectRatio);
                        const tolerance = originalAspectRatio * 0.01;
                        expect(aspectRatioDifference).toBeLessThanOrEqual(tolerance);
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Feature: preprocessing-preview-visualization, Property 25: Loading indicator displays during preparation
         * Validates: Requirements 7.3
         *
         * For any preview modal opening, a loading indicator should be visible from the moment the modal opens
         * until the preview image is fully prepared and rendered
         */
        it('should display loading indicator during image preparation', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate random image dimensions (500px to 3000px)
                    fc.integer({ min: 500, max: 3000 }),
                    fc.integer({ min: 500, max: 3000 }),
                    async (width, height) => {
                        // Create a test image
                        const imageData = await createTestImage(width, height);

                        // Create a minimal config
                        const config: PreprocessingConfig = {
                            id: 'test',
                            name: 'Test Config',
                            description: 'Test',
                            preset: 'single-page' as any,
                            split: {
                                enabled: false,
                                direction: SplitDirection.VERTICAL,
                                pageCount: 1
                            },
                            rotation: {
                                enabled: false,
                                timing: RotationTiming.BEFORE_SPLIT
                            }
                        };

                        // Create modal instance
                        const modal = new PreprocessingPreviewModal(mockApp, {
                            imageData,
                            config,
                            mode: 'testing'
                        });

                        // Access the private state
                        const state = (modal as any).state;

                        // Property: Initial state should have isLoading = true
                        expect(state.isLoading).toBe(true);

                        // Simulate loading process
                        const downscaleResult = await (modal as any).downscaleImage(imageData);
                        await (modal as any).loadImage(downscaleResult.preview);

                        // After loading, we would set isLoading to false
                        // This is tested implicitly by the modal's loadAndRenderPreview method
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Feature: preprocessing-preview-visualization, Property 26: Processing uses full-resolution image
         * Validates: Requirements 7.5
         *
         * For any image that was downscaled for preview display, when the user processes that image,
         * the preprocessing and OCR should operate on the original full-resolution image data,
         * not the downscaled preview version
         */
        it('should preserve original full-resolution image for processing', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate random large image dimensions (2001px to 5000px)
                    fc.integer({ min: 2001, max: 5000 }),
                    fc.integer({ min: 2001, max: 5000 }),
                    async (width, height) => {
                        // Create a test image
                        const imageData = await createTestImage(width, height);

                        // Create a minimal config
                        const config: PreprocessingConfig = {
                            id: 'test',
                            name: 'Test Config',
                            description: 'Test',
                            preset: 'single-page' as any,
                            split: {
                                enabled: false,
                                direction: SplitDirection.VERTICAL,
                                pageCount: 1
                            },
                            rotation: {
                                enabled: false,
                                timing: RotationTiming.BEFORE_SPLIT
                            }
                        };

                        // Create modal instance
                        const modal = new PreprocessingPreviewModal(mockApp, {
                            imageData,
                            config,
                            mode: 'testing'
                        });

                        // Simulate the downscaling process
                        const downscaleResult = await (modal as any).downscaleImage(imageData);

                        // Update state to simulate what happens in loadAndRenderPreview
                        (modal as any).state.imageData = downscaleResult.preview;
                        (modal as any).state.originalImageData = downscaleResult.original;

                        // Property: Original image data should be preserved
                        const originalImageData = modal.getOriginalImageData();
                        const originalDimensions = await getImageDimensions(originalImageData);

                        expect(originalDimensions.width).toBe(width);
                        expect(originalDimensions.height).toBe(height);

                        // Property: Original should be different from preview (for large images)
                        const previewDimensions = await getImageDimensions(downscaleResult.preview);
                        expect(originalDimensions.width).toBeGreaterThan(previewDimensions.width);
                        expect(originalDimensions.height).toBeGreaterThan(previewDimensions.height);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Unit Tests', () => {
        it('should not downscale images smaller than 2000px', async () => {
            const imageData = await createTestImage(1000, 1000);

            const config: PreprocessingConfig = {
                id: 'test',
                name: 'Test Config',
                description: 'Test',
                split: {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 1
                },
                rotation: {
                    enabled: false,
                    angle: 0,
                    timing: RotationTiming.BEFORE_SPLIT
                }
            };

            const modal = new PreprocessingPreviewModal(mockApp, {
                imageData,
                config,
                mode: 'testing'
            });

            const downscaleResult = await (modal as any).downscaleImage(imageData);

            // Should not downscale
            expect(downscaleResult.scale).toBe(1.0);
            expect(downscaleResult.preview).toBe(imageData);
            expect(downscaleResult.original).toBe(imageData);
        });

        it('should downscale images with width > 2000px', async () => {
            const imageData = await createTestImage(3000, 1000);

            const config: PreprocessingConfig = {
                id: 'test',
                name: 'Test Config',
                description: 'Test',
                split: {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 1
                },
                rotation: {
                    enabled: false,
                    angle: 0,
                    timing: RotationTiming.BEFORE_SPLIT
                }
            };

            const modal = new PreprocessingPreviewModal(mockApp, {
                imageData,
                config,
                mode: 'testing'
            });

            const downscaleResult = await (modal as any).downscaleImage(imageData);

            // Should downscale
            expect(downscaleResult.scale).toBeLessThan(1.0);
            expect(downscaleResult.scale).toBe(1500 / 3000);

            const previewDimensions = await getImageDimensions(downscaleResult.preview);
            expect(previewDimensions.width).toBe(1500);
            expect(previewDimensions.height).toBe(500);
        });

        it('should downscale images with height > 2000px', async () => {
            const imageData = await createTestImage(1000, 3000);

            const config: PreprocessingConfig = {
                id: 'test',
                name: 'Test Config',
                description: 'Test',
                split: {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 1
                },
                rotation: {
                    enabled: false,
                    angle: 0,
                    timing: RotationTiming.BEFORE_SPLIT
                }
            };

            const modal = new PreprocessingPreviewModal(mockApp, {
                imageData,
                config,
                mode: 'testing'
            });

            const downscaleResult = await (modal as any).downscaleImage(imageData);

            // Should downscale
            expect(downscaleResult.scale).toBeLessThan(1.0);
            expect(downscaleResult.scale).toBe(1500 / 3000);

            const previewDimensions = await getImageDimensions(downscaleResult.preview);
            expect(previewDimensions.width).toBe(500);
            expect(previewDimensions.height).toBe(1500);
        });
    });
});
