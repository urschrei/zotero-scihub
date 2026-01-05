/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-empty-function */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { JSDOM } from 'jsdom'
import { Zotero, progressWindowSpy, httpRequestMock } from './zotero.mock'
import {
  nonRegularItem,
  itemWithoutDOI,
  regularItem1,
  regularItem2,
  DOIinExtraItem,
  DOIinUrlItem,
  captchaItem,
  unavailableItem,
  rateLimitedItem,
  connectionErrorItem,
  timeoutItem,
  tempUnavailableItem
} from './zoteroItem.mock'
import { PDFerret } from '../content/pdferret'
import { providerManager } from '../content/providers'

Zotero.PDFerret = new PDFerret()
providerManager.initialize()

// Mock HTTP responses based on URL
// Format: { html: string, status: number } or 'network_error' or 'timeout'
type MockResponse = { html: string; status: number } | 'network_error' | 'timeout'

const mockResponses: Record<string, MockResponse> = {
  'https://sci-hub.ru/10.1037/a0023781': {
    html: '<html><body><iframe id="pdf" src="http://example.com/regular_item_1.pdf" /></body></html>',
    status: 200,
  },
  'https://sci-hub.ru/10.1029/2018JA025877': {
    html: '<html><body><iframe id="pdf" src="https://example.com/doi_in_extra_item.pdf?param=val#tag" /></body></html>',
    status: 200,
  },
  'https://sci-hub.ru/10.1080/00224490902775827': {
    html: '<html><body><embed id="pdf" src="http://example.com/doi_in_url_item.pdf"></embed></body></html>',
    status: 200,
  },
  'https://sci-hub.ru/captcha': {
    html: '<html><body><div class="g-recaptcha" data-sitekey="xxx"></div></body></html>',
    status: 200,
  },
  'https://sci-hub.ru/42.0/69': {
    html: '<html><body>Please try to search again using DOI</body></html>',
    status: 200,
  },
  'https://sci-hub.ru/rate-limited': {
    html: '<html><body>Too many requests, slow down</body></html>',
    status: 429,
  },
  'https://sci-hub.ru/connection-error': 'network_error',
  'https://sci-hub.ru/timeout': 'timeout',
  'https://sci-hub.ru/temp-unavailable': {
    html: '<html><body>Server is busy, please try again later</body></html>',
    status: 200,
  },
}

describe('PDFerret test', () => {
  describe('updateItems', () => {
    let attachmentSpy: MockInstance

    beforeEach(() => {
      attachmentSpy = vi.spyOn(Zotero.Attachments, 'importFromURL')

      // Set up HTTP request mock to return appropriate responses with parsed document
      httpRequestMock.mockImplementation(async (_method: string, url: string) => {
        const response = mockResponses[url]

        // Handle network errors
        if (response === 'network_error') {
          throw new Error('Error: Error connecting to server. Check your Internet connection.')
        }

        // Handle timeout errors
        if (response === 'timeout') {
          throw new Error('Request timed out')
        }

        // Handle normal responses (with status code)
        const { html, status } = response || { html: '   ', status: 200 }
        const dom = new JSDOM(html, { contentType: 'text/html' })
        return {
          responseText: html,
          responseXML: dom.window.document,
          status,
        } as unknown as XMLHttpRequest
      })
    })

    afterEach(() => {
      attachmentSpy.mockRestore()
      httpRequestMock.mockClear()
      progressWindowSpy.mockClear()
    })

    it('does nothing if there is no items to update', async () => {
      await Zotero.PDFerret.updateItems([])
      expect(attachmentSpy).not.toHaveBeenCalled()
    })

    it('skips non-regular items', async () => {
      await Zotero.PDFerret.updateItems([nonRegularItem])
      expect(attachmentSpy).not.toHaveBeenCalled()
    })

    it('skips items without DOI', async () => {
      await Zotero.PDFerret.updateItems([itemWithoutDOI])
      expect(attachmentSpy).not.toHaveBeenCalled()
    })

    it('attaches PDFs to items it processes', async () => {
      await Zotero.PDFerret.updateItems([regularItem1, DOIinExtraItem, DOIinUrlItem])

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
      await Zotero.PDFerret.updateItems([regularItem2, regularItem1])

      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      expect(attachmentSpy).toHaveBeenCalledTimes(1)
    })

    it('unavailable item with rich error message shows popup and continues execution', async () => {
      // unavailableItem has no PDF available, but reports different error
      await Zotero.PDFerret.updateItems([unavailableItem, regularItem1])

      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      expect(attachmentSpy).toHaveBeenCalledTimes(1)
    })

    it('captcha redirects user and stops execution', async () => {
      const launchURLSpy = vi.spyOn(Zotero, 'launchURL')
      const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {})

      // captchaItem has weird response
      await Zotero.PDFerret.updateItems([captchaItem, regularItem1])

      expect(launchURLSpy).toHaveBeenCalledTimes(1)
      expect(attachmentSpy).not.toHaveBeenCalled()

      launchURLSpy.mockRestore()
      alertSpy.mockRestore()
    })

    it('connection error shows popup and stops execution without redirect', async () => {
      const launchURLSpy = vi.spyOn(Zotero, 'launchURL')

      await Zotero.PDFerret.updateItems([connectionErrorItem, regularItem1])

      // Should show error popup (not alert)
      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      // Should NOT redirect to provider
      expect(launchURLSpy).not.toHaveBeenCalled()
      // Should stop processing (regularItem1 not fetched)
      expect(attachmentSpy).not.toHaveBeenCalled()

      launchURLSpy.mockRestore()
    })

    it('timeout error shows popup and stops execution without redirect', async () => {
      const launchURLSpy = vi.spyOn(Zotero, 'launchURL')

      await Zotero.PDFerret.updateItems([timeoutItem, regularItem1])

      // Should show error popup (not alert)
      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      // Should NOT redirect to provider
      expect(launchURLSpy).not.toHaveBeenCalled()
      // Should stop processing (regularItem1 not fetched)
      expect(attachmentSpy).not.toHaveBeenCalled()

      launchURLSpy.mockRestore()
    })

    it('rate limit error shows alert and redirects to provider', async () => {
      const launchURLSpy = vi.spyOn(Zotero, 'launchURL')
      const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {})

      await Zotero.PDFerret.updateItems([rateLimitedItem, regularItem1])

      // Should redirect to provider (like captcha)
      expect(launchURLSpy).toHaveBeenCalledTimes(1)
      expect(alertSpy).toHaveBeenCalled()
      // Should stop processing
      expect(attachmentSpy).not.toHaveBeenCalled()

      launchURLSpy.mockRestore()
      alertSpy.mockRestore()
    })

    it('temporarily unavailable shows popup and continues to next item', async () => {
      const launchURLSpy = vi.spyOn(Zotero, 'launchURL')

      await Zotero.PDFerret.updateItems([tempUnavailableItem, regularItem1])

      // Should show error popup
      expect(progressWindowSpy).toHaveBeenCalledWith('Error')
      // Should NOT redirect to provider
      expect(launchURLSpy).not.toHaveBeenCalled()
      // Should continue processing (regularItem1 fetched)
      expect(attachmentSpy).toHaveBeenCalledTimes(1)
      expect(attachmentSpy.mock.calls[0][0].url).toBe('https://example.com/regular_item_1.pdf')

      launchURLSpy.mockRestore()
    })
  })
})
