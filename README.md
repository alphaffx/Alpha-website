# ALPHA website

Static HTML, CSS and JavaScript. Serve this folder over HTTP; opening `index.html` as a local file prevents catalog fetching. The main behavior lives in `app.js`, translations in `i18n.js`, and catalogs in `models/models.json` and `store.json`.

## Browsing

Sections support `#home`, `#models`, `#store`, and `#contact`. Models support links such as `#models/beesto`. The 3D viewer is imported on demand. Data saver requires an explicit click before loading a preview, and reduced motion disables automatic rotation.

Product images and model thumbnails are lazy-loaded. Model thumbnails live at `media/models/<model-id>.webp`; a missing thumbnail is hidden while its model remains accessible. Format and file-size labels come from the model catalog. Rigging and version metadata are not inferred from filenames.

Close exits fullscreen back to the embedded viewer; closing the embedded viewer returns to the catalog. Selecting a model or choosing “Open selected model” reopens the preview. Fullscreen opens only through its button. Mobile layouts use a two-column catalog, compact downloads and a “Browse models” shortcut.

## Verification

Run `node verify.cjs` with Playwright and Microsoft Edge installed. The script uses a local server on port 8765 and verifies navigation, reloads, Back, keyboard focus, store error recovery, thumbnails, mobile overflow, and data saver. It loads the existing external viewer dependency but does not submit messages or make purchases. Set `PLAYWRIGHT_PATH` if Playwright is installed outside the normal Node resolution path. The Codex bundled runtime is also supported.

Run `node verify.cjs --render` to render PNG thumbnail sources from the GLB files. Convert these to 192×230 WebP images before publishing; the website uses the WebP files. The browser checks also produce `review-*.png` screenshots for local inspection.

## Analytics and contact

The placeholder analytics script was removed. Enable Cloudflare Web Analytics only after obtaining the real site token; no visits are currently recorded by that integration.

The contact form validates optional email addresses and checks the relay response before reporting success. Actual inbox delivery and relay-account activation must be verified separately; automated checks do not send real mail.

## Publishing

These are local changes. Publish the updated HTML, CSS, JavaScript, catalogs, and `media/models/*.webp` files through the existing hosting workflow. Do not publish local screenshots or thumbnail PNG sources.
