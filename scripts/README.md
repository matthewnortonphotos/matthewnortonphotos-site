# Website image copies

The original photographs remain in `images/`. The website displays responsive WebP copies from `images/web/`.

To add or replace photographs:

1. Add the original file to `images/` and reference it in the gallery list or a homepage image's `data-original` attribute in `index.html`.
2. Install the image tool dependencies in a virtual environment: `python3 -m pip install -r scripts/requirements-images.txt`.
3. Run `python3 scripts/optimize-images.py`.
4. Commit the generated web copies, `scripts/image-manifest.js`, and updated `index.html` together.

The tool applies EXIF orientation, converts embedded color profiles to sRGB, and generates up to 480-, 960-, and 1600-pixel-wide WebP files at quality 86. It never enlarges or overwrites an original. The small logo uses 80- and 160-pixel copies.

The first homepage photo loads eagerly. Later carousel photos are requested as needed and decoded before advancing. Lower page images use browser lazy loading. Galleries request the visible photo plus its neighbors, with responsive selection based on the available display size; failed requests keep the previous photograph visible and can be retried.

The live GitHub Pages site deploys from `main`; a separate branch does not publish the change.
