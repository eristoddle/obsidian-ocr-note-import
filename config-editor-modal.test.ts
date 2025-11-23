
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ConfigEditorModal } from './config-editor-modal';
import { App } from 'obsidian';
import { PreprocessingConfig, SplitDirection, RotationTiming, RotationAngle, NotebookPreset } from './preprocessing-types';

// Mock canvas operations for testing
class MockCanvasRenderingContext2D {
    canvas: HTMLCanvasElement;
    fillStyle: string = '';
    strokeStyle: string = '';
    lineWidth: number = 1;
    font: string = '';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    fillRect(...args: any[]): void {}
    beginPath(): void {}
    moveTo(...args: any[]): void {}
    lineTo(...args: any[]): void {}
    stroke(): void {}
    fillText(...args: any[]): void {}
    getContext(type: string) { return this; }
}

// Mock App
const mockApp = {} as App;

// Mock Plugin
const mockPlugin = {
    settings: {
        customPreprocessingConfigs: []
    },
    saveSettings: vi.fn(),
    preprocessingConfigManager: {
        validateConfig: vi.fn(() => []),
        saveConfig: vi.fn(),
        getAllConfigs: vi.fn(() => []),
        getConfig: vi.fn(),
        setDefaultConfig: vi.fn(),
        deleteConfig: vi.fn(),
        duplicateConfig: vi.fn()
    }
} as any;

describe('ConfigEditorModal', () => {
    beforeEach(() => {
        // Mock HTMLCanvasElement
        HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
            if (contextType === '2d') {
                const canvas = document.createElement('canvas');
                return new MockCanvasRenderingContext2D(canvas) as any;
            }
            return null;
        });

        HTMLCanvasElement.prototype.toBlob = vi.fn(function(this: HTMLCanvasElement, callback: BlobCallback, type?: string, quality?: any) {
            const mockImageData = new Uint8Array(100);
            const blob = new Blob([mockImageData], { type: type || 'image/jpeg' });
            setTimeout(() => callback(blob), 0);
        });
    });

    describe('Sample Image Generation', () => {
        /**
         * Feature: config-editor-preview, Property 28: Sample image has valid dimensions
         * Validates: Requirements 7.5
         *
         * The generated sample image should always have positive dimensions and be a valid ArrayBuffer
         */
        it('should generate sample image with valid dimensions', async () => {
            // Create modal instance
            const modal = new ConfigEditorModal(mockApp, mockPlugin);

            // Access private method via type assertion
            const sampleImage = await (modal as any).createSampleImage();

            expect(sampleImage).toBeInstanceOf(ArrayBuffer);
            expect(sampleImage.byteLength).toBeGreaterThan(0);
        });
    });
});
