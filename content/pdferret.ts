import type { ZoteroItem, IZotero, ZoteroObserver } from '../typings/zotero'
import { ItemPane } from './itemPane'
import { ToolsPane } from './toolsPane'
import { UrlUtil } from './urlUtil'
import { ZoteroUtil } from './zoteroUtil'
import { MenuManager } from 'zotero-plugin-toolkit'
import { providerManager, pdfExtractor } from './providers'
import type { Provider } from './providers'
import { getString, initLocale } from './locale'
import {
  PDFerretError,
  ConnectionError,
  TimeoutError,
  CaptchaRequiredError,
  RateLimitedError,
  PdfNotFoundError,
  PdfNotReadyError,
  UnknownError
} from './errors'

declare const Zotero: IZotero
declare const window: Window | undefined
declare const rootURI: string | undefined

// Menu manager for Zotero 7/8
const Menu = new MenuManager()

enum HttpCodes {
  DONE = 200,
}

class ItemObserver implements ZoteroObserver {
  // Called when a new item is added to the library
  public async notify(event: string, _type: string, ids: [number], _extraData: Record<string, any>) {
    const automaticPdfDownload = Zotero.PDFerret.isAutomaticPdfDownload()

    if (event === 'add' && automaticPdfDownload) {
      const items = await Zotero.Items.getAsync(ids) as ZoteroItem[]
      await Zotero.PDFerret.updateItems(items)
    }
  }
}

class PDFerret {
  private static readonly DEFAULT_AUTOMATIC_PDF_DOWNLOAD = true
  private observerId: number | null = null
  private initialized = false
  private menuIds: string[] = []
  public ItemPane: ItemPane
  public ToolsPane: ToolsPane

  constructor() {
    this.ItemPane = new ItemPane()
    this.ToolsPane = new ToolsPane()
  }

  // Called by bootstrap.ts on plugin startup
  public startup(reason: string): void {
    Zotero.debug(`PDFerret: startup (${reason})`)
    initLocale()
    providerManager.initialize()
    this.registerObserver()
  }

  // Called by bootstrap.ts on plugin shutdown
  public shutdown(): void {
    Zotero.debug('PDFerret: shutdown')
    this.unregisterObserver()
    this.unregisterMenus()
  }

  // Called when main Zotero window loads
  public onMainWindowLoad(win: Window): void {
    Zotero.debug('PDFerret: main window loaded')
    this.registerMenus(win)
  }

  // Called when main Zotero window unloads
  public onMainWindowUnload(_win: Window): void {
    Zotero.debug('PDFerret: main window unloading')
    this.unregisterMenus()
  }

  // Register the item observer for automatic PDF downloads
  private registerObserver(): void {
    if (this.initialized) return
    this.observerId = Zotero.Notifier.registerObserver(new ItemObserver(), ['item'], 'PDFerret')
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
    try {
      // Icon path using rootURI (chrome:// URLs don't work in Zotero 7/8 bootstrap plugins)
      const iconPath = typeof rootURI !== 'undefined' ? `${rootURI}skin/default/pdferret-logo.svg` : ''

      // Register item context menu item
      Menu.register('item', {
        tag: 'menuitem',
        id: 'pdferret-itemmenu',
        label: getString('menu-item'),
        icon: iconPath,
        commandListener: () => { void this.ItemPane.updateSelectedItems() },
      })
      this.menuIds.push('pdferret-itemmenu')

      // Register collection context menu item
      Menu.register('collection', {
        tag: 'menuitem',
        id: 'pdferret-collectionmenu',
        label: getString('menu-collection'),
        icon: iconPath,
        commandListener: () => { void this.ItemPane.updateSelectedEntity('') },
      })
      this.menuIds.push('pdferret-collectionmenu')

      // Register tools menu item
      Menu.register('menuTools', {
        tag: 'menuitem',
        id: 'pdferret-tools-updateall',
        label: getString('menu-all'),
        icon: iconPath,
        commandListener: () => { void this.ToolsPane.updateAll() },
      })
      this.menuIds.push('pdferret-tools-updateall')
    } catch (err) {
      Zotero.logError(err as Error)
    }
  }

  // Unregister all menu items
  private unregisterMenus(): void {
    Menu.unregisterAll()
    this.menuIds = []
  }

  /**
   * Get the active provider
   */
  public getActiveProvider(): Provider {
    return providerManager.getActiveProvider()
  }

  /**
   * Get the base URL for the active provider (legacy compatibility)
   * @deprecated Use getActiveProvider() instead
   */
  public getBaseScihubUrl(): string {
    const provider = providerManager.getActiveProvider()
    // Extract base URL from template (remove {DOI} placeholder)
    return `${provider.urlTemplate.replace('{DOI}', '').replace(/\/$/, '')}/`
  }

  public isAutomaticPdfDownload(): boolean {
    if (Zotero.Prefs.get('pdferret.automatic_pdf_download') === undefined) {
      Zotero.Prefs.set('pdferret.automatic_pdf_download', PDFerret.DEFAULT_AUTOMATIC_PDF_DOWNLOAD)
    }

    return Zotero.Prefs.get('pdferret.automatic_pdf_download') as boolean
  }

  // Legacy methods - kept for compatibility but no longer used
  public load(): void {
    this.registerObserver()
  }

  public unload(): void {
    this.unregisterObserver()
  }

  public async updateItems(items: ZoteroItem[], skipExistingPdfs = true): Promise<void> {
    // WARN: Sequentially go through items, parallel will fail due to rate-limiting
    // Cycle needs to be broken if provider asks for Captcha,
    // then user have to be redirected to the page to fill it in
    const provider = providerManager.getActiveProvider()

    for (const item of items) {
      // Skip items which are not processable (attachments, notes, etc.)
      if (!item.isRegularItem()) {
        continue
      }

      // Skip items that already have a PDF attachment (only for bulk operations)
      if (skipExistingPdfs && this.hasPdfAttachment(item)) {
        Zotero.debug(`pdferret: skipping "${item.getField('title')}" - already has PDF`)
        continue
      }

      // Skip items without DOI
      const doi = this.getDoi(item)
      if (!doi) {
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        ZoteroUtil.showPopup(getString('popup-doi-missing'), item.getField('title'), true, 5, provider.name)
        Zotero.debug(`pdferret: failed to generate URL for "${item.getField('title')}"`)
        continue
      }

      const providerUrl = new URL(provider.urlTemplate.replace('{DOI}', doi))

      try {
        await this.updateItem(providerUrl, item, provider, doi)
      } catch (error) {
        if (error instanceof PDFerretError) {
          // Get localised error message
          const message = getString(error.getLocaleKey(), {
            title: item.getField('title'),
            error: error.message,
          })

          if (error.shouldRedirectToProvider()) {
            // Alert and redirect (captcha, rate limit)
            const alertFn = Zotero.getMainWindow()?.alert || alert
            alertFn(message)
            Zotero.launchURL(providerUrl.href)
          } else {
            // Show popup only (connection error, PDF not found, etc.)
            const titleKey = `${error.getLocaleKey()}-title`
            // eslint-disable-next-line @typescript-eslint/no-magic-numbers
            ZoteroUtil.showPopup(getString(titleKey), message, true, 5, provider.name)
          }

          if (error.shouldStopProcessing()) {
            break
          }
          continue
        } else {
          // Unknown error type - treat as fatal, show popup and stop
          const message = getString('error-unknown', {
            title: item.getField('title'),
            error: String(error),
          })
          // eslint-disable-next-line @typescript-eslint/no-magic-numbers
          ZoteroUtil.showPopup(getString('error-unknown-title'), message, true, 5, provider.name)
          break
        }
      }
    }
  }

  private async updateItem(providerUrl: URL, item: ZoteroItem, provider: Provider, doi: string) {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    ZoteroUtil.showPopup(getString('popup-fetching'), item.getField('title'), false, 5, provider.name)

    // Fetch page (may throw ConnectionError, TimeoutError, UnknownError)
    const { doc, statusCode } = await this.fetchProviderPage(providerUrl)

    // Check for rate limiting first (before content analysis)
    if (pdfExtractor.isRateLimited(doc, statusCode)) {
      Zotero.debug(`pdferret: rate limited by "${providerUrl}"`)
      throw new RateLimitedError(`Rate limited by provider: ${providerUrl}`)
    }

    // Check for captcha requirement
    if (pdfExtractor.isCaptchaRequired(doc)) {
      Zotero.debug(`pdferret: captcha required at "${providerUrl}"`)
      throw new CaptchaRequiredError(`Captcha required: ${providerUrl}`)
    }

    // Extract PDF URL using provider-specific logic
    const rawPdfUrl = pdfExtractor.extractPdfUrl(doc, provider)

    if (statusCode === (HttpCodes.DONE as number) && rawPdfUrl) {
      // Normalise URL to absolute HTTPS
      const baseUrl = `${provider.urlTemplate.replace('{DOI}', '').replace(/\/$/, '')}/`
      const normalisedUrl = pdfExtractor.normalisePdfUrl(rawPdfUrl, baseUrl)
      const httpsUrl = UrlUtil.urlToHttps(normalisedUrl)
      await ZoteroUtil.attachRemotePDFToItem(httpsUrl, item, doi)
    } else if (statusCode === (HttpCodes.DONE as number) && pdfExtractor.isPdfTemporarilyUnavailable(doc)) {
      Zotero.debug(`pdferret: PDF temporarily unavailable at "${providerUrl}"`)
      throw new PdfNotReadyError(`PDF temporarily unavailable: ${providerUrl}`)
    } else if (statusCode === (HttpCodes.DONE as number) && pdfExtractor.isPdfNotAvailable(doc, provider)) {
      Zotero.debug(`pdferret: PDF is not available at the moment "${providerUrl}"`)
      throw new PdfNotFoundError(`PDF is not available: ${providerUrl}`)
    } else {
      Zotero.debug(`pdferret: failed to fetch PDF from "${providerUrl}"`)
      throw new UnknownError(`PDF not found in page (status: ${statusCode})`)
    }
  }

  private async fetchProviderPage(providerUrl: URL): Promise<{ doc: Document | null; statusCode: number }> {
    const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) ' +
      'AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1'

    try {
      const xhr = await Zotero.HTTP.request('GET', providerUrl.href, {
        responseType: 'document',
        headers: { 'User-Agent': userAgent },
      })
      return { doc: xhr.responseXML, statusCode: xhr.status }
    } catch (error) {
      const errorMsg = String(error).toLowerCase()

      // Detect connection errors
      if (errorMsg.includes('network') ||
          errorMsg.includes('dns') ||
          errorMsg.includes('econnrefused') ||
          errorMsg.includes('enotfound') ||
          errorMsg.includes('unreachable') ||
          errorMsg.includes('connection') ||
          errorMsg.includes('failed to fetch') ||
          errorMsg.includes('check your internet')) {
        throw new ConnectionError(`Connection failed: ${error}`)
      }

      // Detect timeout errors
      if (errorMsg.includes('timeout') ||
          errorMsg.includes('timed out') ||
          errorMsg.includes('etimedout')) {
        throw new TimeoutError(`Request timed out: ${error}`)
      }

      // Re-throw as unknown error
      throw new UnknownError(`Unexpected error: ${error}`)
    }
  }

  private hasPdfAttachment(item: ZoteroItem): boolean {
    const attachmentIds = item.getAttachments()
    for (const id of attachmentIds) {
      const attachment = Zotero.Items.get(id)
      if (attachment?.attachmentContentType === 'application/pdf') {
        return true
      }
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

  // Preferences pane methods - called from preferences.xhtml
  private static readonly XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'
  private static readonly PREF_AUTOMATIC = 'pdferret.automatic_pdf_download'
  private static readonly PREF_ACTIVE_PROVIDER = 'pdferret.active_provider'
  private static readonly PREF_LEGACY_SCIHUB_URL = 'pdferret.scihub_url'

  public onPrefsLoad(doc: Document): void {
    Zotero.debug('PDFerret: onPrefsLoad called')

    const automaticCheckbox = doc.getElementById('pref-automatic-pdf-download') as HTMLInputElement | null
    const providerSelect = doc.getElementById('pref-provider-select') as HTMLSelectElement | null
    const scihubUrlInput = doc.getElementById('pref-scihub-url') as HTMLInputElement | null

    if (!automaticCheckbox || !providerSelect || !scihubUrlInput) {
      Zotero.debug('PDFerret: preferences DOM elements not found')
      return
    }

    // Set initial values
    automaticCheckbox.checked = Zotero.Prefs.get(PDFerret.PREF_AUTOMATIC) !== false
    scihubUrlInput.value = this.loadScihubUrl()

    // Populate provider dropdown
    this.populateProviderDropdown(doc)
    this.renderCustomProvidersList(doc)

    // Event listeners
    automaticCheckbox.addEventListener('command', () => {
      const cb = doc.getElementById('pref-automatic-pdf-download') as HTMLInputElement
      Zotero.Prefs.set(PDFerret.PREF_AUTOMATIC, cb.checked)
    })

    providerSelect.addEventListener('command', () => {
      const select = doc.getElementById('pref-provider-select') as HTMLSelectElement
      Zotero.Prefs.set(PDFerret.PREF_ACTIVE_PROVIDER, select.value)
      this.updateScihubUrlVisibility(doc)
    })

    scihubUrlInput.addEventListener('change', function() {
      let url = (this).value.trim()
      if (url && !url.endsWith('/')) {
        url += '/'
      }
      Zotero.Prefs.set(PDFerret.PREF_LEGACY_SCIHUB_URL, url)
    })

    Zotero.debug('PDFerret: preferences initialization complete')
  }

  public onPrefsShowAddForm(doc: Document): void {
    const form = doc.getElementById('add-provider-form')
    const btnContainer = doc.getElementById('add-provider-btn-container')
    const nameInput = doc.getElementById('new-provider-name') as HTMLInputElement
    const urlInput = doc.getElementById('new-provider-url') as HTMLInputElement
    const linkTextInput = doc.getElementById('new-provider-linktext') as HTMLInputElement

    if (form && btnContainer && nameInput && urlInput && linkTextInput) {
      nameInput.value = ''
      urlInput.value = ''
      linkTextInput.value = getString('prefs-custom-linktext-default')
      form.style.display = ''
      btnContainer.style.display = 'none'
    }
  }

  public onPrefsHideAddForm(doc: Document): void {
    const form = doc.getElementById('add-provider-form')
    const btnContainer = doc.getElementById('add-provider-btn-container')

    if (form && btnContainer) {
      form.style.display = 'none'
      btnContainer.style.display = ''
    }
  }

  public onPrefsSaveProvider(doc: Document): void {
    const nameInput = doc.getElementById('new-provider-name') as HTMLInputElement
    const urlInput = doc.getElementById('new-provider-url') as HTMLInputElement
    const linkTextInput = doc.getElementById('new-provider-linktext') as HTMLInputElement

    if (!nameInput || !urlInput || !linkTextInput) return

    const name = nameInput.value.trim()
    const urlTemplate = urlInput.value.trim()
    const linkText = linkTextInput.value.trim()

    // Validation
    const alertFn = Zotero.getMainWindow()?.alert || alert
    if (!name) {
      alertFn(getString('validation-name-required'))
      return
    }
    if (!urlTemplate) {
      alertFn(getString('validation-url-required'))
      return
    }
    if (!urlTemplate.includes('{DOI}')) {
      alertFn(getString('validation-url-doi'))
      return
    }
    if (!linkText) {
      alertFn(getString('validation-linktext-required'))
      return
    }

    // Use providerManager to add the provider (updates both in-memory and storage)
    const newProvider = {
      id: providerManager.generateCustomProviderId(),
      name,
      urlTemplate,
      linkText,
    }
    providerManager.addCustomProvider(newProvider)

    this.onPrefsHideAddForm(doc)
    this.populateProviderDropdown(doc)
    this.renderCustomProvidersList(doc)
  }

  private populateProviderDropdown(doc: Document): void {
    const providerPopup = doc.getElementById('pref-provider-popup')
    const providerSelect = doc.getElementById('pref-provider-select') as HTMLSelectElement | null

    if (!providerPopup || !providerSelect) return

    // Clear existing items
    while (providerPopup.firstChild) {
      providerPopup.removeChild(providerPopup.firstChild)
    }

    const providers = providerManager.getProviders()
    const activeId = (Zotero.Prefs.get(PDFerret.PREF_ACTIVE_PROVIDER) as string) || 'scihub'

    for (const provider of providers) {
      const menuitem = doc.createElementNS(PDFerret.XUL_NS, 'menuitem')
      menuitem.setAttribute('value', provider.id)
      menuitem.setAttribute('label', provider.name)
      providerPopup.appendChild(menuitem)
    }

    providerSelect.value = activeId
    this.updateScihubUrlVisibility(doc)
  }

  private updateScihubUrlVisibility(doc: Document): void {
    const providerSelect = doc.getElementById('pref-provider-select') as HTMLSelectElement | null
    const scihubUrlSection = doc.getElementById('scihub-url-section')

    if (providerSelect && scihubUrlSection) {
      scihubUrlSection.style.display = providerSelect.value === 'scihub' ? '' : 'none'
    }
  }

  private renderCustomProvidersList(doc: Document): void {
    const customProvidersList = doc.getElementById('custom-providers-list')
    if (!customProvidersList) return

    // Clear existing items
    while (customProvidersList.firstChild) {
      customProvidersList.removeChild(customProvidersList.firstChild)
    }

    // Get custom providers from providerManager (filter out built-ins)
    const customProviders = providerManager.getProviders().filter(p => !p.isBuiltin)
    if (customProviders.length === 0) {
      const emptyMsg = doc.createElementNS('http://www.w3.org/1999/xhtml', 'p')
      emptyMsg.style.cssText = 'color: #999; font-style: italic; margin: 0;'
      emptyMsg.textContent = getString('prefs-custom-empty')
      customProvidersList.appendChild(emptyMsg)
      return
    }

    for (const provider of customProviders) {
      const row = doc.createElementNS(PDFerret.XUL_NS, 'hbox') as HTMLElement
      row.setAttribute('align', 'center')
      row.style.cssText = 'margin-bottom: 8px; padding: 8px; border: 1px solid currentColor; border-radius: 4px; opacity: 0.8;'

      const infoBox = doc.createElementNS(PDFerret.XUL_NS, 'vbox')
      infoBox.setAttribute('flex', '1')

      const nameLabel = doc.createElementNS(PDFerret.XUL_NS, 'label')
      nameLabel.setAttribute('value', provider.name)
      ;(nameLabel as HTMLElement).style.fontWeight = 'bold'
      infoBox.appendChild(nameLabel)

      const urlLabel = doc.createElementNS(PDFerret.XUL_NS, 'label')
      urlLabel.setAttribute('value', provider.urlTemplate)
      ;(urlLabel as HTMLElement).style.cssText = 'font-size: 11px; opacity: 0.7;'
      infoBox.appendChild(urlLabel)

      row.appendChild(infoBox)

      const deleteBtn = doc.createElementNS(PDFerret.XUL_NS, 'button')
      deleteBtn.setAttribute('label', getString('prefs-btn-delete'))
      deleteBtn.setAttribute('data-provider-id', provider.id)
      deleteBtn.addEventListener('click', e => {
        const id = (e.target as HTMLElement).getAttribute('data-provider-id')
        if (id) {
          this.deleteCustomProvider(doc, id)
        }
      })
      row.appendChild(deleteBtn)

      customProvidersList.appendChild(row)
    }
  }

  private deleteCustomProvider(doc: Document, id: string): void {
    // Use providerManager to remove (handles both in-memory and storage, plus active provider reset)
    providerManager.removeCustomProvider(id)

    this.populateProviderDropdown(doc)
    this.renderCustomProvidersList(doc)
  }

  private loadScihubUrl(): string {
    const legacyUrl = Zotero.Prefs.get(PDFerret.PREF_LEGACY_SCIHUB_URL) as string | undefined
    if (legacyUrl && typeof legacyUrl === 'string') {
      return legacyUrl.replace(/\/$/, '')
    }
    return 'https://sci-hub.ru'
  }
}

Zotero.PDFerret = new PDFerret()

// Legacy initialization for Zotero 6 compatibility (if XUL overlays are still used)
// In Zotero 7/8, initialization is handled by bootstrap.ts
if (typeof window !== 'undefined' && typeof rootURI === 'undefined') {
  // Only attach listeners in legacy mode (non-bootstrap)
  window.addEventListener('load', _ => {
    Zotero.PDFerret.load()
  }, false)
  window.addEventListener('unload', _ => {
    Zotero.PDFerret.unload()
  }, false)
}

export { PDFerret }
