import type { ZoteroItem, IZotero, ZoteroObserver } from '../typings/zotero'
import { ItemPane } from './itemPane'
import { ToolsPane } from './toolsPane'
import { PrefPane } from './prefPane'
import { UrlUtil } from './urlUtil'
import { ZoteroUtil } from './zoteroUtil'
import { MenuManager } from 'zotero-plugin-toolkit'

declare const Zotero: IZotero
declare const window: Window | undefined
declare const rootURI: string | undefined

// Menu manager for Zotero 7/8
const Menu = new MenuManager()

enum HttpCodes {
  DONE = 200,
}

class PdfNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfNotFoundError'
    Object.setPrototypeOf(this, PdfNotFoundError.prototype)
  }
}

class ItemObserver implements ZoteroObserver {
  // Called when a new item is added to the library
  public async notify(event: string, _type: string, ids: [number], _extraData: Record<string, any>) {
    const automaticPdfDownload = Zotero.Scihub.isAutomaticPdfDownload()

    if (event === 'add' && automaticPdfDownload) {
      const items = await Zotero.Items.getAsync(ids) as ZoteroItem[]
      await Zotero.Scihub.updateItems(items)
    }
  }
}

class Scihub {
  // TODO: only bulk-update items which are missing paper attachment
  private static readonly DEFAULT_SCIHUB_URL = 'https://sci-hub.ru/'
  private static readonly DEFAULT_AUTOMATIC_PDF_DOWNLOAD = true
  private observerId: number | null = null
  private initialized = false
  private menuIds: string[] = []
  public ItemPane: ItemPane
  public PrefPane: PrefPane
  public ToolsPane: ToolsPane

  constructor() {
    this.ItemPane = new ItemPane()
    this.PrefPane = new PrefPane()
    this.ToolsPane = new ToolsPane()
  }

  // Called by bootstrap.ts on plugin startup
  public startup(reason: string): void {
    Zotero.debug(`Scihub: startup (${reason})`)
    this.registerObserver()
  }

  // Called by bootstrap.ts on plugin shutdown
  public shutdown(): void {
    Zotero.debug('Scihub: shutdown')
    this.unregisterObserver()
    this.unregisterMenus()
  }

  // Called when main Zotero window loads
  public onMainWindowLoad(win: Window): void {
    Zotero.debug('Scihub: main window loaded')
    this.registerMenus(win)
  }

  // Called when main Zotero window unloads
  public onMainWindowUnload(_win: Window): void {
    Zotero.debug('Scihub: main window unloading')
    this.unregisterMenus()
  }

  // Register the item observer for automatic PDF downloads
  private registerObserver(): void {
    if (this.initialized) return
    this.observerId = Zotero.Notifier.registerObserver(new ItemObserver(), ['item'], 'Scihub')
    this.initialized = true
  }

  // Unregister the item observer
  private unregisterObserver(): void {
    if (this.observerId) {
      Zotero.Notifier.unregisterObserver(this.observerId)
      this.observerId = null
    }
    this.initialized = false
  }

  // Register context menu items using MenuManager
  private registerMenus(_win: Window): void {
    // Register item context menu item
    Menu.register('item', {
      tag: 'menuitem',
      id: 'zotero-itemmenu-scihub',
      label: 'Update Sci-Hub PDF',
      icon: 'chrome://zotero-scihub/skin/sci-hub-logo.svg',
      commandListener: () => { void this.ItemPane.updateSelectedItems() },
    })
    this.menuIds.push('zotero-itemmenu-scihub')

    // Register collection context menu item
    Menu.register('collection', {
      tag: 'menuitem',
      id: 'zotero-collectionmenu-scihub',
      label: 'Update Collection Sci-Hub PDFs',
      icon: 'chrome://zotero-scihub/skin/sci-hub-logo.svg',
      commandListener: () => { void this.ItemPane.updateSelectedEntity('') },
    })
    this.menuIds.push('zotero-collectionmenu-scihub')

    // Register tools menu item
    Menu.register('menuTools', {
      tag: 'menuitem',
      id: 'zotero-scihub-tools-updateall',
      label: 'Update All Sci-Hub PDFs',
      icon: 'chrome://zotero-scihub/skin/sci-hub-logo.svg',
      commandListener: () => { void this.ToolsPane.updateAll() },
    })
    this.menuIds.push('zotero-scihub-tools-updateall')
  }

  // Unregister all menu items
  private unregisterMenus(): void {
    Menu.unregisterAll()
    this.menuIds = []
  }

  public getBaseScihubUrl(): string {
    if (Zotero.Prefs.get('zoteroscihub.scihub_url') === undefined) {
      Zotero.Prefs.set('zoteroscihub.scihub_url', Scihub.DEFAULT_SCIHUB_URL)
    }

    return Zotero.Prefs.get('zoteroscihub.scihub_url') as string
  }

  public isAutomaticPdfDownload(): boolean {
    if (Zotero.Prefs.get('zoteroscihub.automatic_pdf_download') === undefined) {
      Zotero.Prefs.set('zoteroscihub.automatic_pdf_download', Scihub.DEFAULT_AUTOMATIC_PDF_DOWNLOAD)
    }

    return Zotero.Prefs.get('zoteroscihub.automatic_pdf_download') as boolean
  }

  // Legacy methods - kept for compatibility but no longer used
  public load(): void {
    this.registerObserver()
  }

  public unload(): void {
    this.unregisterObserver()
  }

  public async updateItems(items: ZoteroItem[]): Promise<void> {
    // WARN: Sequentially go through items, parallel will fail due to rate-limiting
    // Cycle needs to be broken if scihub asks for Captcha,
    // then user have to be redirected to the page to fill it in
    for (const item of items) {
      // Skip items which are not processable
      if (!item.isRegularItem() || item.isCollection()) { continue }

      // Skip items without DOI or if URL generation had failed
      const scihubUrl = this.generateScihubItemUrl(item)
      if (!scihubUrl) {
        ZoteroUtil.showPopup('DOI is missing', item.getField('title'), true)
        Zotero.debug(`scihub: failed to generate URL for "${item.getField('title')}"`)
        continue
      }

      try {
        await this.updateItem(scihubUrl, item)
      } catch (error) {
        if (error instanceof PdfNotFoundError) {
          // Do not stop traversing items if PDF is missing for one of them
          ZoteroUtil.showPopup('PDF not available', `Try again later.\n"${item.getField('title')}"`, true)
          continue
        } else {
          // Break if Captcha is reached, alert user and redirect
          const alertFn = Zotero.getMainWindow()?.alert || alert
          alertFn(
            `Captcha is required or PDF is not ready yet for "${item.getField('title')}".\n\
            You will be redirected to the scihub page.\n\
            Restart fetching process manually.\n\
            Error message: ${error}`)
          Zotero.launchURL(scihubUrl.href)
          break
        }
      }
    }
  }

  private async updateItem(scihubUrl: URL, item: ZoteroItem) {
    ZoteroUtil.showPopup('Fetching PDF', item.getField('title'))

    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) ' +
      'AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1'
    const xhr = await Zotero.HTTP.request('GET', scihubUrl.href, {
      responseType: 'document',
      headers: { 'User-Agent': userAgent },
    })
    // older .tf domains have iframe element, newer .st domain have embed element
    const rawPdfUrl = xhr.responseXML?.querySelector('#pdf')?.getAttribute('src')
    let pdfUrl = rawPdfUrl
    if (rawPdfUrl !== undefined && (!rawPdfUrl?.startsWith('http') && !rawPdfUrl?.startsWith('//'))) {
      pdfUrl = `${this.getBaseScihubUrl()}${rawPdfUrl}`
    }
    const body = xhr.responseXML?.querySelector('body')
    const statusCode: number = xhr.status

    if (statusCode === (HttpCodes.DONE as number) && pdfUrl) {
      const httpsUrl = UrlUtil.urlToHttps(pdfUrl)
      await ZoteroUtil.attachRemotePDFToItem(httpsUrl, item)
    } else if (statusCode === (HttpCodes.DONE as number) && this.isPdfNotAvailable(body)) {
      Zotero.debug(`scihub: PDF is not available at the moment "${scihubUrl}"`)
      throw new PdfNotFoundError(`Pdf is not available: ${scihubUrl}`)
    } else {
      Zotero.debug(`scihub: failed to fetch PDF from "${scihubUrl}"`)
      throw new Error(xhr.statusText)
    }
  }

  private isPdfNotAvailable(body: HTMLBodyElement | null | undefined): boolean {
    const innerHTML = body?.innerHTML
    // older .tf domain return rich error message
    // newer .st domains return empty page if pdf is not available
    if (!innerHTML || innerHTML?.trim() === '' ||
      innerHTML?.match(/Please try to search again using DOI/im) ||
      innerHTML?.match(/статья не найдена в базе/im)) {
      return true
    }
    return false
  }

  private getDoi(item: ZoteroItem): string | null {
    const doiField = item.getField('DOI')
    const doiFromExtra = this.getDoiFromExtra(item)
    const doiFromUrl = this.getDoiFromUrl(item)
    const doi = doiField ?? doiFromExtra ?? doiFromUrl

    if (doi && (typeof doi === 'string') && doi.length > 0) {
      return doi
    }
    return null
  }

  private getDoiFromExtra(item: ZoteroItem): string | null {
    // For books "extra" field might contain DOI instead
    // values in extra are <key>: <value> separated by newline
    const extra = item.getField('extra')
    const match = extra?.match(/^DOI: (.+)$/m)
    if (match) {
      return match[1]
    }
    return null
  }

  private getDoiFromUrl(item: ZoteroItem): string | null {
    // If item was added by the doi.org url it can be extracted from its pathname
    const url = item.getField('url')
    const isDoiOrg = url?.match(/\bdoi\.org\b/i)
    if (isDoiOrg) {
      const doiPath = new URL(url).pathname
      return decodeURIComponent(doiPath).replace(/^\//, '')
    }
    return null
  }

  private generateScihubItemUrl(item: ZoteroItem): URL | null {
    const doi = this.getDoi(item)
    if (doi) {
      const baseUrl = this.getBaseScihubUrl()
      return new URL(doi, baseUrl)
    }
    return null
  }
}

Zotero.Scihub = new Scihub()

// Legacy initialization for Zotero 6 compatibility (if XUL overlays are still used)
// In Zotero 7/8, initialization is handled by bootstrap.ts
if (typeof window !== 'undefined' && typeof rootURI === 'undefined') {
  // Only attach listeners in legacy mode (non-bootstrap)
  window.addEventListener('load', _ => {
    Zotero.Scihub.load()
  }, false)
  window.addEventListener('unload', _ => {
    Zotero.Scihub.unload()
  }, false)
}

export { Scihub }
