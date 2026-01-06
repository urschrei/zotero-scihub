/**
 * Configuration for a PDF source provider.
 * Providers are registered as Zotero PDF resolvers via extensions.zotero.findPDFs.resolvers
 */
export interface Provider {
  /** Unique identifier for this provider */
  id: string

  /** Human-readable name for UI display */
  name: string

  /** URL template with {DOI} placeholder, e.g. 'https://sci-hub.ru/{DOI}' */
  urlTemplate: string

  /** Whether this is a built-in provider (cannot be deleted) */
  isBuiltin: boolean

  /** CSS selector to find the PDF element on the provider's page */
  selector: string

  /** HTML attribute containing the PDF URL (defaults to 'src' or 'href') */
  attribute?: string
}

/**
 * Custom provider configuration (user-defined, always not built-in)
 */
export type CustomProvider = Omit<Provider, 'isBuiltin'> & { isBuiltin: false }

/**
 * Stored format for custom providers in preferences
 */
export interface StoredProviders {
  version: 1
  providers: CustomProvider[]
}
