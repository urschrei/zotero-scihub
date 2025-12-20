# Zotero-Scihub

This is an add-on for [Zotero](https://www.zotero.org/) 8.x and [Juris-M](https://juris-m.github.io/) that enables automatic download of PDFs for items with a DOI.

## Quick Start Guide

### Install

- Download the latest release (.xpi file) from the [Releases Page](https://github.com/ethanwillis/zotero-scihub/releases)
  _Note_ If you're using Firefox as your browser, right click the xpi and select "Save As.."
- In Zotero click "Tools" in the top menu bar and then click "Plugins"
- Click the gear icon on the top right
- Select Install Add-on from file
- Browse to where you downloaded the `.xpi` file and select it, then click `Open`
- The plugin is now installed.

### Usage

Right-click any item in your collections.
There will now be a new context menu option titled "Update Sci-Hub PDF." When you
click this, a PDF will be downloaded from Sci-Hub and attached to your
item in Zotero. Clicking on a collection will give you the option of updating all items in the same way.

You can configure the plugin to automatically download and attach PDFs when items are added.

### Configuration

The plugin is configured through the dedicated tab: 

<img width="782" alt="Screenshot 2021-08-21 at 22 14 04" src="https://user-images.githubusercontent.com/387791/130333778-8bfb0878-2122-49a9-bc23-c528eb9b6cbf.png">

### DNS-over-HTTPS

In case of malfunctioning or unsafe local DNS server, Zotero (as it's built on Firefox) might be configured with [Trusted Recursive Resolver](https://wiki.mozilla.org/Trusted_Recursive_Resolver) or DNS-over-HTTPS, where you could set your own DNS server just for Zotero without modifying network settings.

_Preferences > Advanced > Config Editor_

1. set `network.trr.mode` to `2` or `3`, this enables DNS-over-HTTPS (2 enables it with fallback)
2. set `network.trr.uri` to `https://cloudflare-dns.com/dns-query`, this is the provider’s URL
3. set `network.trr.bootstrapAddress` to `1.1.1.1`, this is cloudflare’s normal DNS server (only) used to retrieve the IP of cloudflare-dns.com
4. Restart zotero, wait for a DNS cache to clean up.

## Building

0. Pre-requisite is to have [node.js](nodejs.org) installed. Buildings is tested using the LTS version (as of late 2025)
1. Run `npm install`
2. Run `npm run build` to build the XPI

## Localisation

This plugin uses Mozilla's [Fluent](https://projectfluent.org/) localisation system. All user-facing strings are stored in `.ftl` files located in `locale/`.

### File structure

```
locale/
  en-US/
    zotero-scihub.ftl    # English (US) strings
```

### Adding new strings

1. Add the string to `locale/en-US/zotero-scihub.ftl` with a key prefixed by `zotero-scihub-`:

   ```ftl
   zotero-scihub-my-new-string = My new string value
   ```

2. Use the string in TypeScript via the `getString()` helper:

   ```typescript
   import { getString } from './locale'

   const message = getString('my-new-string')
   ```

3. For strings with parameters:

   ```ftl
   zotero-scihub-greeting = Hello, { $name }!
   ```

   ```typescript
   getString('greeting', { name: 'World' })
   ```

4. For XHTML elements, use `data-l10n-id`:

   ```xml
   <label data-l10n-id="zotero-scihub-my-new-string"/>
   ```

### Adding a new language

1. Create a new directory under `locale/` (e.g., `locale/de-DE/`)
2. Copy `zotero-scihub.ftl` from `en-US/` and translate the values
3. Register the locale in `content/bootstrap.ts` by adding a line to `registerChrome()`:

   ```typescript
   ['locale', 'zotero-scihub', 'de-DE', 'locale/de-DE/'],
   ```

See the [Fluent Syntax Guide](https://projectfluent.org/fluent/guide/) for more details on the `.ftl` format.

## [Contributing](./CONTRIBUTING.md)

## Disclaimer

Use this code at your own peril. No warranties are provided. Keep the laws of your locality in mind!
