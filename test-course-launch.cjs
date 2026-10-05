const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const expected = [
  ['free-fire-blender-en', 'htlskt', '$99.99'],
  ['free-fire-blender-part-1-en', 'dlfdlv', '$24.99'],
  ['free-fire-blender-part-2-en', 'kubex', '$74.99']
];
const server = http.createServer((req, res) => {
  const file = path.join(__dirname, req.url.split('?')[0] === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (err, data) => {
    const mime = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp'};
    res.writeHead(err ? 404 : 200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(err ? 'Missing' : data);
  });
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(8766, '127.0.0.1', resolve));
    browser = await chromium.launch({channel:'msedge',headless:true});
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('http://127.0.0.1:8766/');
    await page.evaluate(() => window.AlphaI18n.set('en'));
    await page.locator('[data-courses-link]').first().click();
    await page.waitForFunction(() => document.querySelectorAll('#storeCourses .store-card').length === 6);
    for (const [slug, link, price] of expected) {
      const card = page.locator('#storeCourses .store-card').filter({has:page.locator(`a[href="https://alphaff.gumroad.com/l/${link}"]`)});
      assert.equal(await card.count(), 1);
      assert.equal(await card.locator('.store-card-price').textContent(), price);
      assert((await card.locator('.store-card-name').textContent()).includes('(English)'));
      await card.scrollIntoViewIfNeeded();
      await card.locator('img').evaluate(img => img.decode());
      assert((await card.locator('img').getAttribute('src')).includes(slug));
    }
    assert.equal(await page.locator('#learnForm, [data-learn-link]').count(), 0);
    await page.locator('#storeCourses').screenshot({path:'review-course-launch-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.locator('#storeCourses .store-card').first().screenshot({path:'review-course-launch-mobile.png'});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const code of ['en','fr','pt','es','id','th','vi','ar']) {
      await page.evaluate(code => window.AlphaI18n.set(code), code);
      assert.equal(await page.locator('#storeCourses .store-card').count(), 6);
      assert.equal(await page.locator('[data-i18n="course.summary"]').first().textContent(), await page.evaluate(() => AlphaI18n.t('course.summary')));
    }
    assert.deepEqual(errors, []);
    console.log('PASS: six course editions, correct English checkout links/prices, three loaded thumbnails, retired waitlist, mobile layout, and all eight languages.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
