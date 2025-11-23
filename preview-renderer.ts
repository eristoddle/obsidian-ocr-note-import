/**
 * Preview renderer for preprocessing preview visualization
 * Handles all canvas drawing operations for the preview
 */

import { PreprocessingConfig, SplitDirection, RotationTiming } from './preprocessing-types';
import { PageRegion } from './split-calculator';

/**
 * Render options interface
 */
export interface RenderOptions {
    canvas: HTMLCanvasElement;
    image: HTMLImageElement;
    config: PreprocessingConfig;
    splitPositions?: number[];
    highlightedRegion?: number;
    pageRegions?: PageRegion[];
    transformations?: string[];
}

/**
 * PreviewRenderer class for rendering preview visualizations
 */
export class PreviewRenderer {
    private readonly SPLIT_LINE_COLOR = '#FF6B6B';
    private readonly SPLIT_LINE_WIDTH = 3;
    private readonly PAGE_LABEL_COLOR = '#4ECDC4';
    private readonly PAGE_REGION_COLORS = [
        'rgba(78, 205, 196, 0.1)',
        'rgba(255, 107, 107, 0.1)',
        'rgba(255, 195, 0, 0.1)',
        'rgba(155, 89, 182, 0.1)'
    ];

    /**
     * Main entry point for rendering the preview
     */
    render(options: RenderOptions): void {
        const { canvas, image, config, splitPositions, highlightedRegion, pageRegions, transformations } = options;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas 2D context');
        }

        // Calculate scale to fit image in canvas
        const scale = this.calculateScale(image.width, image.height, canvas.width, canvas.height);

        // Set canvas dimensions to match scaled image
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the source image
        this.drawImage(ctx, image, scale);

        // Draw page regions if provided
        if (pageRegions && pageRegions.length > 0) {
            this.drawPageRegions(ctx, pageRegions, scale, highlightedRegion);
        }

        // Draw split lines if splitting is enabled
        if (config.split.enabled && splitPositions && splitPositions.length > 1) {
            this.drawSplitLines(
                ctx,
                splitPositions,
                config.split.direction,
                { width: image.width, height: image.height },
                scale
            );
        }

        // Draw page labels if we have regions
        if (pageRegions && pageRegions.length > 0) {
            this.drawPageLabels(ctx, pageRegions, config, scale);
        }

        // Draw rotation indicators if rotation is enabled
        if (config.rotation.enabled && pageRegions && pageRegions.length > 0) {
            this.drawRotationIndicators(ctx, pageRegions, config, scale);
        }

        // Draw transformation summary if provided
        if (transformations) {
            this.drawTransformationSummary(ctx, transformations, scaledWidth, scaledHeight);
        }
    }

    /**
     * Draw the source image on the canvas
     */
    private drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, scale: number): void {
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;

        ctx.drawImage(image, 0, 0, scaledWidth, scaledHeight);
    }

    /**
     * Draw split lines on the canvas
     */
    private drawSplitLines(
        ctx: CanvasRenderingContext2D,
        positions: number[],
        direction: SplitDirection,
        imageDimensions: { width: number; height: number },
        scale: number
    ): void {
        ctx.strokeStyle = this.SPLIT_LINE_COLOR;
        ctx.lineWidth = this.SPLIT_LINE_WIDTH;

        // Skip the first position (0) as it's the image boundary
        for (let i = 1; i < positions.length; i++) {
            const position = positions[i] * scale;

            ctx.beginPath();

            if (direction === SplitDirection.VERTICAL) {
                // Draw vertical line
                ctx.moveTo(position, 0);
                ctx.lineTo(position, imageDimensions.height * scale);
            } else {
                // Draw horizontal line
                ctx.moveTo(0, position);
                ctx.lineTo(imageDimensions.width * scale, position);
            }

            ctx.stroke();
        }
    }

    /**
     * Draw page labels on the canvas
     */
    private drawPageLabels(
        ctx: CanvasRenderingContext2D,
        regions: PageRegion[],
        config: PreprocessingConfig,
        scale: number
    ): void {
        ctx.font = 'bold 16px sans-serif';
        ctx.textBaseline = 'top';

        for (const region of regions) {
            const x = region.x * scale + 10;
            const y = region.y * scale + 10;
            const text = `Page ${region.pageNumber}`;

            // Measure text for background
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = 20;

            // Draw background
            ctx.fillStyle = this.PAGE_LABEL_COLOR;
            ctx.globalAlpha = 0.8;
            this.drawRoundedRect(ctx, x - 5, y - 2, textWidth + 10, textHeight + 4, 4);
            ctx.fill();

            // Draw text
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, x, y);
        }
    }

    /**
     * Draw page regions with distinct colors
     */
    private drawPageRegions(
        ctx: CanvasRenderingContext2D,
        regions: PageRegion[],
        scale: number,
        highlightedIndex?: number
    ): void {
        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];
            const colorIndex = i % this.PAGE_REGION_COLORS.length;
            let color = this.PAGE_REGION_COLORS[colorIndex];

            // Increase opacity for highlighted region
            if (highlightedIndex !== undefined && i === highlightedIndex) {
                color = color.replace('0.1', '0.2');
            }

            ctx.fillStyle = color;
            ctx.fillRect(
                region.x * scale,
                region.y * scale,
                region.width * scale,
                region.height * scale
            );

            // Draw border for highlighted region
            if (highlightedIndex !== undefined && i === highlightedIndex) {
                ctx.strokeStyle = this.PAGE_LABEL_COLOR;
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    region.x * scale,
                    region.y * scale,
                    region.width * scale,
                    region.height * scale
                );
            }
        }
    }

    /**
     * Draw rotation indicators on the canvas
     */
    private drawRotationIndicators(
        ctx: CanvasRenderingContext2D,
        regions: PageRegion[],
        config: PreprocessingConfig,
        scale: number
    ): void {
        ctx.font = '14px sans-serif';
        ctx.textBaseline = 'middle';

        if (config.rotation.timing === RotationTiming.BEFORE_SPLIT) {
            // Show whole image rotation indicator
            const angle = config.rotation.wholeImageAngle || 0;
            if (angle !== 0) {
                const text = `${angle}° ↻`;
                const x = 10;
                const y = 30;

                // Measure text for background
                const metrics = ctx.measureText(text);
                const textWidth = metrics.width;
                const textHeight = 18;

                // Draw background
                ctx.fillStyle = this.PAGE_LABEL_COLOR;
                ctx.globalAlpha = 0.8;
                this.drawRoundedRect(ctx, x - 5, y - textHeight / 2 - 2, textWidth + 10, textHeight + 4, 4);
                ctx.fill();

                // Draw text
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillText(text, x, y);
            }
        } else {
            // Show per-page rotation indicators
            const perPageAngles = config.rotation.perPageAngles || [];

            for (let i = 0; i < regions.length; i++) {
                const region = regions[i];
                const angle = perPageAngles[i] || 0;

                if (angle !== 0) {
                    const text = `${angle}° ↻`;
                    const x = (region.x + region.width) * scale - 60;
                    const y = (region.y + region.height) * scale - 20;

                    // Measure text for background
                    const metrics = ctx.measureText(text);
                    const textWidth = metrics.width;
                    const textHeight = 18;

                    // Draw background
                    ctx.fillStyle = this.PAGE_LABEL_COLOR;
                    ctx.globalAlpha = 0.8;
                    this.drawRoundedRect(ctx, x - 5, y - textHeight / 2 - 2, textWidth + 10, textHeight + 4, 4);
                    ctx.fill();

                    // Draw text
                    ctx.globalAlpha = 1.0;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillText(text, x, y);
                }
            }
        }
    }

    /**
     * Draw transformation summary on the canvas
     */
    private drawTransformationSummary(
        ctx: CanvasRenderingContext2D,
        transformations: string[],
        canvasWidth: number,
        canvasHeight: number
    ): void {
        if (transformations.length === 0) {
            return;
        }

        ctx.font = '14px sans-serif';
        ctx.textBaseline = 'top';

        const padding = 10;
        const lineHeight = 20;
        const startY = canvasHeight - (transformations.length * lineHeight + padding * 2);

        // Draw semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(
            0,
            startY,
            canvasWidth,
            transformations.length * lineHeight + padding * 2
        );

        // Draw each transformation
        ctx.fillStyle = '#FFFFFF';
        transformations.forEach((transformation, index) => {
            const y = startY + padding + (index * lineHeight);
            ctx.fillText(transformation, padding, y);
        });
    }

    /**
     * Generate transformation list from config
     */
    generateTransformations(config: PreprocessingConfig): string[] {
        const transformations: string[] = [];
        let stepNumber = 1;

        // Check if rotation is before split
        if (config.rotation.enabled && config.rotation.timing === RotationTiming.BEFORE_SPLIT) {
            const angle = config.rotation.wholeImageAngle || 0;
            if (angle !== 0) {
                transformations.push(`${stepNumber}. Rotate ${angle}°`);
                stepNumber++;
            }
        }

        // Check if splitting is enabled
        if (config.split.enabled) {
            const direction = config.split.direction === SplitDirection.VERTICAL ? 'vertically' : 'horizontally';
            transformations.push(`${stepNumber}. Split ${direction} into ${config.split.pageCount} pages`);
            stepNumber++;
        }

        // Check if rotation is after split
        if (config.rotation.enabled && config.rotation.timing === RotationTiming.AFTER_SPLIT) {
            const perPageAngles = config.rotation.perPageAngles || [];
            const hasRotation = perPageAngles.some(angle => angle !== 0);
            if (hasRotation) {
                transformations.push(`${stepNumber}. Rotate pages individually`);
                stepNumber++;
            }
        }

        // If no transformations, return special message
        if (transformations.length === 0) {
            return ['No preprocessing - image will be processed as-is'];
        }

        return transformations;
    }

    /**
     * Calculate scale factor to fit image in canvas while maintaining aspect ratio
     */
    calculateScale(
        imageWidth: number,
        imageHeight: number,
        maxWidth: number,
        maxHeight: number
    ): number {
        const widthScale = maxWidth / imageWidth;
        const heightScale = maxHeight / imageHeight;

        // Use the smaller scale to ensure image fits in both dimensions
        return Math.min(widthScale, heightScale, 1.0); // Don't scale up
    }

    /**
     * Helper to draw rounded rectangle (polyfill for ctx.roundRect)
     */
    private drawRoundedRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number
    ): void {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}
