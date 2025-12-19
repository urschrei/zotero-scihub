import type { ZoteroItem, IZotero } from '../typings/zotero'

declare const Zotero: IZotero

export abstract class ZoteroUtil {
  public static async attachRemotePDFToItem(pdfUrl: URL, item: ZoteroItem, doi: string): Promise<void> {
    // Use DOI as filename (replace / with _ for filesystem compatibility)
    // Note: fileBaseName should NOT include extension - Zotero adds it automatically
    const filename = doi.replace(/\//g, '_')

    // Download PDF and add as attachment
    const importOptions = {
      libraryID: item.libraryID,
      url: pdfUrl.href,
      parentItemID: item.id,
      title: item.getField('title'),
      fileBaseName: filename,
      contentType: 'application/pdf',
      referrer: '',
      cookieSandbox: null,
    }
    await Zotero.Attachments.importFromURL(importOptions)
  }

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  public static showPopup(title: string, body: string, isError = false, timeout = 5, providerName = 'Sci-Hub'): void {
    // Shows user-friendly Zotero popup
    const seconds = 1000
    const pw = new Zotero.ProgressWindow()
    if (isError) {
      pw.changeHeadline('Error', 'chrome://zotero/skin/cross.png', `${providerName}: ${title}`)
    } else {
      pw.changeHeadline(`${providerName}: ${title}`)
    }
    pw.addDescription(body)
    pw.show()
    pw.startCloseTimer(timeout * seconds)
  }
}
