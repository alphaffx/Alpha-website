# ALPHA website

Static HTML, CSS and JavaScript. Serve this folder over HTTP; opening `index.html` as a local file prevents catalog fetching. The main behavior lives in `app.js`, translations in `i18n.js`, and catalogs in `models/models.json` and `store.json`.

## Browsing

Sections support `#home`, `#models`, `#store`, and `#contact`. Models support links such as `#models/beesto`. The 3D viewer is imported on demand. Data saver requires an explicit click before loading a preview, and reduced motion disables automatic rotation.

Product images and model thumbnails are lazy-loaded. Model thumbnails live at `media/models/<model-id>.webp`; a missing thumbnail is hidden while its model remains accessible. Format and file-size labels come from the model catalog. Rigging and version metadata are not inferred from filenames.

Close exits fullscreen back to the embedded viewer; closing the embedded viewer returns to the catalog. Selecting a model or choosing “Open selected model” reopens the preview. Fullscreen opens only through its button. Mobile layouts use a two-column catalog, compact downloads and a “Browse models” shortcut.

## Adding models and automatic previews

1. Double-click `watch-models.bat` and keep it running.
2. Copy a `.glb` file into `models/`, plus its matching `.blend` if available.
3. Wait for `Saved media/models/<name>.webp` in the watcher window.
4. Refresh your local website. Commit and sync the model, `models/models.json`, and its new `.webp` to publish them.

The watcher uses the actual website's 3D viewer, lighting and material adjustments to generate a preview at a consistent camera angle. The model's exported orientation determines which side faces the camera. It saves an optimized 192×230 WebP automatically. Updated GLBs regenerate their thumbnails, missing thumbnails are recreated, and unchanged models are skipped. Existing previews are retained if rendering fails; retries occur every 30 seconds. `.thumbnail-cache.json` is local bookkeeping and is not committed.

Requirements: Node.js, Playwright, Microsoft Edge and internet access for the existing model-viewer dependency. The installed Codex Node/Playwright runtime is detected automatically on this machine; another machine can install Node.js and run `npm install --no-save playwright`. `PLAYWRIGHT_PATH` and `PREVIEW_BROWSER` optionally override the Playwright package and browser channel. No Python or manual image conversion is needed.

To regenerate one preview manually, run `node generate-previews.cjs --force --model "model name"`. To refresh all previews, use `node generate-previews.cjs --force`. `powershell -NoProfile -ExecutionPolicy Bypass -File watch-models.ps1 -Once` performs a single catalog/preview update and exits with a failure code if previews fail.

## Browser verification

Run `node test-previews.cjs` to test the watcher and thumbnail renderer in a temporary fixture without modifying your real models. It checks new previews, unchanged files, same-size changes, missing images, paid models and incomplete exports.

Run `node verify.cjs` with Playwright and Microsoft Edge installed. The script uses a local server on port 8765 and verifies navigation, reloads, Back, keyboard focus, store error recovery, thumbnails, mobile overflow, and data saver. It loads the existing external viewer dependency but does not submit messages or make purchases. Set `PLAYWRIGHT_PATH` if Playwright is installed outside the normal Node resolution path. The Codex bundled runtime is also supported.

The browser checks also produce `review-*.png` screenshots for local inspection. Use `generate-previews.cjs` for production thumbnails.

## Analytics and contact

The placeholder analytics script was removed. Enable Cloudflare Web Analytics only after obtaining the real site token; no visits are currently recorded by that integration.

The contact form validates optional email addresses and checks the relay response before reporting success. Actual inbox delivery and relay-account activation must be verified separately; automated checks do not send real mail.

The commission form on Contact collects name, email, project type, budget/currency, optional deadline, brief, and optional reference links. It uses the same FormSubmit recipient (`admin@alphaff.gg`) with a separate commission subject, a 20-second timeout, and retained inputs on failure. `node verify.cjs --commerce` tests translations, FAQ keyboard navigation, responsive layouts, validation, and mocked relay responses without sending email.

Store FAQ copy lives in `faqTranslations` in `i18n.js` for all eight languages. Commercial-use, credit, and redistribution answers currently direct visitors to the owner for permission; replace those answers with the owner's confirmed policy before treating this section as a definitive license.

## Publishing

These are local changes. Publish the updated HTML, CSS, JavaScript, catalogs, and `media/models/*.webp` files through the existing hosting workflow. Do not publish local screenshots or thumbnail PNG sources.
