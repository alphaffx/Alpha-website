const playwrightPath = process.env.PLAYWRIGHT_PATH || require('path').join(require('os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let playwright; try { playwright = require('playwright'); } catch { playwright = require(playwrightPath); }
const {chromium}=playwright;
const fs=require('fs'), http=require('http'), path=require('path');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{const p=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));fs.readFile(p,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{
await new Promise(r=>server.listen(8765,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8765');
if(process.argv.includes('--render')) {
await page.locator('#tab-models').click();
await page.waitForFunction(()=>document.querySelector('model-viewer').loaded,null,{timeout:60000});
await page.evaluate(()=>{const v=document.querySelector('model-viewer'); v.removeAttribute('auto-rotate'); document.body.appendChild(v); Array.from(document.body.children).forEach(el=>{if(el!==v)el.style.display='none';});v.className=''; v.style.cssText='position:fixed;inset:0;width:400px;height:480px;z-index:99999;background:#111b26';});
fs.mkdirSync('media/models',{recursive:true});
for(const m of JSON.parse(fs.readFileSync('models/models.json')).models){
await page.evaluate(async id=>{const v=document.querySelector('model-viewer');const src='./models/'+encodeURIComponent(id)+'.glb';if(v.getAttribute('src') !== src || !v.loaded) await new Promise((resolve,reject)=>{v.addEventListener('load',resolve,{once:true});v.addEventListener('error',reject,{once:true});v.src=src;});v.cameraOrbit='0deg 80deg 105%';v.jumpCameraToGoal();},m.id);
await page.waitForTimeout(350);
await page.locator('model-viewer').screenshot({path:'media/models/'+m.id+'.png'});
console.log('Rendered',m.id);
}
}
const assert=require('assert/strict');
// Exercise the actual picker, including text, accessible names, persistence and RTL.
const resetLabels = {
  en: 'Reset view', fr: 'Réinitialiser la vue', pt: 'Redefinir visualização',
  es: 'Restablecer vista', id: 'Atur ulang tampilan', th: 'รีเซ็ตมุมมอง',
  vi: 'Đặt lại góc nhìn', ar: 'إعادة ضبط العرض'
};
await page.locator('#menuBtn').click();
await page.locator('#openSettings').click();
const languages = await page.evaluate(() => window.AlphaI18n.langs);
assert.deepEqual(languages.map(l => l.code).sort(), Object.keys(resetLabels).sort());
for (const lang of languages) {
  await page.locator(`#langGrid [data-code="${lang.code}"]`).click();
  assert.equal(await page.locator('#resetBtn [data-i18n]').textContent(), resetLabels[lang.code]);
  assert.equal(await page.locator('#resetBtn').getAttribute('aria-label'), resetLabels[lang.code]);
  assert.equal(await page.locator('html').getAttribute('lang'), lang.code);
  assert.equal(await page.locator('html').getAttribute('dir'), lang.dir);
  assert.deepEqual(await page.locator('#langGrid .lang-btn').allTextContents(), languages.map(l => l.name));
  assert.equal(await page.locator('#langGrid .is-active').getAttribute('data-code'), lang.code);
  assert.equal(await page.evaluate(() => localStorage.getItem('alpha.lang')), lang.code);
}
await page.reload();
assert.equal(await page.locator('#resetBtn').getAttribute('aria-label'), resetLabels.ar);
await page.locator('#tab-store').click();
await page.waitForFunction(() => document.querySelectorAll('#storeOther .store-card').length === 6);
for (const code of ['ar', 'en']) {
  await page.evaluate(code => window.AlphaI18n.set(code), code);
  for (const width of [1440, 800, 390, 320]) {
    await page.setViewportSize({width, height: 900});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const columns = await page.locator('#storeOther').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width > 1000 ? 3 : width > 640 ? 2 : 1);
    assert.equal(await page.locator('#storeOther .store-card-buy').count(), 6);
    if (width === 1440 || width === 390) await page.screenshot({path: `review-store-${code}-${width}.png`, fullPage: true});
  }
}
await page.setViewportSize({width:1440,height:1000});
console.log('PASS: all 8 language picker outputs, reset text/aria-labels, persistence, RTL and responsive store columns.');
if (process.argv.includes('--commerce')) {
  const submissions = [];
  let relayResult = {success: false};
  await page.route('https://formsubmit.co/**', async route => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(relayResult)});
  });
  await page.goto('http://127.0.0.1:8765/#store');
  const summary = page.locator('.store-faq summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('.store-faq details').first().evaluate(el => el.open));
  await page.locator('[data-commission-link]').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'commissionName');
  assert(page.url().endsWith('#contact'));
  await page.locator('#commissionSend').click();
  assert.equal(submissions.length, 0);
  await page.locator('#commissionName').fill('Test Creator');
  await page.locator('#commissionEmail').fill('not-an-email');
  await page.locator('#commissionType').selectOption('Map or scene');
  await page.locator('#commissionBudget').fill('500 USD');
  await page.locator('#commissionDeadline').fill('2027-01-15');
  await page.locator('#commissionBrief').fill('A custom Blender scene with lighting.');
  await page.locator('#commissionReferences').fill('https://example.com/one\nhttps://example.com/two');
  await page.locator('#commissionSend').click();
  assert.equal(submissions.length, 0);
  await page.locator('#commissionEmail').fill('creator@example.com');
  for (const lang of languages) {
    await page.evaluate(code => window.AlphaI18n.set(code), lang.code);
    assert.equal(await page.locator('#commissionBrief').inputValue(), 'A custom Blender scene with lighting.');
    const output = await page.evaluate(() => {
      const keys = [...document.querySelectorAll('[data-i18n]')].map(el => el.dataset.i18n).filter(key => /^(faq|commission)\./.test(key));
      return keys.map(key => [key, window.AlphaI18n.t(key)]);
    });
    assert(output.every(([key, value]) => value && value !== key));
    if (lang.code !== 'en') assert.notEqual(await page.locator('#commissionSend').textContent(), 'Send project request');
  }
  await page.locator('#commissionSend').click();
  await page.waitForFunction(() => document.querySelector('#commissionStatus').classList.contains('is-err'));
  assert.equal(await page.locator('#commissionBrief').inputValue(), 'A custom Blender scene with lighting.');
  assert.deepEqual(submissions[0], {
    name: 'Test Creator', email: 'creator@example.com', project_type: 'Map or scene', budget: '500 USD',
    deadline: '2027-01-15', brief: 'A custom Blender scene with lighting.',
    references: 'https://example.com/one\nhttps://example.com/two', page_language: 'ar',
    _subject: 'alphaff.gg - commission request', _template: 'table'
  });
  relayResult = {success: 'true'};
  await page.locator('#commissionSend').click();
  await page.waitForFunction(() => document.querySelector('#commissionStatus').classList.contains('is-ok'));
  assert.equal(submissions.length, 2);
  assert.equal(await page.locator('#commissionBrief').inputValue(), '');
  assert.equal(await page.locator('#commissionSend').isEnabled(), true);
  for (const code of ['en', 'ar']) {
    await page.evaluate(code => window.AlphaI18n.set(code), code);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: 900});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(await page.evaluate(() => ({width: innerWidth, lang: document.documentElement.lang, overflow: [...document.querySelectorAll('#panel-contact *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth); }).map(el => ({id: el.id, class: el.className, rect: el.getBoundingClientRect().toJSON()}))}))));
      assert(await page.locator('#commissionForm .fb-input').evaluateAll(fields => fields.every(el => {
        const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth;
      })));
      await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
      if (width !== 320) await page.screenshot({path: `review-contact-${code}-${width}.png`, fullPage: true});
    }
    await page.locator('#tab-store').click();
    await page.locator('.store-faq details').evaluateAll(items => items.forEach(el => { el.open = true; }));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.store-faq').screenshot({path: `review-faq-${code}-320.png`});
    await page.locator('#tab-contact').click();
  }
  console.log('PASS: FAQ keyboard controls, commission navigation, validation, translated fields, exact payload, relay rejection/success, retained input, mobile and RTL layouts. No real messages sent.');
}
if (process.argv.includes('--store-i18n') || process.argv.includes('--commerce')) {
  assert.deepEqual(errors, []);
  await browser.close();
  server.close();
  return;
}
await page.goto('http://127.0.0.1:8765/#home');
await page.waitForTimeout(700);
assert.equal(await page.locator('model-viewer').getAttribute('src'),null);
await page.screenshot({path:'review-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'review-mobile.png',fullPage:true});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.locator('#tab-models').click();
await page.locator('[data-id="beesto"]').click();
await page.waitForFunction(()=>document.querySelector('model-viewer').loaded,null,{timeout:60000});
assert(page.url().endsWith('#models/beesto'));
await page.reload();await page.waitForTimeout(900);
assert.equal(await page.locator('#captionName').textContent(),'Beesto');
assert.equal(await page.locator('#dlBlend').getAttribute('href'),'./models/beesto.blend');
console.log('Download layout',await page.locator('#dlGlb').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),opacity:getComputedStyle(el).opacity,visibility:getComputedStyle(el).visibility})));
await page.locator('#tab-store').click();await page.goBack();
assert.equal(await page.locator('#tab-models').getAttribute('aria-selected'),'true');
await page.locator('#menuBtn').click();await page.locator('#openSettings').click();await page.waitForTimeout(350);
await page.locator('#setDataSaver').focus();await page.keyboard.press('Tab');
assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsClose');
await page.keyboard.press('Escape');await page.waitForTimeout(300);
assert.equal(await page.evaluate(()=>document.activeElement.id),'menuBtn');
await page.locator('#tab-store').click();await page.locator('.store-image-button').first().focus();await page.keyboard.press('Enter');
assert(await page.locator('#storeLb').isVisible());await page.keyboard.press('Escape');
assert(await page.locator('.store-image-button').first().evaluate(el=>el===document.activeElement));
await page.route('**/store.json',r=>r.abort());await page.reload();await page.waitForTimeout(600);
assert(await page.locator('#storeRetry').isVisible());await page.unroute('**/store.json');await page.locator('#storeRetry').click();await page.waitForTimeout(500);
assert.equal(await page.locator('#storeStatus').textContent(),'');
await page.goto('http://127.0.0.1:8765/#models/alpha');await page.waitForTimeout(800);
assert.equal(await page.locator('.model-card img').evaluateAll(imgs=>imgs.filter(i=>i.complete && i.naturalWidth>0).length),JSON.parse(fs.readFileSync('models/models.json')).models.filter(m=>m.tier !== 'paid').length);
await page.screenshot({path:'review-models-mobile.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS: routes, thumbnails, keyboard dialogs, gallery, loading recovery, mobile width; no runtime errors.');
await page.evaluate(()=>localStorage.setItem('alpha.settings',JSON.stringify({dataSaver:true})));
await page.reload();await page.waitForTimeout(700);
assert.equal(await page.locator('model-viewer').getAttribute('src'),null);
await page.locator('#modelLoad').click();
await page.waitForFunction(()=>document.querySelector('model-viewer').loaded,null,{timeout:60000});
console.log('PASS: data saver waits for explicit load.');
await page.evaluate(()=>localStorage.removeItem('alpha.settings'));
const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
phone.on('pageerror',e=>errors.push(e.message));
await phone.goto('http://127.0.0.1:8765/#models/beesto');
await phone.waitForFunction(()=>document.querySelector('model-viewer').loaded,null,{timeout:60000});
await phone.locator('#mainModel').tap();
assert.equal(await phone.locator('#modelStage').evaluate(el=>el.classList.contains('expanded')),false);
for (const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:1440,height:900}]) {
  await phone.setViewportSize(size);
  await phone.locator('#expandBtn').click();
  await phone.waitForTimeout(200);
  assert(await phone.locator('#modelStage').evaluate(el=>el.parentElement===document.body));
  assert(await phone.locator('#closeBtn').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  await phone.locator('#resetBtn').click();
  await phone.locator('#closeBtn').click();
  assert.equal(await phone.locator('#modelStage').evaluate(el=>el.classList.contains('expanded')),false);
  assert.equal(await phone.evaluate(()=>document.activeElement.id),'expandBtn');
  assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
await phone.setViewportSize({width:390,height:844});
await phone.locator('#closeBtn').click();
assert(await phone.locator('.library-preview').isHidden());
assert.equal(await phone.locator('#mainModel').getAttribute('src'),null);
await phone.locator('[data-id="beesto"]').click();
assert(await phone.locator('.library-preview').isVisible());
await phone.locator('#closeBtn').click();
await phone.locator('#reopenViewer').click();
assert(await phone.locator('.library-preview').isVisible());
await phone.locator('#browseModels').click();
assert.equal(await phone.evaluate(()=>document.activeElement.id),'modelSearch');
await phone.locator('#modelSearch').fill('camy');await phone.locator('[data-id="camy"]').click();
assert.equal(await phone.locator('#captionName').textContent(),'Camy');
await phone.locator('#searchClear').click();
await phone.evaluate(()=>window.scrollTo(0,0));await phone.waitForTimeout(400);
await phone.screenshot({path:'review-models-mobile.png',fullPage:true});
await phone.locator('#expandBtn').click();await phone.waitForTimeout(300);
await phone.screenshot({path:'review-viewer-mobile.png'});
await phone.keyboard.press('Escape');
assert.deepEqual(errors,[]);
console.log('PASS: touch, visible fullscreen close/reset, focus return, close/reopen, search, and portrait/landscape/desktop layouts.');
await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
