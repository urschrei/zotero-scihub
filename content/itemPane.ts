import type { ZoteroItem, IZotero, IZoteroPane } from '../typings/zotero'
declare const Zotero: IZotero

// Get ZoteroPane via Zotero API (not a global in Zotero 7/8)
function getZoteroPane(): IZoteroPane | null {
  return Zotero.getActiveZoteroPane?.() ?? null
}

/**
 * Find available PDFs for items using Zotero's native resolver system.
 * This uses the resolvers registered in extensions.zotero.findPDFs.resolvers
 */
async function findAvailablePDFs(items: ZoteroItem[]): Promise<void> {
  // Filter to regular items only (not attachments/notes)
  const regularItems = items.filter(item => item.isRegularItem())

  if (regularItems.length === 0) {
    return
  }

  // Use Zotero's built-in PDF finding which uses our registered resolvers
  // addAvailablePDFs handles the progress window and bulk operations
  await Zotero.Attachments.addAvailablePDFs(regularItems)
}

class ItemPane {
  public async updateSelectedEntity(_libraryId: string): Promise<void> {
    const zoteroPane = getZoteroPane()
    if (!zoteroPane) return

    if (!zoteroPane.canEdit()) {
      zoteroPane.displayCannotEditLibraryMessage()
      return
    }

    const collection = zoteroPane.getSelectedCollection(false)
    if (collection) {
      const items = collection.getChildItems(false, false) as ZoteroItem[]
      await findAvailablePDFs(items)
    }
  }

  public async updateSelectedItems(): Promise<void> {
    try {
      const zoteroPane = getZoteroPane()
      if (!zoteroPane) return

      const items = zoteroPane.getSelectedItems() as ZoteroItem[]
      if (items && items.length > 0) {
        await findAvailablePDFs(items)
      }
    } catch (err) {
      Zotero.logError(err as Error)
    }
  }
}

export { ItemPane }
