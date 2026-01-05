// Locale helper module for accessing Fluent strings from TypeScript

declare const Localization: any

let l10n: any = null

/**
 * Initialise the localisation system.
 * Must be called during plugin startup after chrome registration.
 */
export function initLocale(): void {
  l10n = new Localization(['pdferret.ftl'], true) // true = sync mode
}

/**
 * Get a localised string by its Fluent ID.
 * @param id - The Fluent message ID (without the pdferret- prefix)
 * @param args - Optional arguments for parameterised messages
 * @returns The localised string, or the ID if not found
 */
export function getString(id: string, args?: Record<string, string>): string {
  if (!l10n) return id
  const result = l10n.formatValueSync(`pdferret-${id}`, args) as string | null
  return result ?? id
}
