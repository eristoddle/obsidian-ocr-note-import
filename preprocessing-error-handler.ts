import { Notice } from 'obsidian';
import { PreprocessingError, PreprocessingErrorType } from './preprocessing-types';

/**
 * Error handler for preprocessing operations
 *
 * Provides user-friendly error messages for preprocessing failures.
 * Logs detailed error information to the console for debugging.
 *
 * @example
 * ```typescript
 * try {
 *   await preprocessingManager.preprocess(imageData, configId);
 * } catch (error) {
 *   if (error instanceof PreprocessingError) {
 *     PreprocessingErrorHandler.handle(error, file.name);
 *   }
 * }
 * ```
 */
export class PreprocessingErrorHandler {
    /**
     * Handle preprocessing errors with user-friendly messages
     * Displays an Obsidian Notice with context-specific error message
     * Logs detailed error information to console for debugging
     *
     * @param error - The preprocessing error to handle
     * @param imagePath - Path or name of the image that failed preprocessing
     */
    static handle(error: PreprocessingError, imagePath: string): void {
        console.error(`Preprocessing error for ${imagePath}:`, error);

        let userMessage = `Failed to preprocess image "${imagePath}"`;

        switch (error.type) {
            case PreprocessingErrorType.INVALID_DIMENSIONS:
                userMessage += ': Image dimensions are too small for the selected split configuration. Try a different configuration or process without splitting.';
                break;

            case PreprocessingErrorType.SPLIT_FAILED:
                userMessage += ': Failed to split image. The image may be corrupted or in an unsupported format.';
                break;

            case PreprocessingErrorType.ROTATION_FAILED:
                userMessage += ': Failed to rotate image. Attempting to process without rotation.';
                break;

            case PreprocessingErrorType.INVALID_CONFIG:
                userMessage += `: Invalid configuration - ${error.message}`;
                break;

            case PreprocessingErrorType.IMAGE_LOAD_FAILED:
                userMessage += ': Failed to load image. The file may be corrupted.';
                break;

            default:
                userMessage += `: ${error.message}`;
        }

        new Notice(userMessage, 8000);
    }
}
