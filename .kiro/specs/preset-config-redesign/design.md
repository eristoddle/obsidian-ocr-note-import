# Design Document

## Overview

This design document outlines the redesign of preset preprocessing configurations for the Obsidian OCR plugin. The current system uses paper-size-based naming (A5, pocket notebooks) which is confusing for users. The redesign will:

1. Rename presets to describe their transformations (Split Vertically, Rotate Clockwise, etc.)
2. Remove redundant presets that perform no operations
3. Add missing presets for common scanning scenarios (top spiral notebooks)
4. Improve the configuration selection UI with better default highlighting
5. Add user guidance about centering notebooks during scanning

## Architecture

The redesign maintains the existing architecture with modifications to:

- **preprocessing-types.ts**: Update `NotebookPreset` enum and `PRESET_CONFIGS` constant
- **config-selection-modal.ts**: Enhance UI to highlight default configuration
- **preprocessing-settings-ui.ts**: Add centering guidance text

No changes are needed to the core preprocessing logic in `PreprocessingManager`, `ImageSplitter`, or `ImageRotator` classes, as they already support the required operations.

## Components and Interfaces

### Updated NotebookPreset Enum

```typescript
export enum NotebookPreset {
    NO_PREPROCESSING = 'no-preprocessing',
    SPLIT_VERTICALLY = 'split-vertically',
    ROTATE_90_CLOCKWISE = 'rotate-90-clockwise',
    ROTATE_90_COUNTERCLOCKWISE = 'rotate-90-counterclockwise',
    TOP_SPIRAL_NOTEBOOK = 'top-spiral-notebook',
    CUSTOM = 'custom'
}
```

### Updated Preset Configurations

The `PRESET_CONFIGS` object will be updated with the following presets:

1. **Split Vertically** (replaces "Pocket Notebooks Side-by-Side")
   - Splits image vertically into 2 pages
   - No rotation
   - Use case: Two pages scanned side-by-side

2. **Rotate 90° Clockwise** (replaces "A5 Landscape")
   - Rotates entire image 90° clockwise before processing
   - No splitting
   - Use case: Image scanned in landscape orientation, needs clockwise rotation

3. **Rotate 90° Counterclockwise** (new)
   - Rotates entire image 270° clockwise (equivalent to 90° counterclockwise)
   - No splitting
   - Use case: Image scanned in landscape orientation, needs counterclockwise rotation

4. **Top Spiral Notebook** (new)
   - Splits image horizontally into 2 pages
   - Rotates top page 180° after split
   - Use case: Top-spiral notebook where top page is upside-down

5. **Custom Configuration** (unchanged)
   - User-defined configuration
   - Allows arbitrary split and rotation settings

### Config Selection Modal Updates

The modal will be enhanced to:

1. Keep "No Preprocessing" at the top as a quick option
2. Visually highlight the default configuration with:
   - Bold text or distinctive color
   - "(Default)" label
   - Possibly a visual indicator (icon or background color)
3. Group configurations logically (no preprocessing, then presets, then custom)

### Settings UI Updates

Add a help text section in the preprocessing settings that includes:

```
💡 Tip: For best results, center your notebook on the scanner or camera.
This ensures accurate splitting and reduces the need for manual adjustments.
```

## Data Models

### PreprocessingConfig Structure (unchanged)

The existing `PreprocessingConfig` interface remains unchanged:

```typescript
interface PreprocessingConfig {
    id: string;
    name: string;
    description: string;
    preset: NotebookPreset;
    split: SplitConfig;
    rotation: RotationConfig;
}
```

### New Preset Configuration Definitions

```typescript
[NotebookPreset.SPLIT_VERTICALLY]: {
    id: 'preset-split-vertically',
    name: 'Split Vertically',
    description: 'Split image into two pages side-by-side (left and right)',
    preset: NotebookPreset.SPLIT_VERTICALLY,
    split: {
        enabled: true,
        direction: SplitDirection.VERTICAL,
        pageCount: 2
    },
    rotation: {
        enabled: false,
        timing: RotationTiming.AFTER_SPLIT
    }
}

[NotebookPreset.ROTATE_90_CLOCKWISE]: {
    id: 'preset-rotate-90-clockwise',
    name: 'Rotate 90° Clockwise',
    description: 'Rotate entire image 90 degrees clockwise',
    preset: NotebookPreset.ROTATE_90_CLOCKWISE,
    split: {
        enabled: false,
        direction: SplitDirection.HORIZONTAL,
        pageCount: 1
    },
    rotation: {
        enabled: true,
        timing: RotationTiming.BEFORE_SPLIT,
        wholeImageAngle: RotationAngle.CLOCKWISE_90
    }
}

[NotebookPreset.ROTATE_90_COUNTERCLOCKWISE]: {
    id: 'preset-rotate-90-counterclockwise',
    name: 'Rotate 90° Counterclockwise',
    description: 'Rotate entire image 90 degrees counterclockwise',
    preset: NotebookPreset.ROTATE_90_COUNTERCLOCKWISE,
    split: {
        enabled: false,
        direction: SplitDirection.HORIZONTAL,
        pageCount: 1
    },
    rotation: {
        enabled: true,
        timing: RotationTiming.BEFORE_SPLIT,
        wholeImageAngle: RotationAngle.CLOCKWISE_270
    }
}

[NotebookPreset.TOP_SPIRAL_NOTEBOOK]: {
    id: 'preset-top-spiral-notebook',
    name: 'Top Spiral Notebook',
    description: 'Split horizontally and rotate top page 180° (for top-spiral notebooks)',
    preset: NotebookPreset.TOP_SPIRAL_NOTEBOOK,
    split: {
        enabled: true,
        direction: SplitDirection.HORIZONTAL,
        pageCount: 2
    },
    rotation: {
        enabled: true,
        timing: RotationTiming.AFTER_SPLIT,
        perPageAngles: [RotationAngle.CLOCKWISE_180, RotationAngle.NONE]
    }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transformation-based naming

*For any* preset configuration (excluding CUSTOM), the preset name should contain transformation keywords ("split", "rotate") and should not contain paper size specifications ("A5", "8.5x11", "pocket")
**Validates: Requirements 1.1**

### Property 2: Rotation direction clarity

*For any* preset configuration with rotation enabled, the preset name should contain either "clockwise" or "counterclockwise" to indicate rotation direction
**Validates: Requirements 1.3**

### Property 3: No redundant presets

*For any* preset configuration (excluding NO_PREPROCESSING and CUSTOM), at least one transformation should be enabled (split.enabled=true OR rotation.enabled=true)
**Validates: Requirements 1.4**

### Property 4: Per-page rotation timing

*For any* preset configuration with per-page rotation angles defined (rotation.perPageAngles is not null/undefined), the rotation timing should be set to AFTER_SPLIT
**Validates: Requirements 2.4**

### Property 5: Whole-image rotation excludes splitting

*For any* preset configuration with whole-image rotation (rotation.timing = BEFORE_SPLIT and rotation.wholeImageAngle is defined), splitting should be disabled (split.enabled=false)
**Validates: Requirements 3.4**

### Property 6: Default configuration uniqueness

*For any* list of configurations displayed in the selection modal, exactly one configuration should be marked as default (have "(Default)" in its display name)
**Validates: Requirements 5.4**

## Error Handling

### Configuration Validation Errors

The existing `PreprocessingConfigManager.validateConfig()` method already handles validation errors. No changes are needed to error handling logic.

### Migration Errors

When users upgrade to the new preset system, their saved `defaultPreprocessingConfigId` may reference old preset IDs. The system should:

1. Check if the saved default ID exists in the new preset system
2. If not found, map old IDs to new equivalents:
   - `preset-single-page` → Remove (no longer exists)
   - `preset-pocket-side-by-side` → `preset-split-vertically`
   - `preset-a5-portrait` → Remove (no longer exists)
   - `preset-a5-landscape` → `preset-rotate-90-clockwise`
3. If no mapping exists, fall back to `preset-split-vertically` as the new default
4. Save the migrated default ID

### UI Error States

If no configurations are available (edge case), the modal should display a helpful message directing users to create a custom configuration in settings.

## Testing Strategy

### Unit Testing

Unit tests will verify:

1. **Preset Configuration Structure**: Each preset has required fields (id, name, description, preset type, split config, rotation config)
2. **Preset ID Uniqueness**: All preset IDs are unique
3. **Migration Logic**: Old preset IDs correctly map to new preset IDs
4. **Default Configuration Retrieval**: ConfigManager correctly returns the default configuration
5. **Modal Rendering**: Config selection modal correctly renders "No Preprocessing" option at the top

### Property-Based Testing

Property-based tests will verify the correctness properties defined above using a property-based testing library (fast-check for TypeScript). Each property test will:

1. Generate or iterate over all preset configurations
2. Verify the property holds for each configuration
3. Run at least 100 iterations (or test all presets if fewer than 100)

The property tests will be implemented using fast-check and will be tagged with comments referencing the specific correctness property from this design document.

### Manual Testing Checklist

1. Open config selection modal and verify "No Preprocessing" appears at the top
2. Verify default configuration is visually highlighted
3. Verify all preset names describe transformations, not paper sizes
4. Verify rotation presets clearly indicate direction
5. Verify settings UI displays centering tip
6. Test each preset with sample images to ensure correct behavior
7. Verify migration from old preset IDs to new preset IDs

## Implementation Notes

### Backward Compatibility

To maintain backward compatibility with existing user configurations:

1. Custom configurations created by users will remain unchanged
2. The migration logic will run once on plugin load to update the default preset ID
3. Old preset IDs in custom configurations will be preserved (they reference the preset type, not the actual preset)

### Default Configuration Selection

The new default configuration should be `preset-split-vertically` as it represents the most common use case (scanning two pages side-by-side).

### UI Styling for Default Highlight

The default configuration in the selection modal will be highlighted using:
- Bold font weight for the configuration name
- "(Default)" suffix in the name
- Optional: Subtle background color or border to make it stand out

### Settings UI Guidance Placement

The centering tip will be placed:
- At the top of the "Notebook Preprocessing" settings section
- Before the "Enable Notebook Preprocessing" toggle
- Styled as an info box with an icon (💡) for visual prominence
