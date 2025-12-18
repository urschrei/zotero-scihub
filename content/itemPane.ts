import type { IZotero, IZoteroPane } from '../typings/zotero'
declare const Zotero: IZotero

// Get ZoteroPane via Zotero API (not a global in Zotero 7/8)
function getZoteroPane(): IZoteroPane | null {
  return Zotero.getActiveZoteroPane?.() ?? null
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
      const items = collection.getChildItems(false, false)
      await Zotero.Scihub.updateItems(items)
    }
  }

  public async updateSelectedItems(): Promise<void> {
    try {
      const zoteroPane = getZoteroPane()
      if (!zoteroPane) return

      const items = zoteroPane.getSelectedItems()
      if (items && items.length > 0) {
        await Zotero.Scihub.updateItems(items)
      }
    } catch (err) {
      Zotero.logError(err as Error)
    }
  }
}

export { ItemPane }
