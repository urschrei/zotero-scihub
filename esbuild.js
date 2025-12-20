const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')

// Copy manifest.json to build directory
function copyManifest() {
  const manifestSrc = path.join(__dirname, 'manifest.json')
  const manifestDest = path.join(__dirname, 'build', 'manifest.json')

  // Ensure build directory exists
  if (!fs.existsSync(path.join(__dirname, 'build'))) {
    fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true })
  }

  // Read manifest and update version from package.json
  const manifest = JSON.parse(fs.readFileSync(manifestSrc, 'utf-8'))
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'))
  manifest.version = pkg.version

  fs.writeFileSync(manifestDest, JSON.stringify(manifest, null, 2))
  console.log('Copied manifest.json to build/')
}

// Copy chrome.manifest to build directory
function copyChromeManifest() {
  const src = path.join(__dirname, 'chrome.manifest')
  const dest = path.join(__dirname, 'build', 'chrome.manifest')
  fs.copyFileSync(src, dest)
  console.log('Copied chrome.manifest to build/')
}

// Copy locale directory to build
function copyLocales() {
  const srcDir = path.join(__dirname, 'locale')
  const destDir = path.join(__dirname, 'build', 'locale')

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  // Copy en-US locale
  const enUSDir = path.join(destDir, 'en-US')
  if (!fs.existsSync(enUSDir)) {
    fs.mkdirSync(enUSDir, { recursive: true })
  }

  const localeFiles = fs.readdirSync(path.join(srcDir, 'en-US'))
    .filter(f => f.endsWith('.ftl'))  // Only copy Fluent files
  for (const file of localeFiles) {
    fs.copyFileSync(
      path.join(srcDir, 'en-US', file),
      path.join(enUSDir, file)
    )
  }
  console.log('Copied locale files to build/')
}

// Copy skin directory to build
function copySkin() {
  const srcDir = path.join(__dirname, 'skin', 'default')
  const destDir = path.join(__dirname, 'build', 'skin', 'default')

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const skinFiles = fs.readdirSync(srcDir)
  for (const file of skinFiles) {
    fs.copyFileSync(
      path.join(srcDir, file),
      path.join(destDir, file)
    )
  }
  console.log('Copied skin files to build/')
}

// Copy preferences.xhtml to build
function copyPreferences() {
  const src = path.join(__dirname, 'content', 'preferences.xhtml')
  const dest = path.join(__dirname, 'build', 'content', 'preferences.xhtml')

  if (!fs.existsSync(path.join(__dirname, 'build', 'content'))) {
    fs.mkdirSync(path.join(__dirname, 'build', 'content'), { recursive: true })
  }

  fs.copyFileSync(src, dest)
  console.log('Copied preferences.xhtml to build/')
}

// Patch zotero-plugin-toolkit's _importESModule to fix Zotero 8 deprecation warnings
// The toolkit checks `typeof ChromeUtils.import === "undefined"` but in Zotero 8,
// ChromeUtils.import exists (just deprecated). We need to check for importESModule first.
function patchImportESModule() {
  const scihubPath = path.join(__dirname, 'build', 'content', 'scihub.js')
  let content = fs.readFileSync(scihubPath, 'utf-8')

  // Replace the flawed _importESModule function
  const oldPattern = /function _importESModule\(path\) \{\s*if \(typeof ChromeUtils\.import === "undefined"\) return ChromeUtils\.importESModule\(path, \{ global: "contextual" \}\);\s*if \(path\.endsWith\("\.sys\.mjs"\)\) path = path\.replace\(\/\\\.sys\\\.mjs\$\/, "\.jsm"\);\s*return ChromeUtils\.import\(path\);\s*\}/

  const newFunction = `function _importESModule(path) {
    if (typeof ChromeUtils.importESModule !== "undefined") return ChromeUtils.importESModule(path, { global: "contextual" });
    if (path.endsWith(".sys.mjs")) path = path.replace(/\\.sys\\.mjs$/, ".jsm");
    return ChromeUtils.import(path);
  }`

  if (oldPattern.test(content)) {
    content = content.replace(oldPattern, newFunction)
    fs.writeFileSync(scihubPath, content)
    console.log('Patched _importESModule for Zotero 8 compatibility')
  } else {
    console.log('Warning: Could not find _importESModule pattern to patch')
  }
}

async function build() {
  // Copy assets first
  copyManifest()
  copyChromeManifest()
  copyLocales()
  copySkin()
  copyPreferences()

  // Build bootstrap.js (root level for plugin loading)
  await esbuild.build({
    bundle: true,
    format: 'iife',
    target: ['firefox115'],
    entryPoints: ['content/bootstrap.ts'],
    outfile: 'build/bootstrap.js',
    globalName: 'ScihubBootstrap',
    footer: {
      js: `
// Export bootstrap functions for Zotero
var install = ScihubBootstrap.install;
var uninstall = ScihubBootstrap.uninstall;
var startup = ScihubBootstrap.startup;
var shutdown = ScihubBootstrap.shutdown;
var onMainWindowLoad = ScihubBootstrap.onMainWindowLoad;
var onMainWindowUnload = ScihubBootstrap.onMainWindowUnload;
`
    },
  })
  console.log('Built bootstrap.js')

  // Build main plugin script
  await esbuild.build({
    bundle: true,
    format: 'iife',
    target: ['firefox115'],
    entryPoints: ['content/scihub.ts'],
    outdir: 'build/content',
    banner: { js: 'if (!Zotero.Scihub) {\n' },
    footer: { js: '\n}' },
  })
  console.log('Built scihub.js')

  // Patch toolkit's _importESModule for Zotero 8 compatibility
  patchImportESModule()
}

build().catch(err => {
  console.log(err)
  process.exit(1)
})
