/**
 * Tests for SplitCalculator
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SplitCalculator } from './split-calculator';
import { SplitDirection } from './preprocessing-types';

describe('SplitCalculator', () => {
    const calculator = new SplitCalculator();

    describe('Property-Based Tests', () => {
        /**
         * Feature: preprocessing-preview-visualization, Property 1: Preview modal displays for split-enabled configurations
         * Validates: Requirements 1.1
         *
         * For any preprocessing configuration with splitting enabled, when a user selects that configuration,
         * the system should display a preview modal showing the source image with split lines overlaid at the calculated positions
         */
        it('should calculate split positions for split-enabled configurations', () => {
            fc.assert(
                fc.property(
                    // Generate random image dimensions (100px to 5000px)
                    fc.integer({ min: 200, max: 5000 }),
                    fc.integer({ min: 200, max: 5000 }),
                    // Generate random page count (2, 3, or 4)
                    fc.integer({ min: 2, max: 4 }),
                    // Generate random split direction
                    fc.constantFrom(SplitDirection.HORIZONTAL, SplitDirection.VERTICAL),
                    (imageWidth, imageHeight, pageCount, direction) => {
                        const config = {
                            enabled: true,
                            direction,
                            pageCount
                        };

                        const positions = calculator.calculateDefaultPositions(
                            imageWidth,
                            imageHeight,
                            config
                        );

                        // Property: Split positions should be calculated
                        expect(positions).toBeDefined();
                        expect(positions.length).toBeGreaterThan(0);

                        // Property: First position should always be 0
                        expect(positions[0]).toBe(0);

                        // Property: Number of positions should equal pageCount
                        expect(positions.length).toBe(pageCount);

                        // Property: Positions should be in ascending order
                        for (let i = 1; i < positions.length; i++) {
                            expect(positions[i]).toBeGreaterThan(positions[i - 1]);
                        }

                        // Property: All positions should be within image bounds
                        const maxDimension = direction === SplitDirection.HORIZONTAL ? imageHeight : imageWidth;
                        for (const pos of positions) {
                            expect(pos).toBeGreaterThanOrEqual(0);
                            expect(pos).toBeLessThan(maxDimension);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        /**
         * Feature: preprocessing-preview-visualization, Property 11: Invalid split positions are rejected
         * Validates: Requirements 3.3
         *
         * For any split position adjustment that would create a page with dimensions below the minimum threshold (100px),
         * the system should reject the adjustment and maintain the previous valid positions
         */
        it('should reject invalid split positions that create pages below minimum dimensions', () => {
            fc.assert(
                fc.property(
                    // Generate random image dimensions (300px to 5000px to allow for invalid splits)
                    fc.integer({ min: 300, max: 5000 }),
                    fc.integer({ min: 300, max: 5000 }),
                    // Generate random split direction
                    fc.constantFrom(SplitDirection.HORIZONTAL, SplitDirection.VERTICAL),
                    (imageWidth, imageHeight, direction) => {
                        // Create invalid split positions that would result in pages below minimum
                        // For example, split very close to the start or end
                        const invalidPositions = direction === SplitDirection.HORIZONTAL
                            ? [0, 50, imageHeight - 50]  // Middle page would be too small
                            : [0, 50, imageWidth - 50];   // Middle page would be too small

                        const result = calculator.validateSplitPositions(
                            imageWidth,
                            imageHeight,
                            invalidPositions,
                            direction
                        );

                        // Property: Invalid positions should be rejected
                        expect(result.valid).toBe(false);
                        expect(result.error).toBeDefined();
                        expect(result.error).toContain('below minimum');
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should accept valid split positions that meet minimum dimensions', () => {
            fc.assert(
                fc.property(
                    // Generate random image dimensions (500px to 5000px)
                    fc.integer({ min: 500, max: 5000 }),
                    fc.integer({ min: 500, max: 5000 }),
                    // Generate random page count (2, 3, or 4)
                    fc.integer({ min: 2, max: 4 }),
                    // Generate random split direction
                    fc.constantFrom(SplitDirection.HORIZONTAL, SplitDirection.VERTICAL),
                    (imageWidth, imageHeight, pageCount, direction) => {
                        const config = {
                            enabled: true,
                            direction,
                            pageCount
                        };

                        // Calculate default positions (which should always be valid)
                        const positions = calculator.calculateDefaultPositions(
                            imageWidth,
                            imageHeight,
                            config
                        );

                        const result = calculator.validateSplitPositions(
                            imageWidth,
                            imageHeight,
                            positions,
                            direction
                        );

                        // Property: Valid positions should be accepted
                        expect(result.valid).toBe(true);
                        expect(result.error).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    describe('Unit Tests', () => {
        describe('calculateDefaultPositions', () => {
            it('should return [0] for disabled split', () => {
                const config = {
                    enabled: false,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 2
                };

                const positions = calculator.calculateDefaultPositions(1000, 1000, config);

                expect(positions).toEqual([0]);
            });

            it('should calculate vertical split positions correctly', () => {
                const config = {
                    enabled: true,
                    direction: SplitDirection.VERTICAL,
                    pageCount: 2
                };

                const positions = calculator.calculateDefaultPositions(1000, 500, config);

                expect(positions).toEqual([0, 500]);
            });

            it('should calculate horizontal split positions correctly', () => {
                const config = {
                    enabled: true,
                    direction: SplitDirection.HORIZONTAL,
                    pageCount: 3
                };

                const positions = calculator.calculateDefaultPositions(500, 900, config);

                expect(positions).toEqual([0, 300, 600]);
            });
        });

        describe('calculatePageRegions', () => {
            it('should calculate vertical page regions correctly', () => {
                const regions = calculator.calculatePageRegions(
                    1000,
                    500,
                    [0, 500],
                    SplitDirection.VERTICAL
                );

                expect(regions).toHaveLength(2);
                expect(regions[0]).toEqual({ x: 0, y: 0, width: 500, height: 500, pageNumber: 1 });
                expect(regions[1]).toEqual({ x: 500, y: 0, width: 500, height: 500, pageNumber: 2 });
            });

            it('should calculate horizontal page regions correctly', () => {
                const regions = calculator.calculatePageRegions(
                    500,
                    900,
                    [0, 300, 600],
                    SplitDirection.HORIZONTAL
                );

                expect(regions).toHaveLength(3);
                expect(regions[0]).toEqual({ x: 0, y: 0, width: 500, height: 300, pageNumber: 1 });
                expect(regions[1]).toEqual({ x: 0, y: 300, width: 500, height: 300, pageNumber: 2 });
                expect(regions[2]).toEqual({ x: 0, y: 600, width: 500, height: 300, pageNumber: 3 });
            });
        });

        describe('validateSplitPositions', () => {
            it('should reject empty positions array', () => {
                const result = calculator.validateSplitPositions(
                    1000,
                    1000,
                    [],
                    SplitDirection.VERTICAL
                );

                expect(result.valid).toBe(false);
                expect(result.error).toContain('No split positions');
            });

            it('should reject positions not starting with 0', () => {
                const result = calculator.validateSplitPositions(
                    1000,
                    1000,
                    [100, 500],
                    SplitDirection.VERTICAL
                );

                expect(result.valid).toBe(false);
                expect(result.error).toContain('First split position must be 0');
            });

            it('should reject non-ascending positions', () => {
                const result = calculator.validateSplitPositions(
                    1000,
                    1000,
                    [0, 500, 400],
                    SplitDirection.VERTICAL
                );

                expect(result.valid).toBe(false);
                expect(result.error).toContain('ascending order');
            });

            it('should reject positions creating pages below minimum width', () => {
                const result = calculator.validateSplitPositions(
                    1000,
                    1000,
                    [0, 50],
                    SplitDirection.VERTICAL
                );

                expect(result.valid).toBe(false);
                expect(result.error).toContain('width');
                expect(result.error).toContain('below minimum');
            });

            it('should reject positions creating pages below minimum height', () => {
                const result = calculator.validateSplitPositions(
                    1000,
                    1000,
                    [0, 50],
                    SplitDirection.HORIZONTAL
                );

                expect(result.valid).toBe(false);
                expect(result.error).toContain('height');
                expect(result.error).toContain('below minimum');
            });

            it('should accept valid positions', () => {
                const result = calculator.validateSplitPositions(
                    1000,
                    1000,
                    [0, 500],
                    SplitDirection.VERTICAL
                );

                expect(result.valid).toBe(true);
                expect(result.error).toBeUndefined();
            });
        });

        describe('findClosestSplitLine', () => {
            it('should find closest vertical split line', () => {
                const positions = [0, 500, 750];
                const index = calculator.findClosestSplitLine(
                    510,
                    100,
                    positions,
                    SplitDirection.VERTICAL,
                    50
                );

                expect(index).toBe(1); // Index of position 500
            });

            it('should find closest horizontal split line', () => {
                const positions = [0, 300, 600];
                const index = calculator.findClosestSplitLine(
                    100,
                    310,
                    positions,
                    SplitDirection.HORIZONTAL,
                    50
                );

                expect(index).toBe(1); // Index of position 300
            });

            it('should return null if no line within threshold', () => {
                const positions = [0, 500];
                const index = calculator.findClosestSplitLine(
                    300,
                    100,
                    positions,
                    SplitDirection.VERTICAL,
                    50
                );

                expect(index).toBeNull();
            });

            it('should skip first position (0)', () => {
                const positions = [0, 500];
                const index = calculator.findClosestSplitLine(
                    5,
                    100,
                    positions,
                    SplitDirection.VERTICAL,
                    50
                );

                // Should not return index 0, even though it's close
                expect(index).toBeNull();
            });
        });
    });
});
