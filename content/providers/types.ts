/**
 * Configuration for a PDF source provider.
 */
export interface Provider {
  /** Unique identifier for this provider */
  id: string

  /** Human-readable name for UI display */
  name: string

  /** URL template with {DOI} placeholder, e.g. 'https://sci-hub.ru/{DOI}' */
  urlTemplate: string

  /** Text to match for finding the download link (for simple extraction) */
  linkText?: string

  /** Whether this is a built-in provider (cannot be deleted) */
  isBuiltin: boolean
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
