import type { IZotero } from '../../typings/zotero'
import type { Provider } from './types'

declare const Zotero: IZotero

/**
 * Extract PDF URL from a provider's response page
 */
export class PdfExtractor {
  /**
   * Extract PDF URL from the response document based on the provider configuration
   */
  public extractPdfUrl(doc: Document | null, provider: Provider): string | null {
    if (!doc) return null

    // Sci-Hub uses a complex multi-selector strategy
    if (provider.id === 'scihub') {
      return this.extractScihubPdfUrl(doc)
    }

    // Other providers use simple link text matching
    if (provider.linkText) {
      return this.extractByLinkText(doc, provider.linkText)
    }

    return null
  }

  /**
   * Check if the page indicates that the PDF is not available
   */
  public isPdfNotAvailable(doc: Document | null, provider: Provider): boolean {
    if (!doc) return true

    const body = doc.querySelector('body')
    const innerHTML = body?.innerHTML

    if (!innerHTML || innerHTML.trim() === '') {
      return true
    }

    // Sci-Hub specific not-available patterns
    if (provider.id === 'scihub') {
      if (innerHTML.match(/Please try to search again using DOI/im) ||
          innerHTML.match(/статья не найдена в базе/im)) {
        return true
      }
    }

    // Anna's Archive specific not-available patterns
    if (provider.id === 'annas-archive') {
      if (innerHTML.match(/No files found/im) ||
          innerHTML.match(/not found in our database/im)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if the page indicates a captcha is required.
   * Uses element checks rather than text matching to avoid false positives
   * from captcha-related code in scripts.
   */
  public isCaptchaRequired(doc: Document | null): boolean {
    if (!doc) return false

    // Check for actual captcha container elements, not just text mentions
    const hasCaptchaContainer =
      doc.querySelector('.g-recaptcha') !== null ||
      doc.querySelector('.h-captcha') !== null ||
      doc.querySelector('.cf-turnstile') !== null ||
      doc.querySelector('#captcha') !== null ||
      doc.querySelector('[data-sitekey]') !== null

    // Check for captcha challenge forms that block the page
    const hasBlockingCaptcha =
      doc.querySelector('form[action*="captcha"]') !== null

    return hasCaptchaContainer || hasBlockingCaptcha
  }

  /**
   * Check if the response indicates rate limiting
   */
  public isRateLimited(doc: Document | null, statusCode: number): boolean {
    // HTTP 429 Too Many Requests
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (statusCode === 429) return true

    // HTTP 503 Service Unavailable (often used for rate limiting)
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (statusCode === 503) {
      const body = doc?.querySelector('body')?.innerHTML ?? ''
      if (body.match(/too many requests/i) ||
          body.match(/rate limit/i) ||
          body.match(/slow down/i)) {
        return true
      }
    }

    return false
  }

  /**
   * Check if PDF might become available later (temporary unavailability)
   */
  public isPdfTemporarilyUnavailable(doc: Document | null): boolean {
    if (!doc) return false

    const body = doc.querySelector('body')
    const innerHTML = body?.innerHTML ?? ''

    // Messages suggesting temporary unavailability
    if (innerHTML.match(/try again later/i) ||
        innerHTML.match(/temporarily unavailable/i) ||
        innerHTML.match(/server is busy/i) ||
        innerHTML.match(/please wait/i)) {
      return true
    }

    return false
  }

  /**
   * Extract PDF URL from Sci-Hub using the existing multi-selector strategy
   */
  private extractScihubPdfUrl(doc: Document): string | null {
    let rawPdfUrl: string | null = null

    // Try object tag first (current sci-hub 2024+ structure)
    const objectElement = doc.querySelector('object[type="application/pdf"]')
    if (objectElement) {
      rawPdfUrl = objectElement.getAttribute('data')
      // Remove URL fragment (e.g., #navpanes=0&view=FitH)
      if (rawPdfUrl?.includes('#')) {
        rawPdfUrl = rawPdfUrl.split('#')[0]
      }
    }

    // Try download link
    if (!rawPdfUrl) {
      const downloadLink = doc.querySelector('.download a[href*=".pdf"]') ||
                           doc.querySelector('a[href*="/download/"]')
      if (downloadLink) {
        rawPdfUrl = downloadLink.getAttribute('href')
      }
    }

    // Try legacy selectors (older sci-hub versions)
    if (!rawPdfUrl) {
      const pdfElement = doc.querySelector('#pdf') ||
                         doc.querySelector('embed[src*=".pdf"]') ||
                         doc.querySelector('iframe[src*=".pdf"]') ||
                         doc.querySelector('embed') ||
                         doc.querySelector('iframe')
      rawPdfUrl = pdfElement?.getAttribute('src') ?? null
    }

    // Fallback: regex search in HTML
    if (!rawPdfUrl) {
      const bodyHtml = doc.body?.innerHTML ?? ''
      const pdfUrlMatch = bodyHtml.match(/data\s*=\s*['"]([^'"]*\.pdf[^'"]*)['"]/i) ||
                          bodyHtml.match(/href\s*=\s*['"]([^'"]*\/download\/[^'"]*\.pdf)['"]/i) ||
                          bodyHtml.match(/(?:src|href)\s*=\s*['"]([^'"]*\.pdf[^'"]*)['"]/i)
      if (pdfUrlMatch) {
        rawPdfUrl = pdfUrlMatch[1]
      }
    }

    return rawPdfUrl
  }

  /**
   * Extract PDF URL by finding a link with matching text content
   */
  private extractByLinkText(doc: Document, linkText: string): string | null {
    const links = Array.from(doc.querySelectorAll('a[href]'))
    for (const link of links) {
      const text = link.textContent?.trim()
      if (text === linkText) {
        const href: string | null = link.getAttribute('href')
        if (href) {
          Zotero.debug(`PdfExtractor: Found link with text "${linkText}": ${href}`)
          return href
        }
      }
    }
    return null
  }

  /**
   * Normalise a raw PDF URL to an absolute HTTPS URL
   */
  public normalisePdfUrl(rawUrl: string, baseUrl: string): string {
    let url = rawUrl

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      url = `https:${url}`
    } else if (!url.startsWith('http')) {
      // Handle relative URLs
      // Ensure base URL ends with /
      const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
      url = base + url.replace(/^\//, '')
    }

    // Ensure HTTPS
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://')
    }

    return url
  }
}

// Singleton instance
export const pdfExtractor = new PdfExtractor()
