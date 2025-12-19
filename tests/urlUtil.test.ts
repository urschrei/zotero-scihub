/* eslint-disable @typescript-eslint/no-unused-expressions */
import { UrlUtil } from '../content/urlUtil'
import { expect } from 'chai'

describe('UrlUtil test', () => {
  describe('urlToHttps', () => {
    it('converts url string to URL object with https protocol', () => {
      const url = UrlUtil.urlToHttps('http://example.com')
      expect(url.href).to.equal('https://example.com/')
    })

    it('converts to https even if protocol is not set', () => {
      const url = UrlUtil.urlToHttps('//example.com')
      expect(url.href).to.equal('https://example.com/')
    })

    it('keeps https as is', () => {
      const url = UrlUtil.urlToHttps('https://example.com')
      expect(url.href).to.equal('https://example.com/')
    })
  })

})
