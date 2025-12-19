/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-empty-function */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { JSDOM } from 'jsdom'
import { Zotero, progressWindowSpy, httpRequestMock } from './zotero.mock'
import { nonRegularItem, itemWithoutDOI, regularItem1, regularItem2, DOIinExtraItem, DOIinUrlItem, captchaItem, unavailableItem } from './zoteroItem.mock'
import { Scihub } from '../content/scihub'
import { providerManager } from '../content/providers'

Zotero.Scihub = new Scihub()
providerManager.initialize()

// Mock HTTP responses based on URL
const mockResponses: Record<string, string> = {
  'https://sci-hub.ru/10.1037/a0023781':
    '<html><body><iframe id="pdf" src="http://example.com/regular_item_1.pdf" /></body></html>',
  'https://sci-hub.ru/10.1029/2018JA025877':
    '<html><body><iframe id="pdf" src="https://example.com/doi_in_extra_item.pdf?param=val#tag" /></body></html>',
  'https://sci-hub.ru/10.1080/00224490902775827':
    '<html><body><embed id="pdf" src="http://example.com/doi_in_url_item.pdf"></embed></body></html>',
  'https://sci-hub.ru/captcha':
    '<html><body>Captcha is required</body></html>',
  'https://sci-hub.ru/42.0/69':
    '<html><body>Please try to search again using DOI</body></html>',
}

describe('Scihub test', () => {
  describe('updateItems', () => {
    let attachmentSpy: MockInstance

    beforeEach(() => {
      attachmentSpy = vi.spyOn(Zotero.Attachments, 'importFromURL')

      // Set up HTTP request mock to return appropriate responses with parsed document
      httpRequestMock.mockImplementation(async (_method: string, url: string) => {
        const responseText = mockResponses[url] || '   '
        const dom = new JSDOM(responseText, { contentType: 'text/html' })
        return {
          responseText,
          responseXML: dom.window.document,
          status: 200,
        } as unknown as XMLHttpRequest
      })
    })

    afterEach(() => {
      attachmentSpy.mockRestore()
      httpRequestMock.mockClear()
      progressWindowSpy.mockClear()
    })

    it('does nothing if there is no items to update', async () => {
      await Zotero.Scihub.updateItems([])
      expect(attachmentSpy).not.toHaveBeenCalled()
    })

    it('skips non-regular items', async () => {
      await Zotero.Scihub.updateItems([nonRegularItem])
      expect(attachmentSpy).not.toHaveBeenCalled()
    })

    it('skips items without DOI', async () => {
      await Zotero.Scihub.updateItems([itemWithoutDOI])
      expect(attachmentSpy).not.toHaveBeenCalled()
    })

    it('attaches PDFs to items it processes', async () => {
      await Zotero.Scihub.updateItems([regularItem1, DOIinExtraItem, DOIinUrlItem])

      expect(attachmentSpy).toHaveBeenCalledTimes(3)

      expect(attachmentSpy.mock.calls[0][0].url).toBe('https://example.com/regular_item_1.pdf')
      expect(attachmentSpy.mock.calls[0][0].fileBaseName).toBe('10.1037_a0023781')
      expect(attachmentSpy.mock.calls[0][0].title).toBe('regularItemTitle1')

      expect(attachmentSpy.mock.calls[1][0].url).toBe('https://example.com/doi_in_extra_item.pdf?param=val#tag')
      expect(attachmentSpy.mock.calls[1][0].fileBaseName).toBe('10.1029_2018JA025877')
      expect(attachmentSpy.mock.calls[1][0].title).toBe('DOIinExtraItemTitle')

      expect(attachmentSpy.mock.calls[2][0].url).toBe('https://example.com/doi_in_url_item.pdf')
      expect(attachmentSpy.mock.calls[2][0].fileBaseName).toBe('10.1080_00224490902775827')
      expect(attachmentSpy.mock.calls[2][0].title).toBe('DOIinUrlItemTitle')
    })

    it('unavailable item shows popup and continues execution', async () => {
      // regularItem2 has no PDF available
      await Zotero.Scihub.updateItems([regularItem2, regularItem1])

      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      expect(attachmentSpy).toHaveBeenCalledTimes(1)
    })

    it('unavailable item with rich error message shows popup and continues execution', async () => {
      // unavailableItem has no PDF available, but reports different error
      await Zotero.Scihub.updateItems([unavailableItem, regularItem1])

      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      expect(attachmentSpy).toHaveBeenCalledTimes(1)
    })

    it('captcha redirects user and stops execution', async () => {
      const launchURLSpy = vi.spyOn(Zotero, 'launchURL')
      const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {})

      // captchaItem has weird response
      await Zotero.Scihub.updateItems([captchaItem, regularItem1])

      expect(launchURLSpy).toHaveBeenCalledTimes(1)
      expect(attachmentSpy).not.toHaveBeenCalled()

      launchURLSpy.mockRestore()
      alertSpy.mockRestore()
    })
  })
})
