# Debugging OCR Issues - Garbled Text Output

## Problem

OCR is producing garbled output like:
```
w ) L 9 i - %! P i \ ... '" » A\ - t )- — r | g> o - {A / -- ', - o S - -P - - 4 B -q
```

This indicates Tesseract is struggling to interpret the image correctly.

## Common Causes

### 1. **Wrong Image Type**
- **Diagrams/Charts**: Tesseract is trained for text, not graphics
- **Tables**: Complex layouts confuse the OCR engine
- **Screenshots**: UI elements, buttons, icons are not text
- **Photos of objects**: Not document images

### 2. **Poor Image Quality**
- Low resolution (< 300 DPI)
- Blurry or out of focus
- Poor lighting (too dark or overexposed)
- Skewed/rotated text
- Background noise or patterns

### 3. **Wrong Language Model**
- Currently hardcoded to English (`eng`)
- Non-English text will produce garbage

### 4. **Handwriting Issues**
- Tesseract is optimized for printed text
- Handwriting recognition is significantly less accurate
- Cursive writing is especially problematic

## Debugging Steps

### Step 1: Verify Image Content

Add image inspection before OCR:

```typescript
async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
    if (!this.initialized || !this.worker) {
        return {
            text: '',
            confidence: 0,
            error: 'OCR service not initialized'
        };
    }

    try {
        // Convert ArrayBuffer to Blob for Tesseract
        const blob = new Blob([imageData], { type: 'image/jpeg' });

        // DEBUG: Log image size
        console.log('Processing image:', {
            size: imageData.byteLength,
            type: blob.type
        });

        // Perform OCR
        const result = await this.worker.recognize(blob);

        // DEBUG: Log OCR result details
        console.log('OCR Result:', {
            textLength: result.data.text.length,
            confidence: result.data.confidence,
            textPreview: result.data.text.substring(0, 100)
        });

        return {
            text: result.data.text,
            confidence: result.data.confidence,
        };
    } catch (error) {
        console.error('OCR processing error:', error);
        return {
            text: '',
            confidence: 0,
            error: 'Failed to process image: ' + error.message
        };
    }
}
```

### Step 2: Add Image Preprocessing

Improve OCR accuracy with preprocessing:

```typescript
/**
 * Preprocess image before OCR to improve accuracy
 */
private async preprocessImage(imageData: ArrayBuffer): Promise<Blob> {
    // Create canvas
    const blob = new Blob([imageData], { type: 'image/jpeg' });
    const imageBitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Set canvas size
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;

    // Draw image
    ctx.drawImage(imageBitmap, 0, 0);

    // Get image data
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageDataObj.data;

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
        // Grayscale conversion
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Increase contrast (simple threshold)
        const threshold = 128;
        const value = gray > threshold ? 255 : 0;

        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
    }

    // Put processed image back
    ctx.putImageData(imageDataObj, 0, 0);

    // Convert canvas to blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob!);
        }, 'image/png');
    });
}

// Update processImage to use preprocessing
async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
    if (!this.initialized || !this.worker) {
        return {
            text: '',
            confidence: 0,
            error: 'OCR service not initialized'
        };
    }

    try {
        // Preprocess image
        const processedBlob = await this.preprocessImage(imageData);

        console.log('Processing preprocessed image...');

        // Perform OCR
        const result = await this.worker.recognize(processedBlob);

        return {
            text: result.data.text,
            confidence: result.data.confidence,
        };
    } catch (error) {
        console.error('OCR processing error:', error);
        return {
            text: '',
            confidence: 0,
            error: 'Failed to process image: ' + error.message
        };
    }
}
```

### Step 3: Add Confidence Threshold

Filter out low-confidence results:

```typescript
async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
    // ... existing code ...

    const result = await this.worker.recognize(blob);

    // Check confidence threshold
    const MIN_CONFIDENCE = 30; // Adjust based on testing

    if (result.data.confidence < MIN_CONFIDENCE) {
        console.warn(`Low OCR confidence: ${result.data.confidence}%`);
        return {
            text: '',
            confidence: result.data.confidence,
            error: `OCR confidence too low (${result.data.confidence}%). Image may be unclear or not contain readable text.`
        };
    }

    return {
        text: result.data.text,
        confidence: result.data.confidence,
    };
}
```

### Step 4: Add Page Segmentation Mode

Tesseract has different page segmentation modes:

```typescript
async initialize(): Promise<void> {
    try {
        this.worker = await createWorker({
            langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        });
        await this.worker.loadLanguage('eng');
        await this.worker.initialize('eng');

        // Set page segmentation mode
        // PSM 6 = Assume a single uniform block of text (good for notebook pages)
        // PSM 3 = Fully automatic page segmentation (default)
        // PSM 4 = Assume a single column of text of variable sizes
        await this.worker.setParameters({
            tessedit_pageseg_mode: '6', // Single block of text
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-:;()[]{}/@#$%&*+=', // Limit to common characters
        });

        this.initialized = true;
        console.log('Tesseract OCR service initialized with custom parameters');
    } catch (error) {
        console.error('Failed to initialize Tesseract OCR service:', error);
        this.initialized = false;
        throw new Error('Failed to initialize OCR service: ' + error.message);
    }
}
```

### Step 5: Add Image Quality Validation

Check image before processing:

```typescript
/**
 * Validate image quality before OCR
 */
private async validateImage(imageData: ArrayBuffer): Promise<{ valid: boolean; reason?: string }> {
    // Check file size
    const MIN_SIZE = 10 * 1024; // 10 KB
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

    if (imageData.byteLength < MIN_SIZE) {
        return { valid: false, reason: 'Image file too small (may be corrupted)' };
    }

    if (imageData.byteLength > MAX_SIZE) {
        return { valid: false, reason: 'Image file too large (may cause performance issues)' };
    }

    // Try to load image to verify it's valid
    try {
        const blob = new Blob([imageData], { type: 'image/jpeg' });
        const imageBitmap = await createImageBitmap(blob);

        // Check dimensions
        const MIN_DIMENSION = 100;
        const MAX_DIMENSION = 10000;

        if (imageBitmap.width < MIN_DIMENSION || imageBitmap.height < MIN_DIMENSION) {
            return { valid: false, reason: 'Image resolution too low (minimum 100x100 pixels)' };
        }

        if (imageBitmap.width > MAX_DIMENSION || imageBitmap.height > MAX_DIMENSION) {
            return { valid: false, reason: 'Image resolution too high (maximum 10000x10000 pixels)' };
        }

        imageBitmap.close();
        return { valid: true };
    } catch (error) {
        return { valid: false, reason: 'Invalid or corrupted image file' };
    }
}

// Use in processImage
async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
    if (!this.initialized || !this.worker) {
        return {
            text: '',
            confidence: 0,
            error: 'OCR service not initialized'
        };
    }

    // Validate image first
    const validation = await this.validateImage(imageData);
    if (!validation.valid) {
        return {
            text: '',
            confidence: 0,
            error: validation.reason
        };
    }

    // ... rest of processing ...
}
```

## Quick Fixes to Try

### Fix 1: Update Tesseract Configuration

```typescript
// In TesseractOCRService.initialize()
await this.worker.setParameters({
    tessedit_pageseg_mode: '6',  // Single block of text
    preserve_interword_spaces: '1', // Keep spaces
    tessedit_char_whitelist: '', // Remove to allow all characters initially
});
```

### Fix 2: Add Better Error Messages

```typescript
async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
    // ... existing code ...

    const result = await this.worker.recognize(blob);

    // Check if result looks like garbage
    const text = result.data.text;
    const alphanumericRatio = (text.match(/[a-zA-Z0-9]/g) || []).length / text.length;

    if (alphanumericRatio < 0.3) {
        console.warn('OCR result appears to be garbled:', {
            confidence: result.data.confidence,
            alphanumericRatio,
            textPreview: text.substring(0, 100)
        });

        return {
            text: '',
            confidence: result.data.confidence,
            error: 'OCR produced unclear results. The image may not contain readable text, or the quality may be too low. Try:\n• Using a clearer image\n• Ensuring good lighting\n• Photographing printed text instead of handwriting\n• Checking that the image contains actual text'
        };
    }

    return {
        text: result.data.text,
        confidence: result.data.confidence,
    };
}
```

### Fix 3: Add Image Preview Modal

Let users see what they're processing:

```typescript
class ImagePreviewModal extends Modal {
    private imageData: ArrayBuffer;
    private onConfirm: () => void;

    constructor(app: App, imageData: ArrayBuffer, onConfirm: () => void) {
        super(app);
        this.imageData = imageData;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Preview Image' });

        // Create image element
        const blob = new Blob([this.imageData], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);

        const img = contentEl.createEl('img');
        img.src = url;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '400px';
        img.style.objectFit = 'contain';

        contentEl.createEl('p', {
            text: 'Does this image contain readable text? OCR works best with clear, well-lit images of printed or handwritten text.'
        });

        // Buttons
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const processBtn = buttonContainer.createEl('button', { text: 'Process' });
        processBtn.classList.add('mod-cta');
        processBtn.addEventListener('click', () => {
            URL.revokeObjectURL(url);
            this.onConfirm();
            this.close();
        });

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => {
            URL.revokeObjectURL(url);
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
```

## Testing Recommendations

### Good Test Images
1. **Printed text**: Typed documents, book pages
2. **Clear handwriting**: Block letters, well-spaced
3. **High contrast**: Black text on white background
4. **Good lighting**: Evenly lit, no shadows
5. **Straight orientation**: Not rotated or skewed

### Bad Test Images
1. **Diagrams/charts**: Will produce garbage
2. **Screenshots**: UI elements confuse OCR
3. **Cursive writing**: Very low accuracy
4. **Low resolution**: Blurry or pixelated
5. **Poor lighting**: Dark, overexposed, or shadowed

## Alternative Solutions

### 1. Use Cloud OCR for Better Accuracy

```typescript
class OpenAIVisionService implements OCRService {
    private apiKey: string;

    async processImage(imageData: ArrayBuffer): Promise<OCRResult> {
        const base64 = this.arrayBufferToBase64(imageData);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4-vision-preview',
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Extract all handwritten text from this image. Return only the text, preserving line breaks and formatting as much as possible.'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64}`
                            }
                        }
                    ]
                }],
                max_tokens: 1000
            })
        });

        const data = await response.json();
        const text = data.choices[0].message.content;

        return {
            text: text,
            confidence: 95, // GPT-4 Vision is generally high confidence
        };
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
```

### 2. Add Manual Text Editing

Allow users to edit OCR results before processing:

```typescript
class OCRResultEditorModal extends Modal {
    private ocrText: string;
    private onSave: (editedText: string) => void;

    constructor(app: App, ocrText: string, onSave: (editedText: string) => void) {
        super(app);
        this.ocrText = ocrText;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Edit OCR Result' });

        contentEl.createEl('p', {
            text: 'Review and edit the extracted text before processing:'
        });

        const textarea = contentEl.createEl('textarea');
        textarea.value = this.ocrText;
        textarea.style.width = '100%';
        textarea.style.minHeight = '300px';
        textarea.style.fontFamily = 'monospace';

        // Buttons
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.marginTop = '20px';

        const saveBtn = buttonContainer.createEl('button', { text: 'Save & Process' });
        saveBtn.classList.add('mod-cta');
        saveBtn.addEventListener('click', () => {
            this.onSave(textarea.value);
            this.close();
        });

        const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
```

## Immediate Action Items

1. **Add debug logging** to see confidence scores and text previews
2. **Test with different image types** to identify what works
3. **Implement confidence threshold** to reject garbage results
4. **Add preprocessing** for better OCR accuracy
5. **Consider cloud OCR** for handwriting (GPT-4 Vision, Google Cloud Vision)

## Expected Results

With proper images:
- **Printed text**: 90-95% accuracy
- **Clear handwriting**: 60-80% accuracy
- **Cursive writing**: 30-50% accuracy
- **Diagrams/charts**: 0-10% accuracy (garbage output)

The garbled output you're seeing suggests the image is either:
- Not containing text
- Very low quality
- A diagram or complex layout
- Severely skewed or rotated

Try testing with a simple, clear image of printed text first to verify the OCR is working correctly.
