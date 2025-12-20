# Zotero Sci-Hub Plugin - English (US) Localisation
# See https://projectfluent.org/fluent/guide/ for Fluent syntax

# Menu Labels
zotero-scihub-menu-item = Retrieve PDF
zotero-scihub-menu-collection = Retrieve All Collection PDFs
zotero-scihub-menu-all = Update All PDFs

# Preference Pane
zotero-scihub-prefs-title = PDF Provider Settings
zotero-scihub-prefs-automatic =
    .label = Automatic PDF Download
zotero-scihub-prefs-provider-label =
    .value = Provider:
zotero-scihub-prefs-scihub-url-label =
    .value = Sci-Hub URL:
zotero-scihub-prefs-scihub-url-help = Base URL for Sci-Hub (e.g. https://sci-hub.ru/)

# Custom Providers Section
zotero-scihub-prefs-custom-title = Custom Providers
zotero-scihub-prefs-custom-help = Add custom PDF providers. Use {"{DOI}"} as placeholder for the DOI in the URL template.
zotero-scihub-prefs-custom-empty = No custom providers configured.
zotero-scihub-prefs-custom-name =
    .value = Name:
zotero-scihub-prefs-custom-url =
    .value = URL Template:
zotero-scihub-prefs-custom-linktext =
    .value = Link Text:
zotero-scihub-prefs-custom-name-placeholder = My Provider
zotero-scihub-prefs-custom-url-placeholder = https://example.com/{"{DOI}"}
zotero-scihub-prefs-custom-linktext-default = Download
zotero-scihub-prefs-btn-cancel =
    .label = Cancel
zotero-scihub-prefs-btn-save =
    .label = Save
zotero-scihub-prefs-btn-delete = Delete
zotero-scihub-prefs-btn-add =
    .label = + Add Custom Provider

# Validation Messages
zotero-scihub-validation-name-required = Please enter a provider name.
zotero-scihub-validation-url-required = Please enter a URL template.
zotero-scihub-validation-url-doi = URL template must contain {"{DOI}"} placeholder.
zotero-scihub-validation-linktext-required = Please enter the link text to match.

# Popup Messages
zotero-scihub-popup-doi-missing = DOI is missing
zotero-scihub-popup-pdf-unavailable = PDF not available
zotero-scihub-popup-try-later = Try again later.
zotero-scihub-popup-fetching = Fetching PDF

# Captcha Alert (with parameters)
zotero-scihub-alert-captcha =
    Captcha is required or the PDF is not yet ready for "{ $title }".
    You will be redirected to the provider page.
    Restart fetching process manually.
    Error message: { $error }
