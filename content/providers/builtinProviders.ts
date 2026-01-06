import type { Provider } from './types'

export const SCIHUB_PROVIDER: Provider = {
  id: 'scihub',
  name: 'Sci-Hub',
  urlTemplate: 'https://sci-hub.ru/{DOI}',
  isBuiltin: true,
  // Sci-Hub uses various elements to embed PDFs - try multiple selectors
  selector: 'embed[type="application/pdf"], #pdf, object[data*=".pdf"], iframe[src*=".pdf"]',
  attribute: 'src',
}

export const ANNAS_ARCHIVE_PROVIDER: Provider = {
  id: 'annas-archive',
  name: "Anna's Archive SciDB",
  urlTemplate: 'https://annas-archive.org/scidb/{DOI}/',
  isBuiltin: true,
  // Anna's Archive uses a slow download link
  selector: 'a[href*="/slow_download"]',
  attribute: 'href',
}

export const BUILTIN_PROVIDERS: Provider[] = [
  SCIHUB_PROVIDER,
  ANNAS_ARCHIVE_PROVIDER,
]

export const DEFAULT_PROVIDER_ID = 'scihub'
