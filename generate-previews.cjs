// Render missing or changed model thumbnails through the actual website viewer.
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const root = __dirname;
const cacheFile = path.join(root, '.thumbnail-cache.json');
const outputDir = path.join(root, 'media', 'models');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Bump when preview rendering changes so cached thumbnails are regenerated.
const RENDER_VERSION = 2;
const fingerprint = stat => `${RENDER_VERSION}:${stat.size}:${stat.mtimeMs}`;

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return fallback; throw error; }
}

async function atomicWrite(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  try { await fs.writeFile(temporary, contents); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}

async function generate({ force = false, only } = {}) {
  require('./generate-model-details.cjs').generate(root);
  const cache = await readJson(cacheFile, {});
  const manifest = await readJson(path.join(root, 'models/models.json'), { models: [] });
  const pending = [];
  for (const model of manifest.models) {
    const id = model.id;
    if (typeof id !== 'string' || /[\\/]/.test(id) || id === '.' || id === '..' || (only && id !== only)) continue;
    const source = path.join(root, 'models', id + '.glb');
    const output = path.join(outputDir, id + '.webp');
    const stat = await fs.stat(source);
    const signature = fingerprint(stat);
    const previous = cache[id];
    const preview = await fs.stat(output).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!force && preview?.size && previous?.signature === signature) {
      cache[id] = { signature }; continue;
    }
    pending.push({ id, source, output, signature });
  }
  if (only && !manifest.models.some(model => model.id === only)) throw new Error(`Model not in catalog: ${only}`);
  if (!pending.length) {
    await atomicWrite(cacheFile, JSON.stringify(cache, null, 2));
    console.log('Previews are up to date.'); return { rendered: 0 };
  }

  // Let file copies finish; never replace a good thumbnail with an incomplete export.
  await sleep(1500);
  const ready = [];
  let failed = false;
  for (const item of pending) {
    try {
    const stat = await fs.stat(item.source);
    if (fingerprint(stat) !== item.signature) throw new Error(`${item.id} is still being copied; will retry.`);
    const handle = await fs.open(item.source, 'r');
    try {
      const header = Buffer.alloc(12); await handle.read(header, 0, 12, 0);
      if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2 || header.readUInt32LE(8) !== stat.size) {
        throw new Error(`${item.id}: incomplete or invalid GLB; will retry.`);
      }
    } finally { await handle.close(); }
    ready.push(item);
    } catch (error) { failed = true; console.error(error.message); }
  }
  if (!ready.length) throw new Error('No complete GLB files ready to render; will retry.');

  let playwright;
  try { playwright = require('playwright'); }
  catch {
    const location = process.env.PLAYWRIGHT_PATH || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    try { playwright = require(location); }
    catch { throw new Error('Playwright is missing. Install it with npm install --no-save playwright, or set PLAYWRIGHT_PATH.'); }
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') { res.writeHead(405).end(); return; }
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !types[path.extname(file)] || relative.split(path.sep).some(part => part.startsWith('.'))) { res.writeHead(403).end(); return; }
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store' }).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await playwright.chromium.launch({ channel: process.env.PREVIEW_BROWSER || 'msedge', headless: true, args: ['--enable-webgl', '--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 400, height: 480 }, deviceScaleFactor: 1 });
    await page.addInitScript(() => {
      localStorage.setItem('alpha.settings', JSON.stringify({ autoRotate: false, reduceMotion: true, dataSaver: true }));
    });
    // No analytics, forms, or fonts are needed for model rendering.
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origin + '/') || url.startsWith('https://unpkg.com/') || url.startsWith('https://www.gstatic.com/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      return route.abort();
    });
    await fs.mkdir(outputDir, { recursive: true });
    for (const item of ready) {
      try {
        console.log(`Rendering ${item.id}…`);
        await page.goto(`${origin}/?preview=${encodeURIComponent(item.id)}#models/${encodeURIComponent(item.id)}`, { waitUntil: 'domcontentloaded' });
        // Use the site's viewer and load handler (including material fixes), also for paid models.
        // Data saver prevents a different default model from racing this explicit source.
        await page.evaluate(async id => {
          await import('https://unpkg.com/@google/model-viewer@4.3.1/dist/model-viewer.min.js');
          document.querySelector('model-viewer').setAttribute('src', './models/' + encodeURIComponent(id) + '.glb');
        }, item.id);
        await page.waitForFunction(id => {
          const viewer = document.querySelector('model-viewer');
          const src = './models/' + encodeURIComponent(id) + '.glb';
          return viewer?.loaded && viewer.getAttribute('src') === src && viewer.dataset.materialsReady === src;
        }, item.id, { timeout: 60000 });
        await page.evaluate(async () => {
          const viewer = document.querySelector('model-viewer');
          viewer.removeAttribute('auto-rotate');
          document.body.appendChild(viewer);
          Array.from(document.body.children).forEach(el => { if (el !== viewer) el.style.display = 'none'; });
          viewer.className = '';
          viewer.style.cssText = 'position:fixed;inset:0;width:400px;height:480px;background:#111b26';
          await viewer.updateFraming();
          viewer.cameraOrbit = '0deg 80deg 105%';
          viewer.jumpCameraToGoal();
        });
        await page.waitForTimeout(500);
        const png = await page.locator('model-viewer').screenshot();
        const webp = await page.evaluate(async base64 => {
          const img = new Image(); img.src = 'data:image/png;base64,' + base64; await img.decode();
          const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 230;
          canvas.getContext('2d').drawImage(img, 0, 0, 192, 230);
          return canvas.toDataURL('image/webp', .86).split(',')[1];
        }, png.toString('base64'));
        if (fingerprint(await fs.stat(item.source)) !== item.signature) throw new Error('Model changed during rendering; will retry.');
        const bytes = Buffer.from(webp, 'base64');
        if (bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Browser could not produce WebP.');
        await atomicWrite(item.output, bytes);
        cache[item.id] = { signature: item.signature };
        await atomicWrite(cacheFile, JSON.stringify(cache, null, 2));
        console.log(`Saved media/models/${item.id}.webp (${bytes.length} bytes)`);
      } catch (error) { failed = true; console.error(`Preview failed for ${item.id}: ${error.message}`); }
    }
    if (failed) throw new Error('Some previews failed. Existing images were kept; the watcher will retry.');
    return { rendered: pending.length };
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  generate({ force: args.includes('--force'), only: args.includes('--model') ? args[args.indexOf('--model') + 1] : undefined })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { generate };
