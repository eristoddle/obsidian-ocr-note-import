# Requirements Document

## Introduction

The Cloud OCR Integration feature extends the Notebook OCR Plugin to support cloud-based OCR services (OpenAI Vision API and Google Cloud Vision API) as alternatives to the local Tesseract.js engine. Cloud OCR providers offer significantly better accuracy for handwritten text recognition, particularly for cursive writing and messy handwriting, at the cost of requiring internet connectivity and API credentials.

## Glossary

- **Plugin**: The Notebook OCR Plugin system
- **User**: The person using Obsidian with the Plugin installed
- **OCR Engine**: The optical character recognition service that converts image text to digital text
- **Cloud OCR Provider**: An external API service that performs OCR processing (OpenAI Vision or Google Cloud Vision)
- **API Key**: Authentication credential required to access Cloud OCR Provider services
- **API Endpoint**: The URL where API requests are sent to the Cloud OCR Provider
- **OCR Backend**: The configured OCR processing method (local Tesseract or cloud provider)
- **Request Payload**: The data sent to the Cloud OCR Provider including the image and processing parameters
- **Response Data**: The OCR results returned from the Cloud OCR Provider
- **Rate Limit**: The maximum number of API requests allowed within a time period
- **API Cost**: The monetary charge incurred for using Cloud OCR Provider services
- **Fallback Behavior**: The action taken when the primary OCR Backend fails
- **Image Preprocessing**: Transformations applied to images before sending to the OCR Engine
- **Confidence Score**: A numerical value indicating the OCR Engine's certainty in the extracted text

## Requirements

### Requirement 1

**User Story:** As a User, I want to configure OpenAI Vision API as my OCR backend, so that I can achieve better accuracy for handwritten text recognition.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration setting to select OpenAI Vision as the OCR Backend
2. WHEN OpenAI Vision is selected as the OCR Backend, THE Plugin SHALL display a configuration field for the OpenAI API Key
3. WHEN OpenAI Vision is selected as the OCR Backend, THE Plugin SHALL display an optional configuration field for a custom API Endpoint
4. THE Plugin SHALL validate that the API Key is provided before allowing OpenAI Vision to be used
5. THE Plugin SHALL store the API Key securely in Obsidian's data storage

### Requirement 2

**User Story:** As a User, I want to configure Google Cloud Vision API as my OCR backend, so that I can leverage Google's handwriting recognition capabilities.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration setting to select Google Cloud Vision as the OCR Backend
2. WHEN Google Cloud Vision is selected as the OCR Backend, THE Plugin SHALL display a configuration field for the Google Cloud API Key
3. WHEN Google Cloud Vision is selected as the OCR Backend, THE Plugin SHALL display an optional configuration field for the Google Cloud project ID
4. THE Plugin SHALL validate that the API Key is provided before allowing Google Cloud Vision to be used
5. THE Plugin SHALL store the API Key securely in Obsidian's data storage

### Requirement 3

**User Story:** As a User, I want the plugin to send my images to the configured cloud OCR provider, so that I can receive accurate text extraction results.

#### Acceptance Criteria

1. WHEN the User processes an image with a cloud OCR Backend configured, THE Plugin SHALL encode the image data in the format required by the Cloud OCR Provider
2. WHEN sending a request to OpenAI Vision, THE Plugin SHALL construct a Request Payload with the image and appropriate prompt for text extraction
3. WHEN sending a request to Google Cloud Vision, THE Plugin SHALL construct a Request Payload with the image and text detection feature request
4. THE Plugin SHALL include the API Key in the request headers or authentication parameters as required by the Cloud OCR Provider
5. THE Plugin SHALL send the Request Payload to the Cloud OCR Provider's API Endpoint

### Requirement 4

**User Story:** As a User, I want the plugin to parse responses from cloud OCR providers, so that I can use the extracted text in my notes.

#### Acceptance Criteria

1. WHEN the Plugin receives a Response Data from OpenAI Vision, THE Plugin SHALL extract the text content from the response structure
2. WHEN the Plugin receives a Response Data from Google Cloud Vision, THE Plugin SHALL extract the text annotations from the response structure
3. THE Plugin SHALL return the extracted text in the same OCRResult format used by local OCR
4. WHERE the Cloud OCR Provider returns a Confidence Score, THE Plugin SHALL include it in the OCRResult
5. IF the Response Data indicates an error, THEN THE Plugin SHALL return an OCRResult with an error message

### Requirement 5

**User Story:** As a User, I want to see clear error messages when cloud OCR fails, so that I can understand and resolve the issue.

#### Acceptance Criteria

1. IF the API Key is invalid or expired, THEN THE Plugin SHALL display an error message indicating authentication failure
2. IF the API request fails due to network connectivity, THEN THE Plugin SHALL display an error message indicating connection failure
3. IF the Cloud OCR Provider returns a Rate Limit error, THEN THE Plugin SHALL display an error message indicating the rate limit has been exceeded
4. IF the Cloud OCR Provider returns an error response, THEN THE Plugin SHALL display the error message from the provider
5. THE Plugin SHALL log detailed error information to the console for debugging purposes

### Requirement 6

**User Story:** As a User, I want to configure a fallback OCR backend, so that processing can continue if my primary backend fails.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration setting to enable fallback to local Tesseract when cloud OCR fails
2. WHEN fallback is enabled and cloud OCR fails, THE Plugin SHALL automatically retry the image processing with Tesseract
3. WHEN fallback processing occurs, THE Plugin SHALL display a notification informing the User that fallback was used
4. THE Plugin SHALL log which OCR Backend was used for each processed image
5. WHERE fallback is disabled and cloud OCR fails, THE Plugin SHALL display an error without attempting local processing

### Requirement 7

**User Story:** As a User, I want to test my cloud OCR configuration, so that I can verify my API credentials are working before processing important images.

#### Acceptance Criteria

1. THE Plugin SHALL provide a "Test Connection" button in the settings for each Cloud OCR Provider
2. WHEN the User clicks the Test Connection button, THE Plugin SHALL send a test request to the Cloud OCR Provider with a small sample image
3. IF the test request succeeds, THEN THE Plugin SHALL display a success message with the API response time
4. IF the test request fails, THEN THE Plugin SHALL display an error message with details about the failure
5. THE Plugin SHALL not process any user images during the connection test

### Requirement 8

**User Story:** As a User, I want to see which OCR backend was used for each processed image, so that I can track accuracy and costs.

#### Acceptance Criteria

1. WHEN the Plugin completes processing an image, THE Plugin SHALL include the OCR Backend name in the success notification
2. THE Plugin SHALL optionally add metadata to created notes indicating which OCR Backend was used
3. THE Plugin SHALL provide a configuration setting to enable or disable OCR backend metadata in notes
4. WHERE OCR backend metadata is enabled, THE Plugin SHALL add a frontmatter property indicating the backend used
5. THE Plugin SHALL log OCR Backend usage statistics to the console

### Requirement 9

**User Story:** As a User, I want to configure image preprocessing options for cloud OCR, so that I can optimize image quality before sending to the API.

#### Acceptance Criteria

1. THE Plugin SHALL provide a configuration setting to enable automatic image resizing before sending to cloud providers
2. WHEN image resizing is enabled, THE Plugin SHALL resize images larger than a configured maximum dimension
3. THE Plugin SHALL provide a configuration setting for maximum image file size for cloud OCR requests
4. WHEN an image exceeds the maximum file size, THE Plugin SHALL compress the image before sending
5. THE Plugin SHALL preserve the original image file in the vault regardless of preprocessing

### Requirement 10

**User Story:** As a User, I want to understand the cost implications of using cloud OCR, so that I can make informed decisions about which backend to use.

#### Acceptance Criteria

1. THE Plugin SHALL display estimated API Cost information in the settings for each Cloud OCR Provider
2. THE Plugin SHALL provide a link to the Cloud OCR Provider's pricing page in the settings
3. THE Plugin SHALL display a warning when selecting a cloud OCR backend that API usage will incur costs
4. THE Plugin SHALL provide information about the number of images that can be processed within typical free tier limits
5. THE Plugin SHALL not track or calculate actual costs incurred by the User
