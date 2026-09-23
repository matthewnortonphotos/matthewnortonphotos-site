# Website image copies

The original photographs remain in `images/`. The website displays responsive WebP copies from `images/web/`.

To add or replace photographs:

1. Add the original file to `images/` and reference it in the gallery list or a homepage image's `data-original` attribute in `index.html`.
2. Install the image tool dependencies in a virtual environment: `python3 -m pip install -r scripts/requirements-images.txt`.
3. Run `python3 scripts/optimize-images.py`.
4. Commit the generated web copies, `scripts/image-manifest.js`, and updated `index.html` together.

The tool applies EXIF orientation, converts embedded color profiles to sRGB, and generates up to 480-, 960-, and 1600-pixel-wide WebP files at quality 86. It never enlarges or overwrites an original. Existing copies newer than their source are reused; delete those copies if changing encoding settings. The small logo uses 80- and 160-pixel copies.

The first homepage photo loads eagerly. Later carousel photos are requested as needed and decoded before advancing. Lower page images use browser lazy loading. Galleries request the visible photo plus its neighbors, with responsive selection based on the available display size; failed requests keep the previous photograph visible and can be retried.

The live GitHub Pages site deploys from `main`; a separate branch does not publish the change.

## Galleries and supplied assets

`galleryImages` in `index.html` retains the original photo sequence. `groupGalleryPhotos` pairs successive landscapes at the first landscape's position, moving only the second member of each pair; portraits retain their relative order. One unpaired landscape remains solo. All pages use the same portrait-sized frame, with two contained landscape images stacked in paired pages. A counter counts pages, not individual photographs.

`strangerDetails` maps each Stranger Portrait to its displayed name, location and Instagram reel. The Al Perkins cover and gallery opener use the same portrait. Originals are preserved in `images/strangers`; `_config.yml` excludes that source folder from Pages, while generated copies in `images/web` remain public.

Supplied monochrome social icons are served as 64px transparent PNGs at 24px display size. The supplied favicon artwork has 32px and 64px square copies under `assets/favicons`. `favicon.js` observes `prefers-color-scheme` and switches the black/light and white/dark versions on preference changes. This follows the preference the browser exposes, which can differ from a custom browser toolbar theme.

## Inquiry form

`inquiry-form.js` submits URL-encoded form data to the Apps Script URL in the form action. It shows success only after reading `{ok:true,saved:true,submissionId:<matching ID>}`. Failed or uncertain requests preserve entered text and reuse the request ID; modified content gets a new ID. Inputs are read-only during submission to avoid losing edits. No visitor confirmation email is sent.

`website-inquiries.gs` is a versioned copy of the server script provided to Matthew. Editing it here does not update Google's deployment; changes must be copied into Apps Script and deployed there. The setup creates a dedicated tab and a retry trigger without sending an email. Keep the Google Sheet private. The server's row status `Sent` means Google's mail service accepted the email, not verified inbox delivery. `Sending` rows after interrupted operations and `Review needed` rows require checking the inbox and Apps Script execution history before any manual retry. The script has a honeypot, size limits, duplicate IDs and a global rolling 100-inquiry daily cap; it is not comprehensive bot protection.

## Checks

- Run `node tests/verify-site.cjs` from the repository root for asset, grouping, mapping and JavaScript checks.
- Serve the repository locally (`python3 -m http.server 8765 --bind 127.0.0.1`) and open `/tests/browser-checks.html` for responsive galleries, captions, wrapping, focus, favicon preference changes, form error/retry/success behavior and image failures. Form responses and the failed-image scenario are simulated; this suite sends no email.
- Separately submit one labeled test through the normal preview and confirm the actual sheet row, received email and Reply-To. Never infer inbox delivery from the browser's success message alone.

The existing custom-font references point to three files absent from the repository; the site uses its existing fallback fonts. Those unrelated font references are unchanged by this update.
