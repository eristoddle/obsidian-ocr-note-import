# Implementation Plan

- [x] 1. Set up core preview infrastructure
  - Create split-calculator.ts with SplitCalculator class
  - Implement calculateDefaultPositions() method for calculating split positions from config
  - Implement calculatePageRegions() method for determining page boundaries
  - Implement validateSplitPositions() method for checking minimum dimensions
  - Implement findClosestSplitLine() method for interaction handling
  - _Requirements: 1.1, 3.1, 3.3_

- [x] 1.1 Write property test for split position calculation
  - **Property 1: Preview modal displays for split-enabled configurations**
  - **Validates: Requirements 1.1**

- [x] 1.2 Write property test for split position validation
  - **Property 11: Invalid split positions are rejected**
  - **Validates: Requirements 3.3**

- [x] 2. Implement preview rendering engine
  - Create preview-renderer.ts with PreviewRenderer class
  - Implement render() method as main entry point for rendering
  - Implement drawImage() method for rendering the source image
  - Implement drawSplitLines() method for drawing split line overlays
  - Implement drawPageLabels() method for labeling page regions
  - Implement drawPageRegions() method for coloring page regions
  - Implement calculateScale() method for fitting image in canvas
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.4_

- [x] 2.1 Write property test for vertical split line rendering
  - **Property 2: Vertical split lines are rendered correctly**
  - **Validates: Requirements 1.2**

- [x] 2.2 Write property test for horizontal split line rendering
  - **Property 3: Horizontal split lines are rendered correctly**
  - **Validates: Requirements 1.3**

- [x] 2.3 Write property test for page label rendering
  - **Property 4: Page regions are labeled with page numbers**
  - **Validates: Requirements 1.4**

- [x] 2.4 Write property test for aspect ratio preservation
  - **Property 5: Image scaling preserves aspect ratio**
  - **Validates: Requirements 1.5**

- [x] 2.5 Write property test for page region visual separation
  - **Property 21: Page regions use distinct visual separation**
  - **Validates: Requirements 6.4**

- [x] 3. Add rotation indicator rendering
  - Implement drawRotationIndicators() method in PreviewRenderer
  - Handle before-split rotation (whole image indicator)
  - Handle after-split rotation (per-page indicators)
  - Format rotation indicators with angle and directional symbol
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 3.1 Write property test for before-split rotation indicators
  - **Property 6: Before-split rotation is indicated**
  - **Validates: Requirements 2.1**

- [x] 3.2 Write property test for after-split rotation indicators
  - **Property 7: After-split rotation indicators are displayed per page**
  - **Validates: Requirements 2.2**

- [x] 3.3 Write property test for rotation indicator format
  - **Property 8: Rotation indicator format includes angle and direction**
  - **Validates: Requirements 2.4**

- [x] 4. Implement transformation summary rendering
  - Implement drawTransformationSummary() method in PreviewRenderer
  - Generate transformation list from config (rotation, split operations)
  - Number transformations in execution order
  - Handle edge case: no transformations configured
  - _Requirements: 6.1, 6.2_

- [x] 4.1 Write property test for transformation summary
  - **Property 20: Transformation summary displays with numbering**
  - **Validates: Requirements 6.1, 6.2**

- [x] 5. Create preprocessing preview modal
  - Create preprocessing-preview-modal.ts with PreprocessingPreviewModal class
  - Extend Obsidian Modal class
  - Implement constructor accepting PreviewModalOptions
  - Implement onOpen() method to initialize modal UI
  - Implement onClose() method to cleanup resources
  - Create modal layout with canvas, buttons, and transformation summary
  - _Requirements: 1.1, 4.1, 4.2_

- [ ] 6. Implement image loading and downscaling
  - Implement loadImage() method in PreprocessingPreviewModal
  - Implement downscaleImage() method for large images (>2000px)
  - Maintain original image data separately from preview
  - Display loading indicator during image preparation
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 6.1 Write property test for image downscaling
  - **Property 23: Large images are downscaled for preview**
  - **Validates: Requirements 7.1**

- [x] 6.2 Write property test for downscaling aspect ratio preservation
  - **Property 24: Downscaling preserves aspect ratio**
  - **Validates: Requirements 7.2**

- [x] 6.3 Write property test for loading indicator display
  - **Property 25: Loading indicator displays during preparation**
  - **Validates: Requirements 7.3**

- [x] 6.4 Write property test for full-resolution processing
  - **Property 26: Processing uses full-resolution image**
  - **Validates: Requirements 7.5**

- [ ] 7. Implement preview rendering in modal
  - Implement renderPreview() method in PreprocessingPreviewModal
  - Create canvas element and get 2D context
  - Calculate split positions using SplitCalculator
  - Calculate page regions using SplitCalculator
  - Call PreviewRenderer.render() with all necessary data
  - Handle rendering errors gracefully
  - _Requirements: 1.1, 1.5_

- [ ] 8. Add interactive split line dragging
  - Implement setupInteraction() method in PreprocessingPreviewModal
  - Add mouse event listeners (mousedown, mousemove, mouseup)
  - Implement handleMouseDown() to detect split line clicks
  - Implement handleMouseMove() to update split line positions during drag
  - Implement handleMouseUp() to finalize drag operation
  - Validate new positions during drag
  - Re-render preview in real-time during drag
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 8.1 Write property test for split line dragging
  - **Property 9: Split line dragging updates positions**
  - **Validates: Requirements 3.1**

- [ ] 8.2 Write property test for real-time label updates
  - **Property 10: Dragging updates page region labels**
  - **Validates: Requirements 3.2**

- [ ] 9. Add hover interaction for page regions
  - Implement hover detection in setupInteraction()
  - Highlight hovered page region
  - Display page dimensions tooltip on hover
  - Debounce hover events (100ms) for performance
  - _Requirements: 6.5_

- [ ] 9.1 Write property test for hover highlighting
  - **Property 22: Hover highlights region and shows dimensions**
  - **Validates: Requirements 6.5**

- [ ] 10. Implement modal button handlers
  - Implement handleConfirm() method for "Process" button
  - Implement handleCancel() method for "Cancel" button
  - Pass custom split positions to onConfirm callback
  - Handle both processing and testing modes
  - Close modal and invoke appropriate callback
  - _Requirements: 4.2, 4.3, 4.4, 5.5_

- [ ] 10.1 Write property test for Process button behavior
  - **Property 14: Process button triggers OCR with configuration**
  - **Validates: Requirements 4.3**

- [ ] 10.2 Write property test for Cancel button behavior
  - **Property 15: Cancel button returns to configuration selection**
  - **Validates: Requirements 4.4**

- [ ] 10.3 Write property test for Close Preview button behavior
  - **Property 19: Close preview returns to config editor**
  - **Validates: Requirements 5.5**

- [ ] 11. Update preprocessing types
  - Add customPositions field to SplitConfig interface in preprocessing-types.ts
  - Add PreviewModalOptions interface
  - Add PreviewState interface
  - Add InteractionState interface
  - Add PageRegion interface
  - _Requirements: 3.4_

- [ ] 12. Integrate preview with config selection modal
  - Modify ConfigSelectionModal to invoke preview modal after config selection
  - Pass image data to preview modal
  - Handle preview confirmation (proceed with OCR)
  - Handle preview cancellation (return to config selection)
  - Skip preview for "No preprocessing" option
  - _Requirements: 4.1, 4.3, 4.4, 4.5_

- [ ] 12.1 Write property test for preview display before OCR
  - **Property 13: Preview displays before OCR processing**
  - **Validates: Requirements 4.1**

- [ ] 13. Add preview button to config editor modal
  - Add "Preview with Sample Image" button to ConfigEditorModal
  - Implement file selection dialog for sample image
  - Open preview modal in testing mode with selected image
  - Display config name and description in preview
  - Handle preview close (return to config editor)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 13.1 Write property test for sample image file selection
  - **Property 16: Sample image preview button triggers file selection**
  - **Validates: Requirements 5.2**

- [ ] 13.2 Write property test for sample image preview display
  - **Property 17: Selected sample image displays with transformations**
  - **Validates: Requirements 5.3**

- [ ] 13.3 Write property test for config metadata display
  - **Property 18: Configuration metadata displayed in preview**
  - **Validates: Requirements 5.4**

- [ ] 14. Update ImageSplitter to support custom positions
  - Modify split() method in ImageSplitter to accept custom positions from config
  - Implement calculateDefaultPositions() helper method
  - Use custom positions if provided, otherwise calculate default positions
  - Update split logic to use position array instead of pageCount calculation
  - _Requirements: 3.4_

- [ ] 14.1 Write property test for custom split positions
  - **Property 12: Custom split positions are used for processing**
  - **Validates: Requirements 3.4**

- [ ] 15. Update main plugin to pass custom split positions
  - Modify ConfigSelectionModal callback to return custom split positions
  - Update processImages() method to receive custom split positions
  - Pass custom split positions to processImageWithPreprocessing()
  - Add custom positions to config before preprocessing
  - _Requirements: 3.4_

- [ ] 16. Add error handling for preview generation
  - Handle image loading failures with error message and retry button
  - Handle canvas rendering errors with fallback (image only, no overlays)
  - Handle invalid configuration errors with validation messages
  - Highlight problematic split lines in red
  - Disable Process button when configuration is invalid
  - _Requirements: 1.1, 3.3_

- [ ] 17. Add error handling for drag interactions
  - Snap split lines to nearest valid position on invalid drag
  - Show tooltip when hovering over invalid positions
  - Provide visual feedback (red highlight) for invalid positions
  - _Requirements: 3.3_

- [ ] 18. Add error handling for file selection
  - Handle file selection cancellation gracefully
  - Validate selected file is a valid image format
  - Show warning for large files (>50MB)
  - _Requirements: 5.2_

- [ ] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Add CSS styling for preview modal
  - Create styles for modal layout and sizing
  - Style split lines (color, width, hover effects)
  - Style page labels (background, text, positioning)
  - Style page regions (colors, hover effects)
  - Style rotation indicators (background, icon, positioning)
  - Style transformation summary (list formatting)
  - Style buttons (Process, Cancel, Close Preview)
  - Add responsive styles for mobile devices
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 6.1, 6.4_

- [ ] 21. Optimize canvas rendering performance
  - Use requestAnimationFrame for drag interactions
  - Debounce hover events (100ms)
  - Cache rendered elements when possible
  - Only re-render affected regions during drag
  - _Requirements: 3.1, 6.5_

- [ ] 22. Optimize memory management
  - Revoke object URLs after image loading
  - Clear canvas before re-rendering
  - Dispose of temporary canvases
  - Limit preview history
  - _Requirements: 7.1, 7.5_

- [ ] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
