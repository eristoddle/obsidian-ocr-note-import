# Implementation Plan

- [x] 1. Extend OCR service interfaces and data models
  - Update OCRService interface to include testConnection() and getProviderInfo() methods
  - Update OCRResult interface to include provider and fallbackUsed fields
  - Create ConnectionTestResult interface
  - Create OCRProviderInfo interface
  - Create OpenAIConfig and GoogleCloudConfig interfaces
  - _Requirements: 1.1, 2.1, 7.1, 8.1, 10.1_

- [ ] 2. Update plugin settings for cloud OCR
  - [ ] 2.1 Add cloud OCR settings to PluginSettings interface
    - Add ocrBackend field with 'tesseract' | 'openai' | 'google' type
    - Add openaiApiKey, openaiCustomEndpoint fields
    - Add googleCloudApiKey, googleCloudProjectId fields
    - Add enableOcrFallback field
    - Add enableImagePreprocessing, maxImageDimension, maxImageFileSize fields
    - Add includeOcrProviderMetadata field
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 6.1, 9.1, 9.2, 8.3_

  - [ ] 2.2 Update DEFAULT_SETTINGS with cloud OCR defaults
    - Set ocrBackend default to 'tesseract'
    - Set enableOcrFallback default to true
    - Set enableImagePreprocessing default to true
    - Set maxImageDimension default to 2048
    - Set maxImageFileSize default to 4
    - Set includeOcrProviderMetadata default to false
    - _Requirements: 1.1, 6.1, 9.1_

- [ ] 3. Implement OpenAI Vision OCR service
  - [ ] 3.1 Create OpenAIVisionService class
    - Implement constructor accepting OpenAIConfig
    - Implement initialize() method with API key validation
    - Store apiKey, apiEndpoint, model, and maxTokens properties
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ] 3.2 Implement image processing for OpenAI
    - Implement processImage() method
    - Convert ArrayBuffer to base64 string
    - Construct chat completion request payload with vision content
    - Include text prompt for OCR extraction
    - Send request to OpenAI API with proper headers
    - Parse response and extract text from message content
    - Return OCRResult with text, confidence, and provider
    - Handle errors and return OCRResult with error message
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

  - [ ] 3.3 Implement connection testing for OpenAI
    - Implement testConnection() method
    - Create minimal test image (1x1 pixel PNG)
    - Send test request and measure response time
    - Return ConnectionTestResult with success status and response time
    - Handle errors and return failure result with error message
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 3.4 Implement provider info for OpenAI
    - Implement getProviderInfo() method
    - Return OCRProviderInfo with name, requirements, cost estimate, pricing URL
    - Set accuracyRating to 'very-high'
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 3.5 Implement error handling for OpenAI
    - Implement formatError() helper method
    - Detect authentication errors (401, invalid key)
    - Detect rate limit errors (429)
    - Detect network errors
    - Return user-friendly error messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 3.6 Implement helper methods for OpenAI
    - Implement arrayBufferToBase64() conversion method
    - Implement createTestImage() method for connection testing
    - Implement isAvailable() method checking for API key
    - _Requirements: 3.1, 7.1_

- [ ] 4. Implement Google Cloud Vision OCR service
  - [ ] 4.1 Create GoogleCloudVisionService class
    - Implement constructor accepting GoogleCloudConfig
    - Implement initialize() method with API key validation
    - Store apiKey, projectId, and apiEndpoint properties
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ] 4.2 Implement image processing for Google Cloud
    - Implement processImage() method
    - Convert ArrayBuffer to base64 string
    - Construct images:annotate request payload with TEXT_DETECTION feature
    - Send request to Google Cloud Vision API with API key in URL
    - Parse response and extract text from textAnnotations
    - Extract confidence score from first annotation
    - Return OCRResult with text, confidence, and provider
    - Handle errors and return OCRResult with error message
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

  - [ ] 4.3 Implement connection testing for Google Cloud
    - Implement testConnection() method
    - Create minimal test image
    - Send test request and measure response time
    - Return ConnectionTestResult with success status and response time
    - Handle errors and return failure result with error message
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 4.4 Implement provider info for Google Cloud
    - Implement getProviderInfo() method
    - Return OCRProviderInfo with name, requirements, cost estimate, pricing URL
    - Set accuracyRating to 'very-high'
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 4.5 Implement error handling for Google Cloud
    - Implement formatError() helper method
    - Detect authentication errors (401, 403, invalid API key)
    - Detect quota exceeded errors (429)
    - Detect network errors
    - Return user-friendly error messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 4.6 Implement helper methods for Google Cloud
    - Implement arrayBufferToBase64() conversion method
    - Implement createTestImage() method for connection testing
    - Implement isAvailable() method checking for API key
    - _Requirements: 3.1, 7.1_

- [ ] 5. Implement OCR fallback handler
  - [ ] 5.1 Create OCRFallbackHandler class
    - Implement constructor accepting primary service, fallback service, and enabled flag
    - Store primaryService, fallbackService, and fallbackEnabled properties
    - _Requirements: 6.1, 6.2_

  - [ ] 5.2 Implement fallback processing logic
    - Implement processImage() method
    - Attempt processing with primary service first
    - If successful, return result immediately
    - If failed and fallback disabled, return error result
    - If failed and fallback enabled, log fallback attempt
    - Process with fallback service
    - Mark result with fallbackUsed flag
    - Return fallback result
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 6. Implement image preprocessor
  - [ ] 6.1 Create ImagePreprocessor class
    - Implement constructor accepting maxDimension and maxFileSize parameters
    - Set default maxDimension to 2048 pixels
    - Set default maxFileSize to 4MB
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 6.2 Implement preprocessing logic
    - Implement preprocess() method accepting ArrayBuffer
    - Check if image size and dimensions are within limits
    - If within limits, return original image data
    - If exceeds limits, load image into HTMLImageElement
    - Calculate scale factor to fit within maxDimension
    - Resize image using canvas
    - Compress image to JPEG with quality adjustment
    - Iteratively reduce quality if still over maxFileSize
    - Return preprocessed ArrayBuffer
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 6.3 Implement image manipulation helpers
    - Implement loadImage() to create HTMLImageElement from ArrayBuffer
    - Implement resizeImage() to scale image using canvas
    - Implement compressImage() to convert canvas to JPEG with quality setting
    - Implement getImageDimensions() to extract width and height
    - _Requirements: 9.1, 9.2_

- [ ] 7. Update OCR service factory
  - [ ] 7.1 Extend OCRServiceFactory.create() method
    - Add case for 'openai' backend
    - Validate openaiApiKey is present
    - Create and return OpenAIVisionService instance
    - Add case for 'google' backend
    - Validate googleCloudApiKey is present
    - Create and return GoogleCloudVisionService instance
    - Keep existing 'tesseract' case as default
    - _Requirements: 1.1, 1.4, 2.1, 2.4_

- [ ] 8. Integrate cloud OCR into main plugin
  - [ ] 8.1 Update plugin initialization
    - Modify onload() to create OCR service based on settings.ocrBackend
    - If cloud backend selected, wrap with OCRFallbackHandler if fallback enabled
    - Initialize ImagePreprocessor if preprocessing enabled
    - _Requirements: 1.1, 2.1, 6.1, 9.1_

  - [ ] 8.2 Update image processing pipeline
    - Modify image processing command to preprocess images if cloud backend and preprocessing enabled
    - Pass preprocessed image to OCR service
    - Check OCRResult for fallbackUsed flag
    - Display notification indicating which provider was used
    - If fallback was used, show warning notification
    - _Requirements: 3.1, 3.2, 6.3, 8.1, 8.2, 9.1_

  - [ ] 8.3 Add OCR provider metadata to notes
    - Check settings.includeOcrProviderMetadata flag
    - If enabled, add frontmatter property 'ocr_provider' to created notes
    - Set value to OCRResult.provider
    - Add 'ocr_fallback_used' property if fallbackUsed is true
    - _Requirements: 8.2, 8.3, 8.4_

- [ ] 9. Implement cloud OCR settings UI
  - [ ] 9.1 Create CloudOCRSettingsUI class
    - Implement display() method to render settings section
    - Add OCR backend dropdown with descriptions
    - Show/hide provider-specific settings based on selection
    - _Requirements: 1.1, 2.1_

  - [ ] 9.2 Implement OpenAI settings UI
    - Implement displayOpenAISettings() method
    - Display cost warning with link to pricing page
    - Add text input for API key with placeholder
    - Add "Test Connection" button
    - Add optional custom endpoint input
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 10.1, 10.2_

  - [ ] 9.3 Implement Google Cloud settings UI
    - Implement displayGoogleCloudSettings() method
    - Display cost information with link to pricing page
    - Add text input for API key
    - Add "Test Connection" button
    - Add optional project ID input
    - _Requirements: 2.1, 2.2, 2.3, 7.1, 10.1, 10.2_

  - [ ] 9.4 Implement fallback settings UI
    - Implement displayFallbackSettings() method
    - Add toggle for enabling fallback to local OCR
    - Show only when cloud backend is selected
    - _Requirements: 6.1, 6.2_

  - [ ] 9.5 Implement preprocessing settings UI
    - Implement displayPreprocessingSettings() method
    - Add toggle for enabling image preprocessing
    - Add text input for maximum image dimension
    - Add text input for maximum file size in MB
    - Show dimension and file size inputs only when preprocessing enabled
    - Show only when cloud backend is selected
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 9.6 Implement metadata settings UI
    - Implement displayMetadataSettings() method
    - Add toggle for including OCR provider in note frontmatter
    - _Requirements: 8.3, 8.4_

  - [ ] 9.7 Implement connection test handlers
    - Implement testOpenAIConnection() method
    - Create OpenAIVisionService with current settings
    - Call testConnection() and show loading notice
    - Display success notice with response time or error notice
    - Implement testGoogleCloudConnection() method with same pattern
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 10. Add error handling and user notifications
  - [ ] 10.1 Create OCRError class
    - Define OCRErrorType enum with error categories
    - Implement OCRError extending Error with type and provider fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 10.2 Create ErrorMessageFormatter class
    - Implement format() method accepting OCRError
    - Return user-friendly messages for each error type
    - Include provider name in messages
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 10.3 Update notification messages
    - Modify success notifications to include OCR provider name
    - Add warning notification when fallback is used
    - Use ErrorMessageFormatter for error notifications
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.3, 8.1_

- [ ] 11. Update documentation
  - [ ] 11.1 Update README.md
    - Add cloud OCR section explaining OpenAI and Google Cloud options
    - Document API key setup for each provider
    - Add cost information and links to pricing pages
    - Document fallback behavior
    - Add troubleshooting section for cloud OCR errors
    - _Requirements: All_

  - [ ] 11.2 Add inline code documentation
    - Add JSDoc comments to all cloud OCR classes and methods
    - Document API request/response formats
    - Add usage examples for each cloud provider
    - _Requirements: All_

  - [ ] 11.3 Create cloud OCR setup guide
    - Document how to obtain OpenAI API key
    - Document how to obtain Google Cloud Vision API key
    - Provide step-by-step setup instructions
    - Include screenshots of settings UI
    - _Requirements: 1.1, 1.2, 2.1, 2.2_
