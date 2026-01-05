// Bootstrap file for Zotero 7/8 plugin architecture
// This file handles plugin lifecycle: startup, shutdown, window load/unload

declare const Cc: any
declare const Ci: any
declare const Services: any
declare const Zotero: any

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

function log(msg: string): void {
  if (Zotero?.debug) {
    Zotero.debug(`PDFerret bootstrap: ${msg}`)
  }
}

// Called when the plugin is installed (required by Zotero)
export function install(): void {
  log('install, nothing to do')
}

// Called when the plugin is uninstalled (required by Zotero)
export function uninstall(): void {
  log('uninstall, nothing to do')
}

// Called when the plugin starts
export async function startup({ resourceURI, rootURI = resourceURI.spec }: {
  id: string
  version: string
  resourceURI: { spec: string }
  rootURI?: string
}, reason: number): Promise<void> {
  try {
    log('startup started')

    // Register chrome resources with RELATIVE paths
    // Note: Only 'content' and 'locale' are supported by registerChrome
    const aomStartup = Cc['@mozilla.org/addons/addon-manager-startup;1']
      .getService(Ci.amIAddonManagerStartup)
    const manifestURI = Services.io.newURI(`${rootURI}manifest.json`)
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ['content', 'pdferret', 'content/'],
      ['locale', 'pdferret', 'en-US', 'locale/en-US/'],
    ])

    // Load the main plugin script
    Services.scriptloader.loadSubScriptWithOptions(
      `${rootURI}content/pdferret.js`,
      {
        target: {
          Zotero,
          rootURI,
          setTimeout,
          clearTimeout,
        },
      }
    )

    // Register preference pane
    await Zotero.PreferencePanes.register({
      pluginID: 'pdferret@example.com',
      src: `${rootURI}content/preferences.xhtml`,
      label: 'PDFerret',
      image: `${rootURI}skin/default/pdferret-logo.svg`,
    })

    // Initialize the plugin
    await Zotero.PDFerret.startup(BOOTSTRAP_REASONS[reason])

    // If main window is already open, call onMainWindowLoad now
    const win = Zotero.getMainWindow()
    if (win) {
      log('main window already open, calling onMainWindowLoad')
      Zotero.PDFerret.onMainWindowLoad(win)
    }

    log('startup done')
  } catch (err) {
    log(`startup failed: ${err}`)
    if (Zotero?.logError) {
      Zotero.logError(err)
    }
  }
}

// Called when the plugin is disabled or uninstalled
export function shutdown(_data: {
  id: string
  version: string
  resourceURI: { spec: string }
  rootURI?: string
}, _reason: number): void {
  log('shutdown')

  // Unload the plugin
  if (Zotero?.PDFerret) {
    Zotero.PDFerret.shutdown()
  }

  // Unregister chrome resources
  if (chromeHandle) {
    chromeHandle.destruct()
    chromeHandle = null
  }

  // Clear Zotero.PDFerret namespace
  if (Zotero?.PDFerret) {
    delete Zotero.PDFerret
  }
}

// Called when the main Zotero window loads
export function onMainWindowLoad({ window: win }: { window: Window }): void {
  log('onMainWindowLoad')
  if (Zotero?.PDFerret) {
    Zotero.PDFerret.onMainWindowLoad(win)
  }
}

// Called when the main Zotero window unloads
export function onMainWindowUnload({ window: win }: { window: Window }): void {
  log('onMainWindowUnload')
  if (Zotero?.PDFerret) {
    Zotero.PDFerret.onMainWindowUnload(win)
  }
}
