import type { IZotero } from '../../typings/zotero'
import type { Provider } from '../providers/types'

declare const Zotero: IZotero

/**
 * Zotero PDF resolver format as expected by extensions.zotero.findPDFs.resolvers
 */
interface ZoteroResolver {
  name: string
  method: 'GET'
  url: string
  mode: 'html'
  selector: string
  attribute?: string
  automatic: boolean
  /** Internal marker to identify PDFerret-managed resolvers */
  pdferretManaged?: boolean
}

const RESOLVER_PREF = 'extensions.zotero.findPDFs.resolvers'

/**
 * Manages Zotero's PDF resolver preference.
 * Converts PDFerret providers to Zotero resolver format and syncs them to the preference.
 */
class ResolverManager {
  /**
   * Get all resolvers currently in Zotero's preference
   */
  private getAllResolvers(): ZoteroResolver[] {
    const stored = Zotero.Prefs.get(RESOLVER_PREF, true) as string | undefined
    if (!stored || typeof stored !== 'string') {
      return []
    }

    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed as ZoteroResolver[]
      }
    } catch (e) {
      Zotero.debug(`ResolverManager: Failed to parse resolvers preference: ${e}`)
    }
    return []
  }

  /**
   * Get resolvers that were NOT created by PDFerret (user-configured or from other sources)
   */
  private getExternalResolvers(): ZoteroResolver[] {
    return this.getAllResolvers().filter(r => !r.pdferretManaged)
  }

  /**
   * Convert a PDFerret provider to Zotero resolver format
   */
  private providerToResolver(provider: Provider, automatic: boolean): ZoteroResolver {
    // Zotero uses lowercase {doi} placeholder
    const url = provider.urlTemplate.replace('{DOI}', '{doi}')

    return {
      name: provider.name,
      method: 'GET',
      url,
      mode: 'html',
      selector: provider.selector,
      attribute: provider.attribute,
      automatic,
      pdferretManaged: true,
    }
  }

  /**
   * Sync PDFerret providers to Zotero's resolver preference.
   * Preserves any external (non-PDFerret) resolvers.
   */
  public syncProviders(providers: Provider[], automatic: boolean): void {
    Zotero.debug('ResolverManager: Syncing providers to Zotero resolvers')

    // Get external resolvers (not managed by PDFerret)
    const externalResolvers = this.getExternalResolvers()

    // Convert our providers to resolvers
    const pdferretResolvers = providers.map(p => this.providerToResolver(p, automatic))

    // Combine: PDFerret resolvers first, then external
    const allResolvers = [...pdferretResolvers, ...externalResolvers]

    // Write to preference
    Zotero.Prefs.set(RESOLVER_PREF, JSON.stringify(allResolvers), true)

    Zotero.debug(`ResolverManager: Registered ${pdferretResolvers.length} PDFerret resolvers, ` +
      `preserved ${externalResolvers.length} external resolvers`)
  }

  /**
   * Remove all PDFerret-managed resolvers from Zotero's preference.
   * Called on plugin shutdown/disable.
   */
  public cleanup(): void {
    Zotero.debug('ResolverManager: Cleaning up PDFerret resolvers')

    // Keep only external resolvers
    const externalResolvers = this.getExternalResolvers()

    if (externalResolvers.length > 0) {
      Zotero.Prefs.set(RESOLVER_PREF, JSON.stringify(externalResolvers), true)
    } else {
      // Clear the preference entirely if no resolvers remain
      Zotero.Prefs.set(RESOLVER_PREF, '', true)
    }

    Zotero.debug(`ResolverManager: Cleanup complete, ${externalResolvers.length} external resolvers preserved`)
  }
}

// Singleton instance
export const resolverManager = new ResolverManager()
