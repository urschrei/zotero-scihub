import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { Zotero } from './zotero.mock'
import { regularItem1 } from './zoteroItem.mock'
import { ZoteroUtil } from '../content/zoteroUtil'

describe('ZoteroUtil test', () => {
  describe('attachRemotePDFToItem', () => {
    let attachmentSpy: MockInstance

    beforeEach(() => {
      attachmentSpy = vi.spyOn(Zotero.Attachments, 'importFromURL')
    })

    afterEach(() => {
      attachmentSpy.mockRestore()
    })

    it('should pass correct parameters to built-in Zotero method', async () => {
      const pdfUrl = new URL('https://example.com/filename.pdf')
      const doi = '10.1234/test.article'

      await ZoteroUtil.attachRemotePDFToItem(pdfUrl, regularItem1, doi)

      expect(attachmentSpy.mock.calls[0][0].url).toBe('https://example.com/filename.pdf')
      expect(attachmentSpy.mock.calls[0][0].fileBaseName).toBe('10.1234_test.article')
      expect(attachmentSpy.mock.calls[0][0].title).toBe('regularItemTitle1')
    })
  })
})
