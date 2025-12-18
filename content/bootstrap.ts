// Bootstrap file for Zotero 7/8 plugin architecture
// This file handles plugin lifecycle: startup, shutdown, window load/unload

declare const Components: any
declare const Services: any

// These are injected by Zotero when loading the bootstrap
let Zotero: any
let chromeHandle: any

const BOOTSTRAP_REASONS: Record<number, string> = {
  1: 'APP_STARTUP',
  2: 'APP_SHUTDOWN',
  3: 'ADDON_ENABLE',
  4: 'ADDON_DISABLE',
  5: 'ADDON_INSTALL',
  6: 'ADDON_UNINSTALL',
  7: 'ADDON_UPGRADE',
  8: 'ADDON_DOWNGRADE',
}

const POLL_INTERVAL = 100

// Called when the plugin is installed or enabled
export async function startup({ resourceURI, rootURI = resourceURI.spec }: {
  id: string
  version: string
  resourceURI: { spec: string }
  rootURI?: string
}, reason: number): Promise<void> {
  // Wait for Zotero to be ready
  await waitForZotero()

  // Store Zotero reference
  Zotero = Components.classes['@zotero.org/Zotero;1']
    .getService(Components.interfaces.nsISupports)
    .wrappedJSObject

  // Register chrome resources
  const aomStartup = Components.classes['@mozilla.org/addons/addon-manager-startup;1']
    .getService(Components.interfaces.amIAddonManagerStartup)

  const manifestURI = Services.io.newURI(`${rootURI}manifest.json`)
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ['content', 'zotero-scihub', `${rootURI}content/`],
    ['locale', 'zotero-scihub', 'en-US', `${rootURI}locale/en-US/`],
    ['skin', 'zotero-scihub', 'default', `${rootURI}skin/default/`],
  ])

  // Load the main plugin script
  Services.scriptloader.loadSubScriptWithOptions(
    `${rootURI}content/scihub.js`,
    {
      target: {
        Zotero,
        rootURI,
        // Provide timer functions for async operations
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        setTimeout: (fn: () => void, ms: number): number => Zotero.setTimeout(fn, ms),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        clearTimeout: (timerId: number): void => Zotero.clearTimeout(timerId),
      },
      ignoreCache: true,
    }
  )

  // Register preference pane
  await Zotero.PreferencePanes.register({
    pluginID: 'zotero-scihub@example.com',
    src: `${rootURI}content/preferences.xhtml`,
    label: 'Sci-Hub',
    image: 'chrome://zotero-scihub/skin/sci-hub-logo.svg',
  })

  // Initialize the plugin
  await Zotero.Scihub.startup(BOOTSTRAP_REASONS[reason])

  Zotero.debug('Scihub: Plugin started')
}

// Called when the plugin is disabled or uninstalled
export function shutdown(_data: {
  id: string
  version: string
  resourceURI: { spec: string }
  rootURI?: string
}, _reason: number): void {
  Zotero.debug('Scihub: Plugin shutting down')

  // Unload the plugin
  if (Zotero.Scihub) {
    Zotero.Scihub.shutdown()
  }

  // Unregister chrome resources
  if (chromeHandle) {
    chromeHandle.destruct()
    chromeHandle = null
  }

  // Clear Zotero.Scihub namespace
  delete Zotero.Scihub
}

// Called when the main Zotero window loads
export function onMainWindowLoad({ window: win }: { window: Window }): void {
  if (Zotero.Scihub) {
    Zotero.Scihub.onMainWindowLoad(win)
  }
}

// Called when the main Zotero window unloads
export function onMainWindowUnload({ window: win }: { window: Window }): void {
  if (Zotero.Scihub) {
    Zotero.Scihub.onMainWindowUnload(win)
  }
}

// Helper function to wait for Zotero to be ready
async function waitForZotero(): Promise<void> {
  if (typeof Zotero !== 'undefined' && Zotero.initialized) {
    return
  }

  // Wait for Zotero to be available and initialized
  await new Promise<void>(resolve => {
    const checkZotero = () => {
      if (typeof Zotero !== 'undefined' && Zotero.initialized) {
        resolve()
      } else {
        setTimeout(checkZotero, POLL_INTERVAL)
      }
    }
    checkZotero()
  })
}
