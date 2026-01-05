# PDFerret Plugin - English (US) Localisation
# See https://projectfluent.org/fluent/guide/ for Fluent syntax

# Menu Labels
pdferret-menu-item = Retrieve PDF
pdferret-menu-collection = Retrieve All Collection PDFs
pdferret-menu-all = Update All PDFs

# Preference Pane
pdferret-prefs-title = PDF Provider Settings
pdferret-prefs-automatic =
    .label = Automatic PDF Download
pdferret-prefs-provider-label =
    .value = Provider:
pdferret-prefs-scihub-url-label =
    .value = Sci-Hub URL:
pdferret-prefs-scihub-url-help = Base URL for Sci-Hub (e.g. https://sci-hub.ru/)

# Custom Providers Section
pdferret-prefs-custom-title = Custom Providers
pdferret-prefs-custom-help = Add custom PDF providers. Use {"{DOI}"} as placeholder for the DOI in the URL template.
pdferret-prefs-custom-empty = No custom providers configured.
pdferret-prefs-custom-name =
    .value = Name:
pdferret-prefs-custom-url =
    .value = URL Template:
pdferret-prefs-custom-linktext =
    .value = Link Text:
pdferret-prefs-custom-name-placeholder = My Provider
pdferret-prefs-custom-url-placeholder = https://example.com/{"{DOI}"}
pdferret-prefs-custom-linktext-default = Download
pdferret-prefs-btn-cancel =
    .label = Cancel
pdferret-prefs-btn-save =
    .label = Save
pdferret-prefs-btn-delete = Delete
pdferret-prefs-btn-add =
    .label = + Add Custom Provider

# Validation Messages
pdferret-validation-name-required = Please enter a provider name.
pdferret-validation-url-required = Please enter a URL template.
pdferret-validation-url-doi = URL template must contain {"{DOI}"} placeholder.
pdferret-validation-linktext-required = Please enter the link text to match.

# Popup Messages
pdferret-popup-doi-missing = DOI is missing
pdferret-popup-pdf-unavailable = PDF not available
pdferret-popup-try-later = Try again later.
pdferret-popup-fetching = Fetching PDF

# Error Messages - Titles (for popup headlines)
pdferret-error-connection-title = Connection Error
pdferret-error-timeout-title = Request Timed Out
pdferret-error-captcha-title = Captcha Required
pdferret-error-rate-limited-title = Rate Limited
pdferret-error-pdf-not-found-title = PDF Not Found
pdferret-error-pdf-not-ready-title = PDF Not Ready
pdferret-error-unknown-title = Error

# Error Messages - Full descriptions (with parameters)
pdferret-error-connection =
    Could not connect to the provider.
    Please check your internet connection and try again.
    Item: "{ $title }"

pdferret-error-timeout =
    The request timed out.
    The provider may be slow or unreachable. Please try again later.
    Item: "{ $title }"

pdferret-error-captcha =
    The provider requires captcha verification.
    You will be redirected to complete the captcha.
    Restart the PDF download manually afterwards.
    Item: "{ $title }"

pdferret-error-rate-limited =
    Too many requests. The provider has rate-limited you.
    You will be redirected to the provider page.
    Please wait a moment before trying again.
    Item: "{ $title }"

pdferret-error-pdf-not-found =
    The PDF was not found in the provider's database.
    This paper may not be available through this provider.
    Item: "{ $title }"

pdferret-error-pdf-not-ready =
    The PDF is not ready yet but may become available later.
    Try again in a few minutes.
    Item: "{ $title }"

pdferret-error-unknown =
    An unexpected error occurred.
    Item: "{ $title }"
    Details: { $error }
