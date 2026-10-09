const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  const file = path.join(__dirname, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  fs.readFile(file,(error,data) => { res.writeHead(error ? 404 : 200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'}); res.end(error ? 'Missing' : data); });
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = [], relays = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('request',request => { if (/formsubmit\.co/.test(request.url())) relays.push(request.url()); });
    await page.addInitScript(() => { localStorage.setItem('alpha.settings',JSON.stringify({autoRotate:false,reduceMotion:true,dataSaver:true})); localStorage.setItem('alpha.lang','en'); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await page.goto(origin);
    await page.waitForFunction(() => window.AlphaI18n && document.getElementById('year').textContent);
    assert.equal(await page.locator('form, input[type=file], script[src*="forms.js"]').count(),0);
    assert.equal(await page.locator('#panel-home .hero-actions [data-goto]').count(),2);
    assert.equal(await page.locator('#panel-home iframe').count(),0);
    for (const lang of ['en','fr','pt','es','id','th','vi','ar']) {
      await page.evaluate(code => AlphaI18n.set(code),lang);
      assert(await page.locator('[data-i18n^="simple."]').evaluateAll(nodes => nodes.every(n => n.textContent.trim() && !n.textContent.startsWith('simple.'))));
      for (const width of [1440,390,320]) {
        await page.setViewportSize({width,height:1000});
        await page.locator('#tab-home').click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${lang} ${width} home overflow`);
        if (['en','ar'].includes(lang) && width !== 320) await page.screenshot({path:`review-simple-home-${lang}-${width}.png`,fullPage:true});
        await page.locator('#panel-home [data-commission-link]').click();
        assert(page.url().endsWith('#contact'));
        assert.equal(await page.evaluate(() => document.activeElement.id),'contactEmail');
        const href = await page.locator('#contactEmail').getAttribute('href');
        assert(href.startsWith('mailto:admin@alphaff.gg?subject='));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${lang} ${width} contact overflow`);
        if (['en','ar'].includes(lang) && width !== 320) await page.screenshot({path:`review-simple-contact-${lang}-${width}.png`,fullPage:true});
      }
    }
    await page.evaluate(() => AlphaI18n.set('en'));
    await page.locator('#tab-home').click();
    await page.locator('#panel-home [data-courses-link]').click();
    assert.equal(await page.locator('[data-store-category="classes"]').getAttribute('aria-pressed'),'true');
    await page.waitForSelector('#classesGrid .lesson-item');
    await page.locator('#panel-store [data-commission-link]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id),'contactEmail');
    await page.locator('#tab-home').click();
    await page.locator('#panel-home [data-goto="models"]').click();
    await page.waitForSelector('#gridFree [data-id]');
    assert(page.url().includes('#models'));
    await page.goto(origin+'/#contact');
    assert(await page.locator('#contactEmail').isVisible());
    await page.locator('#menuBtn').click(); await page.locator('#openSettings').click();
    await page.locator('#setHighContrast').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id),'settingsClose');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('settingsModal').hidden);
    await page.waitForFunction(() => document.activeElement.id === 'menuBtn');
    assert.equal(await page.evaluate(() => document.activeElement.id),'menuBtn');
    assert.deepEqual(errors,[]); assert.deepEqual(relays,[]);
    console.log('PASS: home/contact in 8 languages at 3 widths; model/course/contact navigation; free lessons; email link; no forms, relay requests or JS errors; settings keyboard focus.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;}).finally(() => server.close());
