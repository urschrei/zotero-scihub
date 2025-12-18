// Test setup - register mocks before tests run
import Module from 'module'

// Store original require
const originalRequire = Module.prototype.require

// Mock zotero-plugin-toolkit
const mockMenuManager = {
  MenuManager: class {
    register(_menu: string, _options: Record<string, unknown>): void {
      // Mock implementation
    }

    unregisterAll(): void {
      // Mock implementation
    }
  },
}

// Override require to intercept zotero-plugin-toolkit
Module.prototype.require = function (id: string) {
  if (id === 'zotero-plugin-toolkit') {
    return mockMenuManager
  }
  // eslint-disable-next-line prefer-rest-params
  return originalRequire.apply(this, arguments as unknown as [string])
}
