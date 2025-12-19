import type { Provider } from './types'

export const SCIHUB_PROVIDER: Provider = {
  id: 'scihub',
  name: 'Sci-Hub',
  urlTemplate: 'https://sci-hub.ru/{DOI}',
  isBuiltin: true,
}

export const ANNAS_ARCHIVE_PROVIDER: Provider = {
  id: 'annas-archive',
  name: "Anna's Archive SciDB",
  urlTemplate: 'https://annas-archive.org/scidb/{DOI}/',
  linkText: 'Download',
  isBuiltin: true,
}

export const BUILTIN_PROVIDERS: Provider[] = [
  SCIHUB_PROVIDER,
  ANNAS_ARCHIVE_PROVIDER,
]

export const DEFAULT_PROVIDER_ID = 'scihub'
