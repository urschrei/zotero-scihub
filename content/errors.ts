/**
 * Custom error classes for the Zotero Sci-Hub plugin.
 * Each error type encapsulates its own behaviour for UI handling.
 */

/**
 * Base error class for all plugin errors.
 * Subclasses define behaviour for processing flow and user notification.
 */
export abstract class ScihubError extends Error {
  constructor(message: string) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /** Whether processing should stop for remaining items */
  abstract shouldStopProcessing(): boolean

  /** Whether to redirect user to provider page */
  abstract shouldRedirectToProvider(): boolean

  /** Get the localisation key for the error message */
  abstract getLocaleKey(): string
}

/** Network connection failed (server unreachable, DNS failure, etc.) */
export class ConnectionError extends ScihubError {
  name = 'ConnectionError'

  shouldStopProcessing(): boolean {
    return true
  }

  shouldRedirectToProvider(): boolean {
    return false
  }

  getLocaleKey(): string {
    return 'error-connection'
  }
}

/** Request timed out */
export class TimeoutError extends ScihubError {
  name = 'TimeoutError'

  shouldStopProcessing(): boolean {
    return true
  }

  shouldRedirectToProvider(): boolean {
    return false
  }

  getLocaleKey(): string {
    return 'error-timeout'
  }
}

/** Provider requires captcha verification */
export class CaptchaRequiredError extends ScihubError {
  name = 'CaptchaRequiredError'

  shouldStopProcessing(): boolean {
    return true
  }

  shouldRedirectToProvider(): boolean {
    return true
  }

  getLocaleKey(): string {
    return 'error-captcha'
  }
}

/** Rate limited by provider */
export class RateLimitedError extends ScihubError {
  name = 'RateLimitedError'

  shouldStopProcessing(): boolean {
    return true
  }

  shouldRedirectToProvider(): boolean {
    return true
  }

  getLocaleKey(): string {
    return 'error-rate-limited'
  }
}

/** PDF not found in provider's database */
export class PdfNotFoundError extends ScihubError {
  name = 'PdfNotFoundError'

  shouldStopProcessing(): boolean {
    return false
  }

  shouldRedirectToProvider(): boolean {
    return false
  }

  getLocaleKey(): string {
    return 'error-pdf-not-found'
  }
}

/** PDF might be available later (temporary unavailability) */
export class PdfNotReadyError extends ScihubError {
  name = 'PdfNotReadyError'

  shouldStopProcessing(): boolean {
    return false
  }

  shouldRedirectToProvider(): boolean {
    return false
  }

  getLocaleKey(): string {
    return 'error-pdf-not-ready'
  }
}

/** Unknown or unexpected error */
export class UnknownError extends ScihubError {
  name = 'UnknownError'

  shouldStopProcessing(): boolean {
    return true
  }

  shouldRedirectToProvider(): boolean {
    return false
  }

  getLocaleKey(): string {
    return 'error-unknown'
  }
}
