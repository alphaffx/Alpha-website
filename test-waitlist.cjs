const playwrightPath = process.env.PLAYWRIGHT_PATH || require('path').join(require('os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let playwright; try { playwright = require('playwright'); } catch { playwright = require(playwrightPath); }
const {chromium}=playwright;
const fs=require('fs'), http=require('http'), path=require('path');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{const p=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));fs.readFile(p,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{
await new Promise(r=>server.listen(8767,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8767');

const assert=require('assert/strict');
// Only load the external lesson player after the visitor chooses to watch.
assert.equal(await page.locator('#lessonPlayer iframe').count(),0);
await page.route('https://drive.google.com/**', route => route.fulfill({contentType:'text/html',body:'<p>Lesson player fixture</p>'}));
await page.locator('#lessonPlay').click();
assert.equal(await page.locator('#lessonPlayer iframe').getAttribute('src'),'https://drive.google.com/file/d/1BtJ35x-4DNayGUEknefIqGbw0RaZ34ut/preview');
assert(await page.locator('#lessonPlayer iframe').getAttribute('title'));
assert.equal(await page.locator('.lesson-card a').getAttribute('target'),'_blank');
const requests=[];let result={success:false};let httpStatus=200;
await page.route('https://formsubmit.co/**',async route=>{
 requests.push(route.request().postDataJSON());
 await route.fulfill({status:httpStatus,contentType:'application/json',body:JSON.stringify(result)});
});
await page.locator('#learnSend').click();assert.equal(requests.length,0);
await page.locator('#learnEmail').fill('test@example.com');
await page.locator('#learnSend').click();assert.equal(requests.length,0);
await page.locator('#learnForm').evaluate(form=>form.dataset.webhook='https://script.google.com/macros/s/test-fixture/exec');
await page.locator('#learnForm [name=consent]').check();
await page.locator('#learnSend').click();
await page.waitForFunction(()=>document.getElementById('learnStatus').classList.contains('is-err'));
assert.equal(await page.locator('#learnEmail').inputValue(),'test@example.com');
assert.equal(requests[0]._subject,'alphaff.gg - class waitlist');
assert.equal(requests[0]._webhook,'https://script.google.com/macros/s/test-fixture/exec');
await page.locator('#learnForm').evaluate(form=>delete form.dataset.webhook);
assert.match(requests[0].consent,/class launch/);
assert(requests[0].consent_at);
httpStatus=500;
await page.locator('#learnSend').click();
await page.waitForFunction(()=>!document.getElementById('learnSend').disabled);
assert.equal(await page.locator('#learnEmail').inputValue(),'test@example.com');
httpStatus=200;result={success:'true'};
await page.locator('#learnSend').click();
await page.waitForFunction(()=>document.getElementById('learnStatus').classList.contains('is-ok'));
assert.equal(await page.locator('#learnEmail').inputValue(),'');
assert.equal(await page.locator('#learnForm [name=consent]').isChecked(),false);
const count=requests.length;
await page.locator('#learnEmail').fill('bot@example.com');
await page.locator('#learnForm [name=consent]').check();
await page.locator('#learnForm [name=_honey]').evaluate(el=>el.value='spam');
await page.locator('#learnSend').click();assert.equal(requests.length,count);
await page.locator('#learnForm').evaluate(form=>form.reset());
for(const lang of ['en','fr','pt','es','id','th','vi','ar']){
 await page.evaluate(code=>window.AlphaI18n.set(code),lang);
 assert(!/learn\./.test(await page.locator('.learn-section').textContent()));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),lang+' '+width);
  if(['en','ar'].includes(lang)&&width!==320) await page.locator('.learn-section').screenshot({path:'review-learn-'+lang+'-'+width+'.png'});
 }
}
await page.locator('#tab-store').click();
await page.locator('[data-learn-link]').click();
assert.equal(await page.evaluate(()=>document.activeElement.id),'learnEmail');
assert(await page.locator('#panel-home').isVisible());
assert.deepEqual(errors,[]);
console.log('PASS: waitlist validation, consent, rejected/failed/successful submissions, honeypot, store link focus, 8 languages and responsive layouts. No real emails sent.');
await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
