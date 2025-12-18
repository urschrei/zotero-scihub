import type { IZotero, IZoteroPane } from '../typings/zotero'
declare const Zotero: IZotero

// Get ZoteroPane via Zotero API (not a global in Zotero 7/8)
function getZoteroPane(): IZoteroPane | null {
  return Zotero.getActiveZoteroPane?.() ?? null
}

class ItemPane {
  public async updateSelectedEntity(libraryId: string): Promise<void> {
    Zotero.debug(`scihub: updating items in entity ${libraryId}`)
    const zoteroPane = getZoteroPane()
    if (!zoteroPane) {
      Zotero.debug('scihub: ZoteroPane not available')
      return
    }

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
    Zotero.debug('scihub: updating selected items')
    try {
      const zoteroPane = getZoteroPane()
      if (!zoteroPane) {
        Zotero.debug('scihub: ZoteroPane not available')
        return
      }

      const items = zoteroPane.getSelectedItems()
      Zotero.debug(`scihub: found ${items?.length ?? 0} selected items`)
      if (items && items.length > 0) {
        await Zotero.Scihub.updateItems(items)
      } else {
        Zotero.debug('scihub: no items selected')
      }
    } catch (err) {
      Zotero.debug(`scihub: error getting selected items: ${err}`)
      Zotero.logError(err as Error)
    }
  }
}

export { ItemPane }
