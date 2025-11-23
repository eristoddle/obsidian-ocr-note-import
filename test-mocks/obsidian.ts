/**
 * Mock for Obsidian API
 */

export class App {}

export class Modal {
    app: App;
    contentEl: HTMLElement;

    constructor(app: App) {
        this.app = app;
        this.contentEl = document.createElement('div');
    }

    open(): void {}
    close(): void {}
    onOpen(): void {}
    onClose(): void {}
}

export class Notice {
    constructor(message: string) {}
}
