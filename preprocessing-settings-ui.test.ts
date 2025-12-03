/**
 * Unit tests for PreprocessingSettingsUI
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreprocessingSettingsUI } from './preprocessing-settings-ui';
import { NotebookPreset, PRESET_CONFIGS } from './preprocessing-types';

// Mock Obsidian App
const mockApp = {} as any;

// Mock plugin with required settings and methods
const createMockPlugin = () => ({
    settings: {
        enablePreprocessing: true,
        defaultPreprocessingConfigId: 'preset-split-vertically',
        customPreprocessingConfigs: [],
        splitPageNoteMode: 'separate' as const,
        splitPageSeparator: '\n\n---\n\n',
        includePreprocessingMetadata: false
    },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    preprocessingConfigManager: {
        getAllConfigs: vi.fn().mockReturnValue([
            PRESET_CONFIGS[NotebookPreset.NO_PREPROCESSING],
            PRESET_CONFIGS[NotebookPreset.SPLIT_VERTICALLY],
            PRESET_CONFIGS[NotebookPreset.ROTATE_90_CLOCKWISE],
            PRESET_CONFIGS[NotebookPreset.ROTATE_90_COUNTERCLOCKWISE],
            PRESET_CONFIGS[NotebookPreset.TOP_SPIRAL_NOTEBOOK]
        ]),
        getConfig: vi.fn(),
        setDefaultConfig: vi.fn(),
        saveConfig: vi.fn(),
        deleteConfig: vi.fn(),
        duplicateConfig: vi.fn(),
        validateConfig: vi.fn()
    },
    settingTab: null
});

// Mock DOM element
class MockElement {
    children: MockElement[] = [];
    textContent: string = '';
    innerHTML: string = '';
    style: Record<string, string> = {};
    classList: string[] = [];

    createEl(tag: string, options?: any): MockElement {
        const el = new MockElement();
        if (options?.text) el.textContent = options.text;
        if (options?.cls) el.classList.push(options.cls);
        this.children.push(el);
        return el;
    }

    createDiv(options?: any): MockElement {
        return this.createEl('div', options);
    }

    createSpan(options?: any): MockElement {
        return this.createEl('span', options);
    }

    querySelector(selector: string): MockElement | null {
        // Simple implementation for testing
        for (const child of this.children) {
            if (child.classList.includes(selector.replace('.', ''))) {
                return child;
            }
            const found = child.querySelector(selector);
            if (found) return found;
        }
        return null;
    }

    querySelectorAll(selector: string): MockElement[] {
        const results: MockElement[] = [];
        for (const child of this.children) {
            if (child.classList.includes(selector.replace('.', ''))) {
                results.push(child);
            }
            results.push(...child.querySelectorAll(selector));
        }
        return results;
    }
}

// Mock Obsidian Setting class
vi.mock('obsidian', async () => {
    const actual = await vi.importActual<typeof import('./test-mocks/obsidian')>('./test-mocks/obsidian');
    return {
        ...actual,
        Setting: vi.fn().mockImplementation(function(this: any, containerEl: any) {
            this.containerEl = containerEl;
            this.nameEl = containerEl.createDiv();
            this.descEl = containerEl.createDiv();

            return {
                setName: vi.fn().mockReturnThis(),
                setDesc: vi.fn().mockReturnThis(),
                addToggle: vi.fn().mockReturnThis(),
                addDropdown: vi.fn().mockReturnThis(),
                addText: vi.fn().mockReturnThis(),
                addButton: vi.fn().mockReturnThis()
            };
        })
    };
});

describe('PreprocessingSettingsUI', () => {
    let settingsUI: PreprocessingSettingsUI;
    let mockPlugin: ReturnType<typeof createMockPlugin>;
    let containerEl: MockElement;

    beforeEach(() => {
        mockPlugin = createMockPlugin();
        settingsUI = new PreprocessingSettingsUI(mockApp, mockPlugin as any);
        containerEl = new MockElement();
    });

    describe('Centering Guidance', () => {
        /**
         * Test centering tip is displayed in settings
         * Requirements: 4.1, 4.2
         */
        it('should display centering tip when preprocessing is enabled', () => {
            mockPlugin.settings.enablePreprocessing = true;
            settingsUI.display(containerEl as any);

            // Find the centering tip div
            const tipDiv = containerEl.querySelector('.notebook-ocr-centering-tip');
            expect(tipDiv).toBeTruthy();
        });

        /**
         * Test centering tip contains expected text
         * Requirements: 4.1, 4.2
         */
        it('should display centering tip with correct content', () => {
            mockPlugin.settings.enablePreprocessing = true;
            settingsUI.display(containerEl as any);

            // Find the centering tip div
            const tipDiv = containerEl.querySelector('.notebook-ocr-centering-tip');
            expect(tipDiv).toBeTruthy();

            if (tipDiv) {
                // Check for icon
                const iconSpan = tipDiv.children.find(child => child.textContent === '💡');
                expect(iconSpan).toBeTruthy();

                // Check for text content - should contain key phrases
                // Collect all text from children recursively
                const collectText = (el: MockElement): string => {
                    let text = el.textContent;
                    el.children.forEach(child => {
                        text += ' ' + collectText(child);
                    });
                    return text;
                };

                const allText = collectText(tipDiv);
                expect(allText).toContain('Tip:');
                expect(allText).toContain('center');
                expect(allText).toContain('notebook');
                expect(allText).toContain('scanner');
                expect(allText).toContain('camera');
                expect(allText).toContain('split');
                expect(allText).toContain('accurat'); // matches both "accurate" and "accuracy"
            }
        });

        it('should not display centering tip when preprocessing is disabled', () => {
            mockPlugin.settings.enablePreprocessing = false;
            settingsUI.display(containerEl as any);

            const tipDiv = containerEl.querySelector('.notebook-ocr-centering-tip');
            expect(tipDiv).toBeNull();
        });
    });

    describe('Preset Display', () => {
        /**
         * Test that new preset names are displayed
         * Requirements: 1.1, 1.2, 1.3
         */
        it('should display new transformation-based preset names', () => {
            mockPlugin.settings.enablePreprocessing = true;
            settingsUI.display(containerEl as any);

            // Check that the container has config items
            const configItems = containerEl.querySelectorAll('.notebook-ocr-config-item');
            expect(configItems.length).toBeGreaterThan(0);

            // Collect all text recursively
            const collectText = (el: MockElement): string => {
                let text = el.textContent;
                el.children.forEach(child => {
                    text += ' ' + collectText(child);
                });
                return text;
            };

            const allText = collectText(containerEl);

            // Should contain new preset names
            expect(allText).toContain('Split Vertically');
            expect(allText).toContain('Rotate 90° Clockwise');
            expect(allText).toContain('Rotate 90° Counterclockwise');
            expect(allText).toContain('Top Spiral Notebook');
        });

        it('should display transformation-focused descriptions', () => {
            mockPlugin.settings.enablePreprocessing = true;
            settingsUI.display(containerEl as any);

            // Collect all text recursively
            const collectText = (el: MockElement): string => {
                let text = el.textContent + ' ' + el.innerHTML;
                el.children.forEach(child => {
                    text += ' ' + collectText(child);
                });
                return text;
            };

            const allText = collectText(containerEl);

            // Check for transformation-focused descriptions
            expect(allText).toContain('split');
            expect(allText).toContain('rotate');
        });
    });
});
