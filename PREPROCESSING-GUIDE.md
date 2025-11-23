# Notebook Page Preprocessing Guide

## Overview

The Notebook Page Preprocessing feature allows you to automatically split and rotate multi-page notebook scans before OCR processing. This is essential when you scan multiple notebook pages in a single image, as it ensures each page is processed separately and correctly oriented.

## Table of Contents

- [When to Use Preprocessing](#when-to-use-preprocessing)
- [Getting Started](#getting-started)
- [Preset Configurations](#preset-configurations)
- [Creating Custom Configurations](#creating-custom-configurations)
- [Split Page Note Creation](#split-page-note-creation)
- [Using Preprocessing](#using-preprocessing)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## When to Use Preprocessing

Use preprocessing when:

- **Scanning multiple pages side-by-side**: Two pocket notebook pages scanned horizontally next to each other
- **Scanning pages in wrong orientation**: A5 notebooks scanned in landscape instead of portrait
- **Scanning multiple pages stacked**: Multiple pages scanned vertically (top to bottom)
- **Batch scanning notebooks**: Scanning multiple pages at once to save time

Without preprocessing, OCR will read across both pages, mixing content from different pages. Preprocessing splits the image first, so each page is processed independently.

## Getting Started

### Step 1: Enable Preprocessing

1. Open Obsidian Settings
2. Navigate to **Notebook OCR Plugin**
3. Scroll to **Notebook Page Preprocessing** section
4. Toggle **Enable Image Preprocessing** to ON

### Step 2: Select Default Configuration

1. In the same section, find **Default Configuration** dropdown
2. Select a preset that matches your most common notebook format
3. For standard single-page scans, keep **Single Page (8.5x11)**
4. For pocket notebooks scanned side-by-side, select **Pocket Notebooks Side-by-Side (3.5x5.5)**

### Step 3: Configure Note Creation

1. Under **Note Creation for Split Pages**, choose:
   - **Separate notes for each page**: Creates individual notes (e.g., "My Notes - Page 1", "My Notes - Page 2")
   - **Single note with page separators**: Creates one note with pages separated by `---`
2. If using combined mode, customize the **Page Separator** if desired

## Preset Configurations

The plugin includes four preset configurations for common notebook formats:

### Single Page (8.5x11)

**Use for**: Standard letter-sized notebooks, composition notebooks, legal pads

**Settings**:
- Split: Disabled
- Rotation: Disabled

**Best for**: When you scan one page at a time in the correct orientation

---

### Pocket Notebooks Side-by-Side (3.5x5.5)

**Use for**: Moleskine pocket notebooks, Field Notes, small notebooks scanned with both pages visible

**Settings**:
- Split: Enabled (Vertical, 2 pages)
- Rotation: Disabled

**How it works**: Splits the image down the middle (left to right), creating two separate pages

**Scanning tips**:
- Lay the notebook flat with both pages visible
- Scan horizontally (landscape orientation)
- Ensure pages are evenly lit
- Keep the notebook centered in the scan

---

### A5 Portrait

**Use for**: A5 notebooks scanned in correct portrait orientation

**Settings**:
- Split: Disabled
- Rotation: Disabled

**Best for**: A5 notebooks (5.8" x 8.3") scanned vertically

---

### A5 Landscape (needs rotation)

**Use for**: A5 notebooks scanned sideways (landscape orientation)

**Settings**:
- Split: Disabled
- Rotation: Enabled (90° clockwise, before split)

**How it works**: Rotates the entire image 90° clockwise to correct orientation

**Scanning tips**:
- If you accidentally scan an A5 notebook horizontally, this preset will fix it
- The rotation happens before OCR, so text will be read correctly

## Creating Custom Configurations

Need a configuration that doesn't match the presets? Create your own!

### Step-by-Step Guide

1. **Open Settings**
   - Go to Settings → Notebook OCR Plugin → Notebook Page Preprocessing

2. **Click "Create Custom Configuration"**
   - A modal will open with configuration options

3. **Name Your Configuration**
   - Enter a descriptive name (e.g., "3-Page Horizontal Split")
   - Optionally add a description

4. **Configure Split Settings**
   - Toggle **Enable Splitting** if you need to split the image
   - Select **Split Direction**:
     - **Horizontal**: Splits top to bottom (for pages stacked vertically)
     - **Vertical**: Splits left to right (for pages side-by-side)
   - Select **Number of Pages**: 2, 3, or 4

5. **Configure Rotation Settings**
   - Toggle **Enable Rotation** if pages need rotation
   - Select **Rotation Timing**:
     - **Before splitting**: Rotates the whole image first, then splits
     - **After splitting**: Splits first, then rotates each page individually
   - Select rotation angle(s):
     - If before split: Choose one angle for the whole image (90°, 180°, 270°)
     - If after split: Choose an angle for each page separately

6. **Save Configuration**
   - Click **Save** to create the configuration
   - It will appear in your custom configurations list

### Example Custom Configurations

#### Three Pages Horizontal

**Use case**: Scanning three notebook pages stacked vertically

**Settings**:
- Split: Enabled (Horizontal, 3 pages)
- Rotation: Disabled

---

#### Side-by-Side with Rotation

**Use case**: Two pages scanned side-by-side, but both need 90° rotation

**Settings**:
- Split: Enabled (Vertical, 2 pages)
- Rotation: Enabled (After split, both pages 90° clockwise)

---

#### Four-Page Grid

**Use case**: Four small pages arranged in a 2x2 grid (requires two passes)

**First pass**:
- Split: Enabled (Horizontal, 2 pages)

**Second pass** (process each resulting image):
- Split: Enabled (Vertical, 2 pages)

*Note: Currently requires manual two-pass processing*

## Split Page Note Creation

When preprocessing splits an image into multiple pages, you can control how notes are created:

### Separate Notes Mode (Default)

**How it works**:
- Creates one note per page
- Appends page numbers to titles
- Each note is independent

**Example**:
- Source image: `notebook-scan.jpg`
- Result:
  - `notebook-scan - Page 1.md`
  - `notebook-scan - Page 2.md`

**Best for**:
- When each page contains different topics
- When you want to link to specific pages
- When pages should be organized separately

### Combined Note Mode

**How it works**:
- Creates a single note with all pages
- Inserts separator between pages (default: `\n\n---\n\n`)
- All content in one file

**Example**:
- Source image: `notebook-scan.jpg`
- Result: `notebook-scan.md` containing:
  ```
  [Page 1 content]

  ---

  [Page 2 content]
  ```

**Best for**:
- When pages are part of the same topic
- When you want to keep related content together
- When you prefer fewer files

### Customizing the Page Separator

1. Go to Settings → Notebook OCR Plugin → Notebook Page Preprocessing
2. Select **Combined** mode
3. Edit the **Page Separator** field
4. Use `\n` for newlines (e.g., `\n\n---\n\n` = two newlines, horizontal rule, two newlines)

**Popular separators**:
- `\n\n---\n\n` - Horizontal rule with spacing (default)
- `\n\n***\n\n` - Alternative horizontal rule
- `\n\n## Page Break\n\n` - Heading separator
- `\n\n` - Just blank lines

## Using Preprocessing

### Method 1: Use Default Configuration

1. Click the camera icon in the ribbon, or use Command Palette → "Import from notebook images"
2. If preprocessing is enabled, the configuration selection modal appears
3. Click **Select** on your default configuration (or choose a different one)
4. Select your image file(s)
5. The plugin will preprocess and then OCR the image

### Method 2: Select Configuration Each Time

1. Start the import process
2. In the configuration selection modal, choose any available configuration
3. Or select **No Preprocessing** to skip preprocessing for this image
4. Select your image file(s)

### Method 3: Change Default Configuration

1. Go to Settings → Notebook OCR Plugin → Notebook Page Preprocessing
2. Change the **Default Configuration** dropdown
3. This will be used automatically for future imports

## Examples

### Example 1: Pocket Notebook Side-by-Side

**Scenario**: You have a pocket notebook (Moleskine, Field Notes) and scan both pages at once.

**Setup**:
1. Enable preprocessing
2. Select **Pocket Notebooks Side-by-Side (3.5x5.5)** as default
3. Choose **Separate notes** mode

**Scanning**:
- Open notebook flat
- Scan both pages in landscape orientation
- Save as `meeting-notes.jpg`

**Result**:
- `meeting-notes - Page 1.md` (left page)
- `meeting-notes - Page 2.md` (right page)

---

### Example 2: A5 Notebook Scanned Sideways

**Scenario**: You scanned an A5 notebook in landscape by mistake.

**Setup**:
1. Enable preprocessing
2. Select **A5 Landscape (needs rotation)** when importing
3. Choose **Separate notes** mode

**Result**:
- Image is rotated 90° clockwise
- OCR reads text in correct orientation
- Note created with corrected content

---

### Example 3: Three Pages Stacked

**Scenario**: You scan three notebook pages stacked vertically on a scanner.

**Setup**:
1. Create custom configuration:
   - Name: "Three Pages Vertical"
   - Split: Horizontal, 3 pages
   - Rotation: Disabled
2. Select this configuration when importing
3. Choose **Combined note** mode with `\n\n---\n\n` separator

**Result**:
- Single note with three sections separated by horizontal rules
- Pages appear in order: top, middle, bottom

---

### Example 4: Mixed Orientation Pages

**Scenario**: Two pages scanned side-by-side, but the right page is upside down.

**Setup**:
1. Create custom configuration:
   - Name: "Side-by-Side Mixed"
   - Split: Vertical, 2 pages
   - Rotation: After split
     - Page 1: 0° (no rotation)
     - Page 2: 180° (flip upside down)
2. Select this configuration when importing

**Result**:
- Two separate notes
- Both pages correctly oriented for OCR

## Troubleshooting

### Problem: Split is in the wrong direction

**Solution**:
- Check your split direction setting
- Horizontal = top to bottom (for stacked pages)
- Vertical = left to right (for side-by-side pages)
- Create a custom configuration with the correct direction

### Problem: Pages are in the wrong order

**Solution**:
- For vertical splits: Pages go left to right
- For horizontal splits: Pages go top to bottom
- If your scan is reversed, try rotating the image 180° before splitting

### Problem: "Image dimensions too small" error

**Solution**:
- Your image is too small to split into the configured number of pages
- Each page must be at least 100px in the split dimension
- Try:
  - Scanning at higher resolution
  - Reducing the number of pages in your configuration
  - Using "No Preprocessing" for this image

### Problem: OCR still reads across both pages

**Solution**:
- Verify preprocessing is enabled in settings
- Check that you selected a configuration with splitting enabled
- Look at the console logs (Ctrl+Shift+I) to verify transformations were applied
- Try the preview feature to verify split is correct

### Problem: Page numbers not in titles

**Solution**:
- Check that **Split Page Note Mode** is set to **Separate notes**
- If set to **Combined**, switch to **Separate notes**
- Process the image again

### Problem: Rotation is wrong

**Solution**:
- Check rotation angle (90°, 180°, 270° are clockwise)
- Verify rotation timing:
  - Before split: Rotates whole image
  - After split: Rotates individual pages
- Try different angles or create a custom configuration

### Problem: Preview not showing

**Solution**:
- Preview feature may not be implemented yet
- Check the console for errors
- Verify the image file is not corrupted

## Advanced Tips

### Tip 1: Batch Processing

For multiple images with the same format:
1. Set your default configuration once
2. Process all images without changing settings
3. All images will use the same preprocessing

### Tip 2: Testing Configurations

Before processing many images:
1. Test with one sample image
2. Verify the split and rotation are correct
3. Adjust configuration if needed
4. Then process the rest

### Tip 3: Organizing Configurations

Name your custom configurations descriptively:
- ✅ "Pocket Notebook Landscape"
- ✅ "3-Page Vertical Split"
- ✅ "A5 Rotated 90"
- ❌ "Config 1"
- ❌ "Test"

### Tip 4: Metadata for Tracking

Enable **Include Preprocessing Metadata** to add frontmatter:
```yaml
---
preprocessing_config: Pocket Notebooks Side-by-Side (3.5x5.5)
page_number: 1
total_pages: 2
split_direction: vertical
ocr_provider: openai
---
```

This helps you track which configuration was used for each note.

### Tip 5: Combining with Processing Rules

Preprocessing happens before OCR, so your processing rules still work:
1. Image is preprocessed (split/rotated)
2. Each page is sent to OCR
3. OCR results are matched against your rules
4. Rules are applied to create/update notes

This means you can have different rules for different pages!

## Best Practices

1. **Scan Quality**: Higher resolution scans split better (300 DPI or higher recommended)
2. **Lighting**: Even lighting prevents shadows that might affect splitting
3. **Alignment**: Keep pages aligned and centered in the scan
4. **Consistency**: Use the same scanning setup for similar notebooks
5. **Test First**: Always test a new configuration with one image before batch processing
6. **Name Clearly**: Use descriptive names for custom configurations
7. **Document Settings**: Add descriptions to custom configurations explaining when to use them

## Getting Help

If you encounter issues:

1. **Check the console**: Press Ctrl+Shift+I (Cmd+Option+I on Mac) to see detailed logs
2. **Verify settings**: Double-check your configuration settings
3. **Test with simple case**: Try a single-page image first
4. **Report bugs**: Open an issue on GitHub with:
   - Your configuration settings
   - Sample image (if possible)
   - Console error messages
   - Expected vs actual behavior

---

**Happy scanning!** With preprocessing, you can efficiently digitize multi-page notebook scans and keep your Obsidian vault organized.
