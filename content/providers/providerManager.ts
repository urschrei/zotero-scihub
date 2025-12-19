import type { IZotero } from '../../typings/zotero'
import type { Provider, CustomProvider, StoredProviders } from './types'
import { BUILTIN_PROVIDERS, DEFAULT_PROVIDER_ID, SCIHUB_PROVIDER } from './builtinProviders'

declare const Zotero: IZotero

const PREF_ACTIVE_PROVIDER = 'zoteroscihub.active_provider'
const PREF_CUSTOM_PROVIDERS = 'zoteroscihub.custom_providers'
const PREF_LEGACY_SCIHUB_URL = 'zoteroscihub.scihub_url'

export class ProviderManager {
  private builtinProviders: Map<string, Provider> = new Map()
  private customProviders: Map<string, CustomProvider> = new Map()
  private initialized = false

  public initialize(): void {
    if (this.initialized) return

    // Load built-in providers
    for (const provider of BUILTIN_PROVIDERS) {
      this.builtinProviders.set(provider.id, { ...provider })
    }

    // Migrate legacy Sci-Hub URL preference if present
    this.migrateLegacyPrefs()

    // Load custom providers from preferences
    this.loadCustomProviders()

    this.initialized = true
  }

  /**
   * Migrate legacy zoteroscihub.scihub_url preference to the new provider system
   */
  private migrateLegacyPrefs(): void {
    const legacyUrl = Zotero.Prefs.get(PREF_LEGACY_SCIHUB_URL)
    if (legacyUrl && typeof legacyUrl === 'string') {
      // Update Sci-Hub provider's URL template if it differs from default
      const scihubProvider = this.builtinProviders.get('scihub')
      if (scihubProvider && legacyUrl !== SCIHUB_PROVIDER.urlTemplate) {
        // Ensure the URL ends with {DOI} placeholder
        let urlTemplate = legacyUrl.trim()
        if (!urlTemplate.endsWith('/')) {
          urlTemplate += '/'
        }
        urlTemplate += '{DOI}'
        scihubProvider.urlTemplate = urlTemplate
      }
    }

    // Ensure active provider is set
    if (Zotero.Prefs.get(PREF_ACTIVE_PROVIDER) === undefined) {
      Zotero.Prefs.set(PREF_ACTIVE_PROVIDER, DEFAULT_PROVIDER_ID)
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
   * Update a built-in provider's URL template
   */
  public updateBuiltinProviderUrl(id: string, urlTemplate: string): void {
    const provider = this.builtinProviders.get(id)
    if (!provider) {
      throw new Error(`Built-in provider not found: ${id}`)
    }
    provider.urlTemplate = urlTemplate

    // For backwards compatibility, also update the legacy pref for Sci-Hub
    if (id === 'scihub') {
      // Extract base URL (remove {DOI} placeholder)
      const baseUrl = `${urlTemplate.replace('{DOI}', '').replace(/\/$/, '')}/`
      Zotero.Prefs.set(PREF_LEGACY_SCIHUB_URL, baseUrl)
    }
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
