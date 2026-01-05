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

# Error Messages - Titles (for popup headlines)
zotero-scihub-error-connection-title = Connection Error
zotero-scihub-error-timeout-title = Request Timed Out
zotero-scihub-error-captcha-title = Captcha Required
zotero-scihub-error-rate-limited-title = Rate Limited
zotero-scihub-error-pdf-not-found-title = PDF Not Found
zotero-scihub-error-pdf-not-ready-title = PDF Not Ready
zotero-scihub-error-unknown-title = Error

# Error Messages - Full descriptions (with parameters)
zotero-scihub-error-connection =
    Could not connect to the provider.
    Please check your internet connection and try again.
    Item: "{ $title }"

zotero-scihub-error-timeout =
    The request timed out.
    The provider may be slow or unreachable. Please try again later.
    Item: "{ $title }"

zotero-scihub-error-captcha =
    The provider requires captcha verification.
    You will be redirected to complete the captcha.
    Restart the PDF download manually afterwards.
    Item: "{ $title }"

zotero-scihub-error-rate-limited =
    Too many requests. The provider has rate-limited you.
    You will be redirected to the provider page.
    Please wait a moment before trying again.
    Item: "{ $title }"

zotero-scihub-error-pdf-not-found =
    The PDF was not found in the provider's database.
    This paper may not be available through this provider.
    Item: "{ $title }"

zotero-scihub-error-pdf-not-ready =
    The PDF is not ready yet but may become available later.
    Try again in a few minutes.
    Item: "{ $title }"

zotero-scihub-error-unknown =
    An unexpected error occurred.
    Item: "{ $title }"
    Details: { $error }
