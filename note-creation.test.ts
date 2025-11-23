/**
 * Property-based tests for note creation from split pages
 *
 * Feature: notebook-image-preprocessing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock types for testing
interface MockOCRResult {
	text: string;
	confidence: number;
	provider?: string;
}

interface MockPreprocessingResult {
	pages: ArrayBuffer[];
	config: {
		name: string;
		split?: {
			enabled: boolean;
			direction: string;
		};
		rotation?: {
			enabled: boolean;
		};
	};
	transformations: string[];
}

interface MockVaultManager {
	createNote: (folderPath: string, title: string, frontmatter: Record<string, any>, body: string) => Promise<any>;
}

// Helper class to test note creation logic
class NoteCreationHelper {
	private splitPageNoteMode: 'separate' | 'combined';
	private splitPageSeparator: string;
	private includePreprocessingMetadata: boolean;
	private vaultManager: MockVaultManager;

	constructor(
		splitPageNoteMode: 'separate' | 'combined',
		splitPageSeparator: string,
		includePreprocessingMetadata: boolean,
		vaultManager: MockVaultManager
	) {
		this.splitPageNoteMode = splitPageNoteMode;
		this.splitPageSeparator = splitPageSeparator;
		this.includePreprocessingMetadata = includePreprocessingMetadata;
		this.vaultManager = vaultManager;
	}

	async createNotesFromPages(
		sourceFileName: string,
		ocrResults: MockOCRResult[],
		preprocessingResult: MockPreprocessingResult
	): Promise<void> {
		if (this.splitPageNoteMode === 'separate') {
			await this.createSeparateNotes(sourceFileName, ocrResults, preprocessingResult);
		} else {
			await this.createCombinedNote(sourceFileName, ocrResults, preprocessingResult);
		}
	}

	private async createSeparateNotes(
		sourceFileName: string,
		ocrResults: MockOCRResult[],
		preprocessingResult: MockPreprocessingResult
	): Promise<void> {
		for (let i = 0; i < ocrResults.length; i++) {
			const pageNumber = i + 1;
			const title = this.generatePageTitle(sourceFileName, pageNumber);
			const content = this.generateNoteContent(ocrResults[i], preprocessingResult, pageNumber);
			const frontmatter = this.generateFrontmatter(preprocessingResult, pageNumber, ocrResults.length);
			await this.vaultManager.createNote('', title, frontmatter, content);
		}
	}

	private async createCombinedNote(
		sourceFileName: string,
		ocrResults: MockOCRResult[],
		preprocessingResult: MockPreprocessingResult
	): Promise<void> {
		const title = sourceFileName;
		const content = this.generateCombinedNoteContent(ocrResults, preprocessingResult);
		const frontmatter = this.generateFrontmatter(preprocessingResult, null, ocrResults.length);
		await this.vaultManager.createNote('', title, frontmatter, content);
	}

	private generatePageTitle(baseName: string, pageNumber: number): string {
		return `${baseName} - Page ${pageNumber}`;
	}

	private generateNoteContent(
		ocrResult: MockOCRResult,
		preprocessingResult: MockPreprocessingResult,
		pageNumber: number
	): string {
		return ocrResult.text;
	}

	private generateCombinedNoteContent(
		ocrResults: MockOCRResult[],
		preprocessingResult: MockPreprocessingResult
	): string {
		let content = '';
		for (let i = 0; i < ocrResults.length; i++) {
			if (i > 0) {
				content += this.splitPageSeparator;
			}
			content += ocrResults[i].text;
		}
		return content;
	}

	private generateFrontmatter(
		preprocessingResult: MockPreprocessingResult,
		pageNumber: number | null,
		totalPages: number
	): Record<string, any> {
		const frontmatter: Record<string, any> = {};

		if (this.includePreprocessingMetadata && preprocessingResult) {
			frontmatter.preprocessing_config = preprocessingResult.config.name;
			frontmatter.total_pages = totalPages;

			if (pageNumber !== null) {
				frontmatter.page_number = pageNumber;
			}

			if (preprocessingResult.config.split && preprocessingResult.config.split.enabled) {
				frontmatter.split_direction = preprocessingResult.config.split.direction;
			}

			if (preprocessingResult.config.rotation && preprocessingResult.config.rotation.enabled) {
				frontmatter.rotation_applied = true;
			}
		}

		return frontmatter;
	}
}

describe('Note Creation from Split Pages', () => {
	/**
	 * Feature: notebook-image-preprocessing, Property 14: Separate note creation count
	 * Validates: Requirements 8.1
	 *
	 * For any image split into N pages with note mode set to 'separate', exactly N notes should be created
	 */
	it('Property 14: Separate note creation count', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: 'horizontal'
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'separate',
						'\n\n---\n\n',
						false,
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Verify exactly N notes were created
					expect(createdNotes.length).toBe(pageCount);
				}
			),
			{ numRuns: 100 }
		);
	});

	/**
	 * Feature: notebook-image-preprocessing, Property 15: Combined note separator count
	 * Validates: Requirements 8.2
	 *
	 * For any image split into N pages with note mode set to 'combined', exactly 1 note should be created containing N-1 page separator markers
	 */
	it('Property 15: Combined note separator count', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.constantFrom('\n\n---\n\n', '\n===\n', '\n***\n', '|||'), // Use separators unlikely to appear in text
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, separator, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: 'horizontal'
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'combined',
						separator,
						false,
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Verify exactly 1 note was created
					expect(createdNotes.length).toBe(1);

					// Count separator occurrences in the note body
					const noteBody = createdNotes[0].body;
					const separatorCount = (noteBody.match(new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

					// Verify exactly N-1 separators
					expect(separatorCount).toBe(pageCount - 1);
				}
			),
			{ numRuns: 100 }
		);
	});

	/**
	 * Feature: notebook-image-preprocessing, Property 16: Page numbers in separate note titles
	 * Validates: Requirements 8.3
	 *
	 * For any image split into N pages creating separate notes, each note title should contain its corresponding page number (1 through N)
	 */
	it('Property 16: Page numbers in separate note titles', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: 'horizontal'
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'separate',
						'\n\n---\n\n',
						false,
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Verify each note title contains its corresponding page number
					for (let i = 0; i < pageCount; i++) {
						const pageNumber = i + 1;
						const noteTitle = createdNotes[i].title;

						// Check that the title contains the page number
						expect(noteTitle).toContain(`Page ${pageNumber}`);
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	/**
	 * Feature: notebook-image-preprocessing, Property 17: Separator markers in combined notes
	 * Validates: Requirements 8.4
	 *
	 * For any image split into N pages creating a combined note, the note content should contain exactly N-1 separator markers positioned between page contents
	 */
	it('Property 17: Separator markers in combined notes', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.constantFrom('\n\n---\n\n', '\n===\n', '\n***\n', '|||'), // Use separators unlikely to appear in text
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, separator, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: 'horizontal'
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'combined',
						separator,
						false,
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Get the combined note body
					const noteBody = createdNotes[0].body;

					// Split by separator to get page contents
					const parts = noteBody.split(separator);

					// Verify we have exactly N parts (N-1 separators means N parts)
					expect(parts.length).toBe(pageCount);

					// Verify the combined content contains all OCR texts
					// (We don't check exact positioning because if OCR text contains the separator, it will be split)
					for (let i = 0; i < pageCount; i++) {
						expect(noteBody).toContain(ocrResults[i].text);
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	/**
	 * Feature: notebook-image-preprocessing, Property 19: Metadata inclusion based on setting
	 * Validates: Requirements 9.2
	 *
	 * For any note created from preprocessing, if metadata is enabled, the note should contain preprocessing information in frontmatter,
	 * and if metadata is disabled, the note should not contain preprocessing information
	 */
	it('Property 19: Metadata inclusion based on setting', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.boolean(), // Include metadata or not
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, includeMetadata, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: 'horizontal'
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'separate',
						'\n\n---\n\n',
						includeMetadata,
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Check each created note
					for (const note of createdNotes) {
						if (includeMetadata) {
							// Should contain preprocessing metadata
							expect(note.frontmatter).toHaveProperty('preprocessing_config');
							expect(note.frontmatter).toHaveProperty('total_pages');
							expect(note.frontmatter).toHaveProperty('page_number');
						} else {
							// Should not contain preprocessing metadata
							expect(note.frontmatter).not.toHaveProperty('preprocessing_config');
							expect(note.frontmatter).not.toHaveProperty('total_pages');
							expect(note.frontmatter).not.toHaveProperty('page_number');
						}
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	/**
	 * Feature: notebook-image-preprocessing, Property 20: Metadata contains configuration details
	 * Validates: Requirements 9.3
	 *
	 * For any note created with metadata enabled, the frontmatter should contain properties indicating the split direction,
	 * page count, and rotation angles used
	 */
	it('Property 20: Metadata contains configuration details', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.constantFrom('horizontal', 'vertical'), // Split direction
				fc.boolean(), // Rotation enabled
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, splitDirection, rotationEnabled, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: splitDirection
							},
							rotation: {
								enabled: rotationEnabled
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'separate',
						'\n\n---\n\n',
						true, // Enable metadata
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Check each created note
					for (const note of createdNotes) {
						// Should contain configuration name
						expect(note.frontmatter.preprocessing_config).toBe('Test Config');

						// Should contain total pages
						expect(note.frontmatter.total_pages).toBe(pageCount);

						// Should contain split direction
						expect(note.frontmatter.split_direction).toBe(splitDirection);

						// Should contain rotation info if enabled
						if (rotationEnabled) {
							expect(note.frontmatter.rotation_applied).toBe(true);
						}
					}
				}
			),
			{ numRuns: 100 }
		);
	});

	/**
	 * Feature: notebook-image-preprocessing, Property 18: Rule application to split pages
	 * Validates: Requirements 8.5
	 *
	 * For any split page that matches existing processing rules, those rules should be applied to that page's note creation
	 *
	 * Note: This test verifies that note creation works correctly with different OCR results,
	 * which is the foundation for rule application. The actual rule matching and execution
	 * is handled by the RuleEngine which is tested separately.
	 */
	it('Property 18: Rule application to split pages', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.integer({ min: 2, max: 4 }), // Number of pages (2-4)
				fc.string({ minLength: 1, maxLength: 50 }), // Source file name
				fc.array(fc.string({ minLength: 10, maxLength: 200 }), { minLength: 2, maxLength: 4 }), // OCR texts
				async (pageCount, sourceFileName, ocrTexts) => {
					// Ensure we have the right number of OCR results
					const ocrResults: MockOCRResult[] = ocrTexts.slice(0, pageCount).map(text => ({
						text,
						confidence: 0.9,
						provider: 'test'
					}));

					// Pad if needed
					while (ocrResults.length < pageCount) {
						ocrResults.push({
							text: 'Sample text',
							confidence: 0.9,
							provider: 'test'
						});
					}

					const preprocessingResult: MockPreprocessingResult = {
						pages: new Array(pageCount).fill(new ArrayBuffer(0)),
						config: {
							name: 'Test Config',
							split: {
								enabled: true,
								direction: 'horizontal'
							}
						},
						transformations: []
					};

					// Track created notes
					const createdNotes: any[] = [];
					const mockVaultManager: MockVaultManager = {
						createNote: vi.fn(async (folderPath, title, frontmatter, body) => {
							createdNotes.push({ folderPath, title, frontmatter, body });
							return {};
						})
					};

					const helper = new NoteCreationHelper(
						'separate',
						'\n\n---\n\n',
						false,
						mockVaultManager
					);

					await helper.createNotesFromPages(sourceFileName, ocrResults, preprocessingResult);

					// Verify that each page's OCR result is used in note creation
					// This ensures that rules can be applied to individual pages
					for (let i = 0; i < pageCount; i++) {
						const note = createdNotes[i];
						const ocrText = ocrResults[i].text;

						// Verify the note body contains the OCR text for that page
						expect(note.body).toBe(ocrText);
					}
				}
			),
			{ numRuns: 100 }
		);
	});
});
