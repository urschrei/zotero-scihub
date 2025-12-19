// Test setup - register mocks before tests run
import { vi } from 'vitest'
import { JSDOM } from 'jsdom'

// Set up DOMParser before any other imports
globalThis.DOMParser = new JSDOM().window.DOMParser

// Mock zotero-plugin-toolkit
vi.mock('zotero-plugin-toolkit', () => ({
  MenuManager: class {
    register(_menu: string, _options: Record<string, unknown>): void {
      // Mock implementation
    }

    unregisterAll(): void {
      // Mock implementation
    }
  },
}))

// Import and set up Zotero mock
import { Zotero } from './zotero.mock'
globalThis.Zotero = Zotero

// Since there is catch-all in the code which raises alerts
globalThis.alert = (m: string) => { throw new Error(m) }
