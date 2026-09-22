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
assert.equal(await page.locator('.model-card img').evaluateAll(imgs=>imgs.filter(i=>i.complete && i.naturalWidth>0).length),16);
await page.screenshot({path:'review-models-mobile.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS: routes, thumbnails, keyboard dialogs, gallery, loading recovery, mobile width; no runtime errors.');
await page.evaluate(()=>localStorage.setItem('alpha.settings',JSON.stringify({dataSaver:true})));
await page.reload();await page.waitForTimeout(700);
assert.equal(await page.locator('model-viewer').getAttribute('src'),null);
await page.locator('#modelLoad').click();
await page.waitForFunction(()=>document.querySelector('model-viewer').loaded,null,{timeout:60000});
console.log('PASS: data saver waits for explicit load.');
await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
