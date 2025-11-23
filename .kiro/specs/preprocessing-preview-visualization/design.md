# Design Document

## Overview

The Preprocessing Preview Visualization feature adds a visual preview system to the Notebook OCR Plugin's image preprocessing pipeline. This feature addresses user confusion about preprocessing transformations by providing real-time visual feedback showing exactly how images will be split and rotated before OCR processing begins.

The design introduces a new `PreprocessingPreviewModal` component that displays the source image with visual overlays (split lines, rotation indicators, page labels) and supports interactive adjustment of split positions. The preview integrates into two workflows: (1) during image processing after configuration selection, and (2) in the configuration editor for testing configurations with sample images.

## Architecture

The preview system follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface Layer                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │      PreprocessingPreviewModal (Obsidian Modal)   │  │
│  │  - Canvas rendering                               │  │
│  │  - User interaction handling                      │  │
│  │  - Button controls                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Visualization Layer                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │         PreviewRenderer                           │  │
│  │  - Draw split lines                               │  │
│  │  - Draw rotation indicators                       │  │
│  │  - Draw page labels                               │  │
│  │  - Handle canvas scaling                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Calculation Layer                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │         SplitCalculator                           │  │
│  │  - Calculate split positions                      │  │
│  │  - Validate split positions                       │  │
│  │  - Calculate page dimensions                      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                 Existing Components                      │
│  - PreprocessingManager                                  │
│  - ImageSplitter                                         │
│  - ImageRotator                                          │
│  - PreprocessingConfigManager                            │
└─────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Config Selection Modal**: After user selects a configuration, opens preview modal before processing
2. **Config Editor Modal**: Adds "Preview with Sample Image" button that opens preview modal
3. **Main Plugin**: Passes custom split positions from preview to preprocessing pipeline

## Components and Interfaces

### PreprocessingPreviewModal

Modal component that displays the preview and handles user interaction.

```typescript
interface PreviewModalOptions {
    imageData: ArrayBuffer;
    config: PreprocessingConfig;
    mode: 'processing' | 'testing';
    onConfirm?: (customSplitPositions?: number[]) => void;
    onCancel?: () => void;
}

class PreprocessingPreviewModal extends Modal {
    private imageData: ArrayBuffer;
    private config: PreprocessingConfig;
    private mode: 'processing' | 'testing';
    private renderer: PreviewRenderer;
    private calculator: SplitCalculator;
    private customSplitPositions: number[] | null;
    private isDragging: boolean;
    private draggedLineIndex: number;

    constructor(app: App, options: PreviewModalOptions);

    onOpen(): void;
    onClose(): void;

    private renderPreview(): Promise<void>;
    private setupInteraction(): void;
    private handleMouseDown(event: MouseEvent): void;
    private handleMouseMove(event: MouseEvent): void;
    private handleMouseUp(event: MouseEvent): void;
    private handleConfirm(): void;
    private handleCancel(): void;
}
```

### PreviewRenderer

Handles all canvas drawing operations for the preview.

```typescript
interface RenderOptions {
    canvas: HTMLCanvasElement;
    image: HTMLImageElement;
    config: PreprocessingConfig;
    splitPositions?: number[];
    highlightedRegion?: number;
}

class PreviewRenderer {
    private readonly SPLIT_LINE_COLOR = '#FF6B6B';
    private readonly SPLIT_LINE_WIDTH = 3;
    private readonly PAGE_LABEL_COLOR = '#4ECDC4';
    private readonly PAGE_REGION_COLORS = ['rgba(78, 205, 196, 0.1)', 'rgba(255, 107, 107, 0.1)', 'rgba(255, 195, 0, 0.1)', 'rgba(155, 89, 182, 0.1)'];

    render(options: RenderOptions): void;

    private drawImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement): void;
    private drawSplitLines(ctx: CanvasRenderingContext2D, positions: number[], direction: SplitDirection, imageDimensions: {width: number, height: number}): void;
    private drawPageLabels(ctx: CanvasRenderingContext2D, regions: PageRegion[], config: PreprocessingConfig): void;
    private drawRotationIndicators(ctx: CanvasRenderingContext2D, regions: PageRegion[], config: PreprocessingConfig): void;
    private drawPageRegions(ctx: CanvasRenderingContext2D, regions: PageRegion[], highlightedIndex?: number): void;
    private drawTransformationSummary(ctx: CanvasRenderingContext2D, transformations: string[]): void;

    private calculateScale(imageWidth: number, imageHeight: number, maxWidth: number, maxHeight: number): number;
}

interface PageRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    pageNumber: number;
}
```

### SplitCalculator

Calculates split positions and validates them.

```typescript
class SplitCalculator {
    private readonly MIN_PAGE_DIMENSION = 100;

    /**
     * Calculate default split positions based on configuration
     */
    calculateDefaultPositions(
        imageWidth: number,
        imageHeight: number,
        config: SplitConfig
    ): number[];

    /**
     * Calculate page regions from split positions
     */
    calculatePageRegions(
        imageWidth: number,
        imageHeight: number,
        splitPositions: number[],
        direction: SplitDirection
    ): PageRegion[];

    /**
     * Validate that split positions create valid pages
     */
    validateSplitPositions(
        imageWidth: number,
        imageHeight: number,
        splitPositions: number[],
        direction: SplitDirection
    ): { valid: boolean; error?: string };

    /**
     * Find the closest split line to a point
     */
    findClosestSplitLine(
        x: number,
        y: number,
        splitPositions: number[],
        direction: SplitDirection,
        threshold: number
    ): number | null;
}
```

### Extended ImageSplitter

Add support for custom split positions to the existing `ImageSplitter` class.

```typescript
interface SplitConfig {
    enabled: boolean;
    direction: SplitDirection;
    pageCount: number;
    customPositions?: number[];  // NEW: Custom split positions in pixels
}

class ImageSplitter {
    // Existing methods...

    /**
     * Split an image using custom positions
     * NEW METHOD
     */
    async splitWithCustomPositions(
        imageData: ArrayBuffer,
        direction: SplitDirection,
        positions: number[]
    ): Promise<ArrayBuffer[]>;
}
```

## Data Models

### PreviewState

```typescript
interface PreviewState {
    imageData: ArrayBuffer;
    image: HTMLImageElement | null;
    config: PreprocessingConfig;
    splitPositions: number[];
    customSplitPositions: number[] | null;
    pageRegions: PageRegion[];
    highlightedRegion: number | null;
    transformations: string[];
    isLoading: boolean;
    error: string | null;
}
```

### InteractionState

```typescript
interface InteractionState {
    isDragging: boolean;
    draggedLineIndex: number | null;
    dragStartPosition: { x: number; y: number } | null;
    hoveredRegion: number | null;
    hoveredLine: number | null;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property 1: Preview modal displays for split-enabled configurations
*For any* preprocessing configuration with splitting enabled, when a user selects that configuration, the system should display a preview modal showing the source image with split lines overlaid at the calculated positions
**Validates: Requirements 1.1**

Property 2: Vertical split lines are rendered correctly
*For any* preprocessing configuration with vertical split direction, the preview should draw vertical lines (constant x-coordinate, spanning full image height) at each split position
**Validates: Requirements 1.2**

Property 3: Horizontal split lines are rendered correctly
*For any* preprocessing configuration with horizontal split direction, the preview should draw horizontal lines (constant y-coordinate, spanning full image width) at each split position
**Validates: Requirements 1.3**

Property 4: Page regions are labeled with page numbers
*For any* split configuration, the preview should display a label for each resulting page region containing the correct page number (1-indexed, sequential)
**Validates: Requirements 1.4**

Property 5: Image scaling preserves aspect ratio
*For any* source image, when the preview scales the image to fit the modal, the aspect ratio (width/height) of the displayed image should equal the aspect ratio of the original image
**Validates: Requirements 1.5**

Property 6: Before-split rotation is indicated
*For any* configuration with rotation enabled and timing set to before-split, the preview should display the rotation angle indicator showing the whole-image rotation angle
**Validates: Requirements 2.1**

Property 7: After-split rotation indicators are displayed per page
*For any* configuration with rotation enabled and timing set to after-split, the preview should display a rotation indicator on each page region showing that page's rotation angle
**Validates: Requirements 2.2**

Property 8: Rotation indicator format includes angle and direction
*For any* non-zero rotation angle, the rotation indicator should include both the numeric angle value in degrees and a directional symbol (e.g., "90° ↻")
**Validates: Requirements 2.4**

Property 9: Split line dragging updates positions
*For any* split line in the preview, when a user drags that line to a new valid position, the split line position should update to the dragged position
**Validates: Requirements 3.1**

Property 10: Dragging updates page region labels
*For any* split line drag operation, the page region labels should be recalculated and updated in real-time to reflect the new split positions
**Validates: Requirements 3.2**

Property 11: Invalid split positions are rejected
*For any* split position adjustment that would create a page with dimensions below the minimum threshold (100px), the system should reject the adjustment and maintain the previous valid positions
**Validates: Requirements 3.3**

Property 12: Custom split positions are used for processing
*For any* image processed after adjusting split positions in the preview, the preprocessing should use the custom split positions instead of the default calculated positions
**Validates: Requirements 3.4**

Property 13: Preview displays before OCR processing
*For any* preprocessing configuration selected (except "No preprocessing"), the preview modal should open and display before any OCR processing begins
**Validates: Requirements 4.1**

Property 14: Process button triggers OCR with configuration
*For any* preview modal in processing mode, when the user clicks the "Process" button, the modal should close and OCR processing should begin using the displayed configuration (including any custom split positions)
**Validates: Requirements 4.3**

Property 15: Cancel button returns to configuration selection
*For any* preview modal in processing mode, when the user clicks the "Cancel" button, the modal should close and the configuration selection modal should reopen
**Validates: Requirements 4.4**

Property 16: Sample image preview button triggers file selection
*For any* config editor modal, when the user clicks the "Preview with Sample Image" button, the system should prompt the user to select an image file
**Validates: Requirements 5.2**

Property 17: Selected sample image displays with transformations
*For any* image file selected for preview testing, the preview modal should display that image with the current configuration's transformations applied (split lines, rotation indicators, etc.)
**Validates: Requirements 5.3**

Property 18: Configuration metadata displayed in preview
*For any* preview modal, the configuration name and description should be displayed at the top of the preview
**Validates: Requirements 5.4**

Property 19: Close preview returns to config editor
*For any* preview modal opened from the config editor (testing mode), when the user clicks "Close Preview", the modal should close and return to the config editor without processing the image
**Validates: Requirements 5.5**

Property 20: Transformation summary displays with numbering
*For any* preprocessing configuration, the preview should display a transformation summary listing all operations in execution order with sequential numbering (e.g., "1. Rotate 90°", "2. Split vertically into 2 pages")
**Validates: Requirements 6.1, 6.2**

Property 21: Page regions use distinct visual separation
*For any* split configuration with multiple pages, each page region in the preview should have a distinct color or pattern to visually differentiate it from adjacent regions
**Validates: Requirements 6.4**

Property 22: Hover highlights region and shows dimensions
*For any* page region in the preview, when the user hovers over that region, the system should highlight the region and display its dimensions in pixels
**Validates: Requirements 6.5**

Property 23: Large images are downscaled for preview
*For any* image with width or height exceeding 2000px, the preview should display a downscaled version rather than the full-resolution image
**Validates: Requirements 7.1**

Property 24: Downscaling preserves aspect ratio
*For any* image that is downscaled for preview, the aspect ratio of the downscaled version should equal the aspect ratio of the original image
**Validates: Requirements 7.2**

Property 25: Loading indicator displays during preparation
*For any* preview modal opening, a loading indicator should be visible from the moment the modal opens until the preview image is fully prepared and rendered
**Validates: Requirements 7.3**

Property 26: Processing uses full-resolution image
*For any* image that was downscaled for preview display, when the user processes that image, the preprocessing and OCR should operate on the original full-resolution image data, not the downscaled preview version
**Validates: Requirements 7.5**

## Error Handling

### Preview Generation Errors

**Image Loading Failures**
- If the source image fails to load, display an error message in the preview modal: "Failed to load image for preview"
- Provide a "Retry" button to attempt loading again
- Provide a "Cancel" button to return to the previous screen

**Canvas Rendering Errors**
- If canvas context cannot be obtained, fall back to displaying the image without overlays
- Show a warning message: "Preview overlays unavailable - showing image only"
- Allow user to proceed with processing or cancel

**Invalid Configuration Errors**
- If the configuration is invalid (e.g., split positions would create pages below minimum dimensions), display validation errors in the preview
- Highlight the problematic split lines in red
- Disable the "Process" button until the configuration is valid
- Show specific error messages (e.g., "Page 2 would be only 50px wide (minimum: 100px)")

### Interaction Errors

**Drag Validation Failures**
- When user attempts to drag a split line to an invalid position, snap the line back to the nearest valid position
- Show a temporary tooltip: "Cannot place split line here - resulting page would be too small"
- Provide visual feedback (e.g., red highlight) when hovering over invalid positions

**File Selection Errors**
- If user cancels file selection for sample image preview, return to config editor without showing error
- If selected file is not a valid image, show error: "Invalid image file. Please select a JPEG, PNG, or other supported image format"
- If selected file is too large (>50MB), show warning: "Large image file may take longer to preview"

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

**PreviewRenderer Tests**
- Test split line rendering for each direction (vertical, horizontal)
- Test page label positioning and numbering
- Test rotation indicator rendering and formatting
- Test color assignment for page regions
- Test transformation summary generation
- Test edge case: no transformations configured
- Test edge case: rotation angle is 0 degrees

**SplitCalculator Tests**
- Test default position calculation for various page counts (2, 3, 4)
- Test page region calculation from split positions
- Test validation of split positions (valid and invalid cases)
- Test finding closest split line to a point
- Test edge case: split positions at image boundaries
- Test edge case: minimum dimension validation

**PreprocessingPreviewModal Tests**
- Test modal opening and closing
- Test button click handlers (Process, Cancel, Close Preview)
- Test mode switching (processing vs testing)
- Test custom split position storage and retrieval
- Test integration with file selection for sample images

### Property-Based Testing

Property-based tests will verify universal properties across many inputs using a PBT library (fast-check for TypeScript):

**Property Test Configuration**
- Use fast-check library for property-based testing
- Run each property test for a minimum of 100 iterations
- Generate random configurations, images, and split positions for comprehensive coverage

**Test Generators**
- `arbitraryPreprocessingConfig()`: Generate random valid preprocessing configurations
- `arbitraryImageDimensions()`: Generate random image dimensions (100px to 5000px)
- `arbitrarySplitPositions()`: Generate random split positions within valid ranges
- `arbitraryRotationAngle()`: Generate random rotation angles (0°, 90°, 180°, 270°)

Each property-based test will be tagged with a comment referencing the correctness property it implements, using the format: `**Feature: preprocessing-preview-visualization, Property N: [property text]**`

## UI/UX Considerations

### Modal Layout

```
┌─────────────────────────────────────────────────────────┐
│  Preprocessing Preview                              [X]  │
│  Configuration: Pocket Notebooks Side-by-Side            │
│  Two pocket notebook pages scanned horizontally...       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │                                                  │    │
│  │                                                  │    │
│  │              [Preview Canvas]                   │    │
│  │         (Image with overlays)                   │    │
│  │                                                  │    │
│  │                                                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  Transformations:                                        │
│  1. Split vertically into 2 pages                       │
│                                                          │
│  💡 Tip: Drag split lines to adjust positions           │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                          [Cancel]  [Process]             │
└─────────────────────────────────────────────────────────┘
```

### Visual Design

**Split Lines**
- Color: #FF6B6B (red)
- Width: 3px
- Style: Solid line with small circular handles at midpoint for dragging
- Hover effect: Increase width to 5px, show cursor: grab

**Page Labels**
- Position: Top-left corner of each page region
- Background: Semi-transparent rounded rectangle (#4ECDC4 with 80% opacity)
- Text: White, bold, "Page 1", "Page 2", etc.
- Font size: 16px

**Page Regions**
- Colors: Rotate through 4 colors with 10% opacity
  - Page 1: rgba(78, 205, 196, 0.1) - Teal
  - Page 2: rgba(255, 107, 107, 0.1) - Red
  - Page 3: rgba(255, 195, 0, 0.1) - Yellow
  - Page 4: rgba(155, 89, 182, 0.1) - Purple
- Hover effect: Increase opacity to 20%, show border

**Rotation Indicators**
- Position: Bottom-right corner of each page region
- Icon: Circular arrow (↻ for clockwise)
- Text: Angle in degrees (e.g., "90°")
- Background: Semi-transparent rounded rectangle
- Color: #4ECDC4

**Transformation Summary**
- Position: Below preview canvas
- Style: Numbered list with icons
- Font: 14px, regular weight
- Color: Default text color

### Responsive Behavior

**Modal Sizing**
- Default: 80% of viewport width, 80% of viewport height
- Minimum: 600px width, 400px height
- Maximum: 1200px width, 900px height
- Canvas: Scales to fit available space while maintaining aspect ratio

**Mobile Considerations**
- On mobile devices, modal takes full screen
- Touch gestures for dragging split lines
- Larger touch targets (handles) for split lines (minimum 44px)
- Simplified transformation summary (icons only, text on tap)

## Performance Considerations

### Image Downscaling

**Downscaling Strategy**
- Images larger than 2000px in any dimension are downscaled for preview
- Use canvas-based downscaling with high-quality interpolation
- Target preview size: 1500px maximum dimension
- Maintain original image data separately for processing

**Downscaling Implementation**
```typescript
private async downscaleImage(imageData: ArrayBuffer): Promise<{
    preview: ArrayBuffer;
    original: ArrayBuffer;
    scale: number;
}> {
    const img = await this.loadImage(imageData);

    if (img.width <= 2000 && img.height <= 2000) {
        return {
            preview: imageData,
            original: imageData,
            scale: 1.0
        };
    }

    const scale = Math.min(1500 / img.width, 1500 / img.height);
    const previewWidth = Math.floor(img.width * scale);
    const previewHeight = Math.floor(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = previewWidth;
    canvas.height = previewHeight;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, previewWidth, previewHeight);

    const previewData = await this.canvasToArrayBuffer(canvas);

    return {
        preview: previewData,
        original: imageData,
        scale
    };
}
```

### Canvas Rendering Optimization

**Rendering Strategy**
- Use requestAnimationFrame for smooth drag interactions
- Debounce hover events (100ms) to reduce re-renders
- Cache rendered elements (page labels, rotation indicators) when possible
- Only re-render affected regions during drag operations

**Memory Management**
- Revoke object URLs immediately after image loading
- Clear canvas before re-rendering
- Dispose of temporary canvases after use
- Limit preview history to prevent memory leaks

### Loading Performance

**Progressive Loading**
1. Show modal with loading indicator immediately
2. Load and downscale image (if needed)
3. Calculate split positions and page regions
4. Render image on canvas
5. Render overlays (split lines, labels, indicators)
6. Hide loading indicator

**Target Performance**
- Modal open to first render: <500ms
- Image loading and downscaling: <1s for images under 10MB
- Drag interaction response: <16ms (60fps)
- Hover interaction response: <100ms

## Integration with Existing System

### Modified Components

**ConfigSelectionModal**
- Add preview modal invocation after configuration selection
- Pass selected configuration to preview modal
- Handle preview modal callbacks (confirm/cancel)

```typescript
// In ConfigSelectionModal
private handleConfigSelection(configId: string | null): void {
    if (configId === null) {
        // No preprocessing - skip preview
        this.onSelect(null);
        this.close();
        return;
    }

    // Open preview modal
    const previewModal = new PreprocessingPreviewModal(this.app, {
        imageData: this.imageData,
        config: this.getConfig(configId),
        mode: 'processing',
        onConfirm: (customSplitPositions) => {
            this.onSelect(configId, customSplitPositions);
            this.close();
        },
        onCancel: () => {
            // Return to config selection
            this.open();
        }
    });

    this.close();
    previewModal.open();
}
```

**ConfigEditorModal**
- Add "Preview with Sample Image" button
- Handle file selection for sample image
- Open preview modal in testing mode

```typescript
// In ConfigEditorModal
private addPreviewButton(containerEl: HTMLElement): void {
    new Setting(containerEl)
        .setName('Preview Configuration')
        .setDesc('Test this configuration with a sample image')
        .addButton(button => button
            .setButtonText('Preview with Sample Image')
            .onClick(async () => {
                const file = await this.selectImageFile();
                if (!file) return;

                const imageData = await file.arrayBuffer();

                const previewModal = new PreprocessingPreviewModal(this.app, {
                    imageData,
                    config: this.config,
                    mode: 'testing',
                    onConfirm: () => {
                        // Testing mode - just close preview
                        new Notice('Preview closed - configuration not saved');
                    },
                    onCancel: () => {
                        // Return to config editor
                        this.open();
                    }
                });

                this.close();
                previewModal.open();
            }));
}

private async selectImageFile(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            resolve(input.files?.[0] || null);
        };
        input.click();
    });
}
```

**ImageSplitter**
- Add support for custom split positions
- Modify split() method to accept optional custom positions

```typescript
// In ImageSplitter
async split(imageData: ArrayBuffer, config: SplitConfig): Promise<ArrayBuffer[]> {
    if (!config.enabled) {
        return [imageData];
    }

    const img = await this.loadImage(imageData);
    const pages: ArrayBuffer[] = [];

    // Use custom positions if provided, otherwise calculate default positions
    const positions = config.customPositions || this.calculateDefaultPositions(img, config);

    if (config.direction === SplitDirection.HORIZONTAL) {
        for (let i = 0; i < positions.length; i++) {
            const y = positions[i];
            const nextY = positions[i + 1] || img.height;
            const height = nextY - y;

            const pageData = await this.extractRegion(img, 0, y, img.width, height);
            pages.push(pageData);
        }
    } else {
        for (let i = 0; i < positions.length; i++) {
            const x = positions[i];
            const nextX = positions[i + 1] || img.width;
            const width = nextX - x;

            const pageData = await this.extractRegion(img, x, 0, width, img.height);
            pages.push(pageData);
        }
    }

    return pages;
}

private calculateDefaultPositions(img: HTMLImageElement, config: SplitConfig): number[] {
    const positions: number[] = [0];

    if (config.direction === SplitDirection.HORIZONTAL) {
        const pageHeight = Math.floor(img.height / config.pageCount);
        for (let i = 1; i < config.pageCount; i++) {
            positions.push(i * pageHeight);
        }
    } else {
        const pageWidth = Math.floor(img.width / config.pageCount);
        for (let i = 1; i < config.pageCount; i++) {
            positions.push(i * pageWidth);
        }
    }

    return positions;
}
```

**Main Plugin (processImages method)**
- Pass custom split positions from preview to preprocessing
- Store custom positions in preprocessing result

```typescript
// In main plugin
private async processImages(files: File[]): Promise<void> {
    // ... existing code ...

    const selectedConfigId = await new Promise<{
        configId: string | null;
        customSplitPositions?: number[];
    }>((resolve) => {
        const modal = new ConfigSelectionModal(this.app, this, (configId, customSplitPositions) => {
            resolve({ configId, customSplitPositions });
        });
        modal.open();
    });

    // ... existing code ...

    // Pass custom split positions to preprocessing
    const ocrResults = await this.processImageWithPreprocessing(
        imageData,
        file.name,
        selectedConfigId.configId,
        selectedConfigId.customSplitPositions
    );

    // ... existing code ...
}

private async processImageWithPreprocessing(
    imageData: ArrayBuffer,
    fileName: string,
    configId?: string,
    customSplitPositions?: number[]
): Promise<OCRResult[]> {
    // ... existing code ...

    // If custom split positions provided, add them to config
    if (customSplitPositions && config.split.enabled) {
        config.split.customPositions = customSplitPositions;
    }

    // ... existing code ...
}
```

### New Files

**preprocessing-preview-modal.ts**
- PreprocessingPreviewModal class
- Modal UI and interaction handling

**preview-renderer.ts**
- PreviewRenderer class
- Canvas drawing operations

**split-calculator.ts**
- SplitCalculator class
- Position calculation and validation

### Updated Type Definitions

**preprocessing-types.ts**
- Add customPositions field to SplitConfig interface
- Add PreviewModalOptions interface
- Add InteractionState interface
- Add PreviewState interface

## Future Enhancements

### Phase 2 Features (Not in Current Scope)

**Advanced Split Adjustment**
- Support for non-uniform splits (different page widths/heights)
- Visual grid overlay for precise positioning
- Snap-to-grid functionality
- Undo/redo for split adjustments

**Rotation Preview**
- Show actual rotated image preview (not just indicators)
- Support for custom rotation angles (not just 90° increments)
- Interactive rotation handles

**Batch Preview**
- Preview multiple images at once
- Apply same custom split positions to all images in batch
- Side-by-side comparison of before/after

**Configuration Suggestions**
- Analyze image and suggest optimal configuration
- Detect page boundaries automatically
- Machine learning-based split line detection

**Export/Import**
- Save custom split positions for reuse
- Export preview as image for documentation
- Import split positions from JSON file
