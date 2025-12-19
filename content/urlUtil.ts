export abstract class UrlUtil {
  public static urlToHttps(url: string): URL {
    // Default to the secure connection for fetching PDFs
    // Handles special case if URL starts with "//"
    const safeUrl = new URL(url.replace(/^\/\//, 'https://'))
    safeUrl.protocol = 'https'
    return safeUrl
  }
}
