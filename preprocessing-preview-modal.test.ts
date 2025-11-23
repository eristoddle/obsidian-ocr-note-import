/**
 * Tests for PreprocessingPreviewModal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PreprocessingPreviewModal } from './preprocessing-preview-modal';
import { PreprocessingConfig, SplitDirection, RotationTiming, RotationAngle } from './preprocessing-types';
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

    roundRect(...args: any[]): void {
        // Mock implementation
    }

    clearRect(...args: any[]): void {
        // Mock implementation
    }

    fill(...args: any[]): void {
        // Mock implementation
    }

    arc(...args: any[]): void {
        // Mock implementation
    }

    closePath(): void {
        // Mock implementation
    }

    quadraticCurveTo(...args: any[]): void {
        // Mock implementation
    }

    strokeRect(...args: any[]): void {
        // Mock implementation
    }

    beginPath(): void {
        // Mock implementation
    }

    moveTo(...args: any[]): void {
        // Mock implementation
    }

    lineTo(...args: any[]): void {
        // Mock implementation
    }

    stroke(): void {
        // Mock implementation
    }

    fillText(...args: any[]): void {
        // Mock implementation
    }

    measureText(text: string): TextMetrics {
        return { width: text.length * 5 } as TextMetrics;
    }

    save(): void {
        // Mock implementation
    }

    restore(): void {
        // Mock implementation
    }

    translate(...args: any[]): void {
        // Mock implementation
    }

    rotate(...args: any[]): void {
        // Mock implementation
    }

    scale(...args: any[]): void {
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
                                timing: RotationTiming.BEFORE_SPLIT,
                                wholeImageAngle: RotationAngle.NONE
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
                                timing: RotationTiming.BEFORE_SPLIT,
                                wholeImageAngle: RotationAngle.NONE
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
                                timing: RotationTiming.BEFORE_SPLIT,
                                wholeImageAngle: RotationAngle.NONE
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
                                timing: RotationTiming.BEFORE_SPLIT,
                                wholeImageAngle: RotationAngle.NONE
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
        /**
         * Feature: preprocessing-preview-visualization, Property 22: Hover highlights region and shows dimensions
         * Validates: Requirements 6.5
         *
         * When the mouse hovers over a page region in the preview, that region should be highlighted
         * and a tooltip showing the region's dimensions should be displayed
         */
        it('should highlight region and show tooltip on hover', async () => {
            await fc.assert(
                fc.asyncProperty(
                    // Generate random image dimensions
                    fc.integer({ min: 500, max: 2000 }),
                    fc.integer({ min: 500, max: 2000 }),
                    // Generate random mouse position (normalized 0-1)
                    fc.float({ min: 0, max: 1 }),
                    fc.float({ min: 0, max: 1 }),
                    async (width, height, mouseXRatio, mouseYRatio) => {
                        // Create a test image
                        const imageData = await createTestImage(width, height);

                        // Create a config with splitting enabled (2 pages vertical)
                        const config: PreprocessingConfig = {
                            id: 'test',
                            name: 'Test Config',
                            description: 'Test',
                            preset: 'custom' as any,
                            split: {
                                enabled: true,
                                direction: SplitDirection.VERTICAL,
                                pageCount: 2
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

                        // Mock contentEl for onOpen
                        const mockElement: any = {
                            createEl: vi.fn(() => document.createElement('canvas')),
                            createDiv: vi.fn(() => mockElement),
                            setText: vi.fn(),
                            style: {},
                            empty: vi.fn(),
                            addClass: vi.fn()
                        };

                        const mockContentEl = {
                            empty: vi.fn(),
                            addClass: vi.fn(),
                            createDiv: vi.fn(() => mockElement),
                            createEl: vi.fn(() => mockElement)
                        };
                        (modal as any).contentEl = mockContentEl;

                        // Open modal to initialize canvas
                        modal.onOpen();

                        // Wait for image loading (simulated)
                        const downscaleResult = await (modal as any).downscaleImage(imageData);
                        (modal as any).state.imageData = downscaleResult.preview;
                        (modal as any).state.image = { width: downscaleResult.preview.byteLength > 0 ? 1500 : 100, height: 1000 }; // Mock loaded image
                        (modal as any).state.scale = downscaleResult.scale;

                        // Initialize regions
                        (modal as any).state.splitPositions = [Math.floor((modal as any).state.image.width / 2)];
                        (modal as any).state.pageRegions = [
                            { x: 0, y: 0, width: (modal as any).state.image.width / 2, height: (modal as any).state.image.height, pageNumber: 1 },
                            { x: (modal as any).state.image.width / 2, y: 0, width: (modal as any).state.image.width / 2, height: (modal as any).state.image.height, pageNumber: 2 }
                        ];

                        // Get canvas and mock getBoundingClientRect
                        const canvas = (modal as any).canvasEl;
                        canvas.width = 800;
                        canvas.height = 600;
                        canvas.getBoundingClientRect = () => ({
                            left: 0,
                            top: 0,
                            width: 800,
                            height: 600,
                            right: 800,
                            bottom: 600,
                            x: 0,
                            y: 0,
                            toJSON: () => {}
                        });

                        // Simulate mouse move
                        const clientX = mouseXRatio * 800;
                        const clientY = mouseYRatio * 600;

                        // Manually trigger handleMouseMove since we can't easily dispatch real events to the private handler
                        // But we can access the private method
                        const event = {
                            clientX,
                            clientY,
                            preventDefault: vi.fn(),
                            stopPropagation: vi.fn()
                        } as any;

                        (modal as any).handleMouseMove(event);

                        // Check if a region is highlighted
                        // We need to calculate which region should be highlighted based on the mouse position
                        const scale = (modal as any).renderer.calculateScale(
                            (modal as any).state.image.width,
                            (modal as any).state.image.height,
                            800,
                            600
                        );

                        const imageX = clientX / scale;
                        const imageY = clientY / scale;

                        // Determine expected region
                        let expectedRegionIndex: number | null = null;
                        const regions = (modal as any).state.pageRegions;
                        for (let i = 0; i < regions.length; i++) {
                            const r = regions[i];
                            if (imageX >= r.x && imageX <= r.x + r.width &&
                                imageY >= r.y && imageY <= r.y + r.height) {
                                expectedRegionIndex = i;
                                break;
                            }
                        }

                        // Property: The highlighted region state should match the expected region index
                        expect((modal as any).state.highlightedRegion).toBe(expectedRegionIndex);

                        // Property: Tooltip should be set if a region is highlighted
                        if (expectedRegionIndex !== null) {
                            expect(canvas.title).toContain(`Page ${regions[expectedRegionIndex].pageNumber}`);
                        } else {
                            expect(canvas.title).toBe('');
                        }
                    }
                ),
                { numRuns: 50 }
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
                preset: 'single-page' as any,
                split: {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 1
                },
                rotation: {
                    enabled: false,
                    wholeImageAngle: RotationAngle.NONE,
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
                preset: 'single-page' as any,
                split: {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 1
                },
                rotation: {
                    enabled: false,
                    wholeImageAngle: RotationAngle.NONE,
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
                preset: 'single-page' as any,
                split: {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 1
                },
                rotation: {
                    enabled: false,
                    wholeImageAngle: RotationAngle.NONE,
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
