import type { IZotero } from '../../typings/zotero'
import type { Provider, CustomProvider, StoredProviders } from './types'
import { BUILTIN_PROVIDERS, DEFAULT_PROVIDER_ID, SCIHUB_PROVIDER } from './builtinProviders'

declare const Zotero: IZotero

const PREF_ACTIVE_PROVIDER = 'pdferret.active_provider'
const PREF_CUSTOM_PROVIDERS = 'pdferret.custom_providers'
const PREF_BUILTIN_URL_OVERRIDES = 'pdferret.builtin_url_overrides'
const PREF_LEGACY_SCIHUB_URL = 'pdferret.scihub_url'

// Store default URL templates for built-in providers (for reset functionality)
const defaultUrlTemplates: Map<string, string> = new Map()

export class ProviderManager {
  private builtinProviders: Map<string, Provider> = new Map()
  private customProviders: Map<string, CustomProvider> = new Map()
  private initialized = false

  public initialize(): void {
    if (this.initialized) return

    // Load built-in providers and store their default URLs
    for (const provider of BUILTIN_PROVIDERS) {
      this.builtinProviders.set(provider.id, { ...provider })
      defaultUrlTemplates.set(provider.id, provider.urlTemplate)
    }

    // Migrate legacy Sci-Hub URL preference if present
    this.migrateLegacyPrefs()

    // Load URL overrides for built-in providers
    this.loadBuiltinUrlOverrides()

    // Load custom providers from preferences
    this.loadCustomProviders()

    this.initialized = true
  }

  /**
   * Migrate legacy zoteroscihub.scihub_url preference to the new URL overrides system
   */
  private migrateLegacyPrefs(): void {
    const legacyUrl = Zotero.Prefs.get(PREF_LEGACY_SCIHUB_URL)
    if (legacyUrl && typeof legacyUrl === 'string') {
      // Check if we already have overrides (migration already done)
      const existingOverrides = Zotero.Prefs.get(PREF_BUILTIN_URL_OVERRIDES)
      if (!existingOverrides) {
        // Migrate to new format
        let urlTemplate = legacyUrl.trim()
        if (!urlTemplate.endsWith('/')) {
          urlTemplate += '/'
        }
        urlTemplate += '{DOI}'

        // Only migrate if different from default
        if (urlTemplate !== SCIHUB_PROVIDER.urlTemplate) {
          const overrides: Record<string, string> = { scihub: urlTemplate }
          Zotero.Prefs.set(PREF_BUILTIN_URL_OVERRIDES, JSON.stringify(overrides))
        }
      }
    }

    // Ensure active provider is set
    if (Zotero.Prefs.get(PREF_ACTIVE_PROVIDER) === undefined) {
      Zotero.Prefs.set(PREF_ACTIVE_PROVIDER, DEFAULT_PROVIDER_ID)
    }
  }

  /**
   * Load URL overrides for built-in providers from preferences
   */
  private loadBuiltinUrlOverrides(): void {
    const stored = Zotero.Prefs.get(PREF_BUILTIN_URL_OVERRIDES)
    if (stored && typeof stored === 'string') {
      try {
        const overrides = JSON.parse(stored) as Record<string, string>
        for (const [providerId, urlTemplate] of Object.entries(overrides)) {
          const provider = this.builtinProviders.get(providerId)
          if (provider && urlTemplate) {
            provider.urlTemplate = urlTemplate
          }
        }
      } catch (e) {
        Zotero.debug(`ProviderManager: Failed to parse URL overrides: ${e}`)
      }
    }
  }

  /**
   * Load custom providers from preferences
   */
  private loadCustomProviders(): void {
    const stored = Zotero.Prefs.get(PREF_CUSTOM_PROVIDERS)
    if (stored && typeof stored === 'string') {
      try {
        const parsed = JSON.parse(stored) as StoredProviders
        if (parsed.version === 1 && Array.isArray(parsed.providers)) {
          for (const provider of parsed.providers) {
            this.customProviders.set(provider.id, provider)
          }
        }
      } catch (e) {
        Zotero.debug(`ProviderManager: Failed to parse custom providers: ${e}`)
      }
    }
  }

  /**
   * Persist custom providers to preferences
   */
  private persistCustomProviders(): void {
    const stored: StoredProviders = {
      version: 1,
      providers: Array.from(this.customProviders.values()),
    }
    Zotero.Prefs.set(PREF_CUSTOM_PROVIDERS, JSON.stringify(stored))
  }

  /**
   * Get all providers (built-in + custom)
   */
  public getProviders(): Provider[] {
    return [
      ...Array.from(this.builtinProviders.values()),
      ...Array.from(this.customProviders.values()),
    ]
  }

  /**
   * Get a provider by ID
   */
  public getProvider(id: string): Provider | undefined {
    return this.builtinProviders.get(id) ?? this.customProviders.get(id)
  }

  /**
   * Get the currently active provider
   */
  public getActiveProvider(): Provider {
    const activeId = Zotero.Prefs.get(PREF_ACTIVE_PROVIDER) as string | undefined
    const provider = activeId ? this.getProvider(activeId) : undefined
    // Fall back to Sci-Hub if active provider not found
    return provider ?? this.builtinProviders.get(DEFAULT_PROVIDER_ID)!
  }

  /**
   * Set the active provider
   */
  public setActiveProvider(id: string): void {
    if (!this.getProvider(id)) {
      throw new Error(`Provider not found: ${id}`)
    }
    Zotero.Prefs.set(PREF_ACTIVE_PROVIDER, id)
  }

  /**
   * Update a built-in provider's URL template and persist to preferences
   */
  public updateBuiltinProviderUrl(id: string, urlTemplate: string): void {
    const provider = this.builtinProviders.get(id)
    if (!provider) {
      throw new Error(`Built-in provider not found: ${id}`)
    }
    provider.urlTemplate = urlTemplate

    // Persist to URL overrides
    this.persistBuiltinUrlOverride(id, urlTemplate)
  }

  /**
   * Persist a built-in provider's URL override to preferences
   */
  private persistBuiltinUrlOverride(id: string, urlTemplate: string): void {
    let overrides: Record<string, string> = {}

    // Load existing overrides
    const stored = Zotero.Prefs.get(PREF_BUILTIN_URL_OVERRIDES)
    if (stored && typeof stored === 'string') {
      try {
        overrides = JSON.parse(stored) as Record<string, string>
      } catch {
        // Start fresh if parsing fails
      }
    }

    // Update or remove the override
    const defaultUrl = defaultUrlTemplates.get(id)
    if (urlTemplate === defaultUrl) {
      // Remove override if it matches the default
      delete overrides[id]
    } else {
      overrides[id] = urlTemplate
    }

    // Save back to preferences
    if (Object.keys(overrides).length > 0) {
      Zotero.Prefs.set(PREF_BUILTIN_URL_OVERRIDES, JSON.stringify(overrides))
    } else {
      // Clear the preference if no overrides remain
      Zotero.Prefs.set(PREF_BUILTIN_URL_OVERRIDES, '')
    }
  }

  /**
   * Get the default URL template for a built-in provider
   */
  public getDefaultUrlTemplate(id: string): string | undefined {
    return defaultUrlTemplates.get(id)
  }

  /**
   * Add a new custom provider
   */
  public addCustomProvider(provider: Omit<CustomProvider, 'isBuiltin'>): void {
    if (this.getProvider(provider.id)) {
      throw new Error(`Provider already exists: ${provider.id}`)
    }
    const customProvider: CustomProvider = { ...provider, isBuiltin: false }
    this.customProviders.set(provider.id, customProvider)
    this.persistCustomProviders()
  }

  /**
   * Update a custom provider
   */
  public updateCustomProvider(id: string, updates: Partial<Omit<CustomProvider, 'id' | 'isBuiltin'>>): void {
    const provider = this.customProviders.get(id)
    if (!provider) {
      throw new Error(`Custom provider not found: ${id}`)
    }
    Object.assign(provider, updates)
    this.persistCustomProviders()
  }

  /**
   * Remove a custom provider
   */
  public removeCustomProvider(id: string): void {
    if (!this.customProviders.has(id)) {
      throw new Error(`Custom provider not found: ${id}`)
    }
    this.customProviders.delete(id)
    this.persistCustomProviders()

    // If this was the active provider, switch to default
    const activeId = Zotero.Prefs.get(PREF_ACTIVE_PROVIDER)
    if (activeId === id) {
      Zotero.Prefs.set(PREF_ACTIVE_PROVIDER, DEFAULT_PROVIDER_ID)
    }
  }

  /**
   * Generate a unique ID for a new custom provider
   */
  public generateCustomProviderId(): string {
    let counter = 1
    while (this.getProvider(`custom-${counter}`)) {
      counter++
    }
    return `custom-${counter}`
  }
}

// Singleton instance
export const providerManager = new ProviderManager()
