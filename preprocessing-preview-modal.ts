/**
 * Preprocessing Preview Modal
 * Displays a visual preview of how preprocessing transformations will be applied to an image
 */

import { App, Modal } from 'obsidian';
import { PreprocessingConfig } from './preprocessing-types';
import { PreviewRenderer } from './preview-renderer';
import { SplitCalculator, PageRegion } from './split-calculator';

/**
 * Preview modal options interface
 */
export interface PreviewModalOptions {
    imageData: ArrayBuffer;
    config: PreprocessingConfig;
    mode: 'processing' | 'testing';
    onConfirm?: (customSplitPositions?: number[]) => void;
    onCancel?: () => void;
}

/**
 * Preview state interface
 */
interface PreviewState {
    imageData: ArrayBuffer;
    originalImageData: ArrayBuffer; // Full-resolution image for processing
    image: HTMLImageElement | null;
    config: PreprocessingConfig;
    splitPositions: number[];
    customSplitPositions: number[] | null;
    pageRegions: PageRegion[];
    highlightedRegion: number | null;
    transformations: string[];
    isLoading: boolean;
    error: string | null;
    scale: number; // Downscaling factor applied to preview
}

/**
 * Interaction state interface
 */
interface InteractionState {
    isDragging: boolean;
    draggedLineIndex: number | null;
    dragStartPosition: { x: number; y: number } | null;
    hoveredRegion: number | null;
    hoveredLine: number | null;
}

/**
 * PreprocessingPreviewModal class
 * Modal component that displays the preview and handles user interaction
 */
export class PreprocessingPreviewModal extends Modal {
    private options: PreviewModalOptions;
    private renderer: PreviewRenderer;
    private calculator: SplitCalculator;
    private state: PreviewState;
    private interaction: InteractionState;

    private canvasEl: HTMLCanvasElement | null = null;
    private canvasContainerEl: HTMLElement | null = null;

    constructor(app: App, options: PreviewModalOptions) {
        super(app);
        this.options = options;
        this.renderer = new PreviewRenderer();
        this.calculator = new SplitCalculator();

        // Initialize state
        this.state = {
            imageData: options.imageData,
            originalImageData: options.imageData, // Store original for processing
            image: null,
            config: options.config,
            splitPositions: [],
            customSplitPositions: null,
            pageRegions: [],
            highlightedRegion: null,
            transformations: [],
            isLoading: true,
            error: null,
            scale: 1.0
        };

        // Initialize interaction state
        this.interaction = {
            isDragging: false,
            draggedLineIndex: null,
            dragStartPosition: null,
            hoveredRegion: null,
            hoveredLine: null
        };
    }

    /**
     * Initialize modal UI when opened
     */
    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('preprocessing-preview-modal');

        // Create modal header
        this.createHeader(contentEl);

        // Create canvas container
        this.canvasContainerEl = contentEl.createDiv({ cls: 'preview-canvas-container' });

        // Create canvas element
        this.canvasEl = this.canvasContainerEl.createEl('canvas', { cls: 'preview-canvas' });

        // Create loading indicator
        const loadingEl = this.canvasContainerEl.createDiv({ cls: 'preview-loading' });
        loadingEl.setText('Loading preview...');

        // Create transformation summary container
        const summaryEl = contentEl.createDiv({ cls: 'preview-transformation-summary' });

        // Create button container
        this.createButtons(contentEl);

        // Load and render preview
        this.loadAndRenderPreview(loadingEl, summaryEl);
    }

    /**
     * Cleanup resources when modal is closed
     */
    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Clear state
        this.state.image = null;
        this.canvasEl = null;
        this.canvasContainerEl = null;
    }

    /**
     * Create modal header with config name and description
     */
    private createHeader(containerEl: HTMLElement): void {
        const headerEl = containerEl.createDiv({ cls: 'preview-header' });

        headerEl.createEl('h2', { text: 'Preprocessing Preview' });

        const configInfoEl = headerEl.createDiv({ cls: 'preview-config-info' });
        configInfoEl.createEl('strong', { text: `Configuration: ${this.state.config.name}` });

        if (this.state.config.description) {
            configInfoEl.createEl('p', {
                text: this.state.config.description,
                cls: 'preview-config-description'
            });
        }
    }

    /**
     * Create button controls
     */
    private createButtons(containerEl: HTMLElement): void {
        const buttonContainer = containerEl.createDiv({ cls: 'preview-button-container' });

        if (this.options.mode === 'processing') {
            // Processing mode: Show Process and Cancel buttons
            const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
            cancelBtn.addEventListener('click', () => this.handleCancel());

            const processBtn = buttonContainer.createEl('button', {
                text: 'Process',
                cls: 'mod-cta'
            });
            processBtn.addEventListener('click', () => this.handleConfirm());
        } else {
            // Testing mode: Show Close Preview button
            const closeBtn = buttonContainer.createEl('button', {
                text: 'Close Preview',
                cls: 'mod-cta'
            });
            closeBtn.addEventListener('click', () => this.handleCancel());
        }
    }

    /**
     * Load image and render preview
     */
    private async loadAndRenderPreview(loadingEl: HTMLElement, summaryEl: HTMLElement): Promise<void> {
        try {
            // Downscale image if needed for preview
            const downscaleResult = await this.downscaleImage(this.state.imageData);
            this.state.imageData = downscaleResult.preview;
            this.state.originalImageData = downscaleResult.original;
            this.state.scale = downscaleResult.scale;

            // Load image from ArrayBuffer
            const image = await this.loadImage(this.state.imageData);
            this.state.image = image;
            this.state.isLoading = false;

            // Hide loading indicator
            loadingEl.style.display = 'none';

            // Calculate split positions
            if (this.state.config.split.enabled) {
                this.state.splitPositions = this.calculator.calculateDefaultPositions(
                    image.width,
                    image.height,
                    this.state.config.split
                );

                // Calculate page regions
                this.state.pageRegions = this.calculator.calculatePageRegions(
                    image.width,
                    image.height,
                    this.state.splitPositions,
                    this.state.config.split.direction
                );
            } else {
                // No splitting - single page region
                this.state.splitPositions = [0];
                this.state.pageRegions = [{
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                    pageNumber: 1
                }];
            }

            // Generate transformation list
            this.state.transformations = this.renderer.generateTransformations(this.state.config);

            // Display transformation summary
            this.displayTransformationSummary(summaryEl);

            // Render preview
            this.renderPreview();

            // Setup interaction handlers
            this.setupInteraction();

        } catch (error) {
            this.state.error = error.message;
            this.state.isLoading = false;
            loadingEl.setText(`Error loading preview: ${error.message}`);
            loadingEl.style.color = 'var(--text-error)';
        }
    }

    /**
     * Load image from ArrayBuffer
     */
    private loadImage(imageData: ArrayBuffer): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const blob = new Blob([imageData], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            img.src = url;
        });
    }

    /**
     * Downscale image for preview if it's too large
     * Images larger than 2000px in any dimension are downscaled to max 1500px
     * Returns preview image data, original image data, and scale factor
     */
    private async downscaleImage(imageData: ArrayBuffer): Promise<{
        preview: ArrayBuffer;
        original: ArrayBuffer;
        scale: number;
    }> {
        // Load the image to check dimensions
        const img = await this.loadImage(imageData);

        // Check if downscaling is needed
        if (img.width <= 2000 && img.height <= 2000) {
            return {
                preview: imageData,
                original: imageData,
                scale: 1.0
            };
        }

        // Calculate scale to fit within 1500px max dimension
        const scale = Math.min(1500 / img.width, 1500 / img.height);
        const previewWidth = Math.floor(img.width * scale);
        const previewHeight = Math.floor(img.height * scale);

        // Create canvas for downscaling
        const canvas = document.createElement('canvas');
        canvas.width = previewWidth;
        canvas.height = previewHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context');
        }

        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw downscaled image
        ctx.drawImage(img, 0, 0, previewWidth, previewHeight);

        // Convert canvas to ArrayBuffer
        const previewData = await this.canvasToArrayBuffer(canvas);

        return {
            preview: previewData,
            original: imageData,
            scale
        };
    }

    /**
     * Convert canvas to ArrayBuffer
     */
    private canvasToArrayBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to convert canvas to blob'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = () => {
                    resolve(reader.result as ArrayBuffer);
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read blob'));
                };
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', 0.95);
        });
    }

    /**
     * Get the original full-resolution image data for processing
     */
    public getOriginalImageData(): ArrayBuffer {
        return this.state.originalImageData;
    }

    /**
     * Render the preview on canvas
     */
    private renderPreview(): void {
        if (!this.canvasEl || !this.state.image) {
            return;
        }

        // Use custom split positions if available
        const splitPositions = this.state.customSplitPositions || this.state.splitPositions;

        // Recalculate page regions if using custom positions
        let pageRegions = this.state.pageRegions;
        if (this.state.customSplitPositions && this.state.config.split.enabled) {
            pageRegions = this.calculator.calculatePageRegions(
                this.state.image.width,
                this.state.image.height,
                this.state.customSplitPositions,
                this.state.config.split.direction
            );
        }

        // Render using PreviewRenderer
        this.renderer.render({
            canvas: this.canvasEl,
            image: this.state.image,
            config: this.state.config,
            splitPositions: splitPositions,
            highlightedRegion: this.state.highlightedRegion ?? undefined,
            pageRegions: pageRegions,
            transformations: this.state.transformations
        });
    }

    /**
     * Display transformation summary
     */
    private displayTransformationSummary(summaryEl: HTMLElement): void {
        summaryEl.empty();

        const titleEl = summaryEl.createEl('h3', { text: 'Transformations:' });

        if (this.state.transformations.length === 0) {
            summaryEl.createEl('p', { text: 'No transformations configured' });
            return;
        }

        const listEl = summaryEl.createEl('ul', { cls: 'preview-transformation-list' });

        this.state.transformations.forEach(transformation => {
            listEl.createEl('li', { text: transformation });
        });

        // Add tip for interactive features
        if (this.state.config.split.enabled) {
            const tipEl = summaryEl.createDiv({ cls: 'preview-tip' });
            tipEl.createEl('span', { text: '💡 Tip: Drag split lines to adjust positions' });
        }
    }

    /**
     * Setup interaction handlers for dragging and hovering
     */
    private setupInteraction(): void {
        if (!this.canvasEl) {
            return;
        }

        // Mouse event handlers
        this.canvasEl.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvasEl.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvasEl.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvasEl.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }

    /**
     * Handle mouse down event
     */
    private handleMouseDown(event: MouseEvent): void {
        if (!this.canvasEl || !this.state.image || !this.state.config.split.enabled) {
            return;
        }

        const rect = this.canvasEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate scale
        const scale = this.renderer.calculateScale(
            this.state.image.width,
            this.state.image.height,
            this.canvasEl.width,
            this.canvasEl.height
        );

        // Convert to image coordinates
        const imageX = x / scale;
        const imageY = y / scale;

        // Find closest split line
        const splitPositions = this.state.customSplitPositions || this.state.splitPositions;
        const lineIndex = this.calculator.findClosestSplitLine(
            imageX,
            imageY,
            splitPositions,
            this.state.config.split.direction,
            20 / scale // 20px threshold in screen coordinates
        );

        if (lineIndex !== null) {
            this.interaction.isDragging = true;
            this.interaction.draggedLineIndex = lineIndex;
            this.interaction.dragStartPosition = { x: imageX, y: imageY };
            this.canvasEl.style.cursor = 'grabbing';
        }
    }

    /**
     * Handle mouse move event
     */
    private handleMouseMove(event: MouseEvent): void {
        if (!this.canvasEl || !this.state.image) {
            return;
        }

        const rect = this.canvasEl.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate scale
        const scale = this.renderer.calculateScale(
            this.state.image.width,
            this.state.image.height,
            this.canvasEl.width,
            this.canvasEl.height
        );

        // Convert to image coordinates
        const imageX = x / scale;
        const imageY = y / scale;

        if (this.interaction.isDragging && this.interaction.draggedLineIndex !== null) {
            // Update split line position
            const newPositions = [...(this.state.customSplitPositions || this.state.splitPositions)];

            if (this.state.config.split.direction === 'vertical') {
                newPositions[this.interaction.draggedLineIndex] = Math.round(imageX);
            } else {
                newPositions[this.interaction.draggedLineIndex] = Math.round(imageY);
            }

            // Validate new positions
            const validation = this.calculator.validateSplitPositions(
                this.state.image.width,
                this.state.image.height,
                newPositions,
                this.state.config.split.direction
            );

            if (validation.valid) {
                this.state.customSplitPositions = newPositions;
                this.renderPreview();
            }
        } else if (this.state.config.split.enabled) {
            // Check if hovering over a split line
            const splitPositions = this.state.customSplitPositions || this.state.splitPositions;
            const lineIndex = this.calculator.findClosestSplitLine(
                imageX,
                imageY,
                splitPositions,
                this.state.config.split.direction,
                20 / scale
            );

            if (lineIndex !== null) {
                this.canvasEl.style.cursor = 'grab';
            } else {
                this.canvasEl.style.cursor = 'default';
            }
        }
    }

    /**
     * Handle mouse up event
     */
    private handleMouseUp(event: MouseEvent): void {
        if (this.interaction.isDragging) {
            this.interaction.isDragging = false;
            this.interaction.draggedLineIndex = null;
            this.interaction.dragStartPosition = null;

            if (this.canvasEl) {
                this.canvasEl.style.cursor = 'default';
            }
        }
    }

    /**
     * Handle confirm button click
     * Note: The original full-resolution image data is stored in state.originalImageData
     * and can be accessed via getOriginalImageData() for processing
     */
    private handleConfirm(): void {
        if (this.options.onConfirm) {
            this.options.onConfirm(this.state.customSplitPositions || undefined);
        }
        this.close();
    }

    /**
     * Handle cancel button click
     */
    private handleCancel(): void {
        if (this.options.onCancel) {
            this.options.onCancel();
        }
        this.close();
    }
}
