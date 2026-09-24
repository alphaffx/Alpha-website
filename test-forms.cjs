const playwrightPath = process.env.PLAYWRIGHT_PATH || require('path').join(require('os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let playwright; try { playwright = require('playwright'); } catch { playwright = require(playwrightPath); }
const {chromium}=playwright;
const fs=require('fs'), http=require('http'), path=require('path');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{const p=path.join(process.cwd(),decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));fs.readFile(p,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{
await new Promise(r=>server.listen(8768,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8768');

const assert=require('assert/strict');
await page.evaluate(()=>{
 window.formAttempts=0; window.formMode='hang';
 const originalFetch=window.fetch.bind(window);
 const originalTimer=window.setTimeout.bind(window);
 window.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms===20000?100:ms,...args);
 window.fetch=(url,options)=>{
  if(!String(url).startsWith('https://formsubmit.co/')) return originalFetch(url,options);
  window.formAttempts++;
  window.lastPayload=JSON.parse(options.body);
  if(window.formMode==='hang')return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError')),{once:true}));
  if(window.formMode==='invalid')return Promise.resolve(new Response('bad json',{status:200}));
  return Promise.resolve(new Response(JSON.stringify({success:window.formMode==='success'}),{status:window.formMode==='http'?503:200}));
 };
});
await page.locator('#tab-contact').click();
await page.locator('#fbMsg').fill('   ');
await page.locator('#fbSend').click();
assert.equal(await page.evaluate(()=>window.formAttempts),0);
await page.locator('#fbMsg').fill('Keep this feedback');
await page.evaluate(()=>{const f=document.getElementById('fbForm');f.requestSubmit();f.requestSubmit();});
await page.waitForFunction(()=>document.getElementById('fbStatus').classList.contains('is-err'));
assert.equal(await page.evaluate(()=>window.formAttempts),1);
assert.equal(await page.locator('#fbMsg').inputValue(),'Keep this feedback');
assert.equal(await page.locator('#fbSend').isDisabled(),false);
assert.equal(await page.locator('#fbForm').getAttribute('aria-busy'),null);
await page.evaluate(()=>window.AlphaI18n.set('ar'));
assert.equal(await page.locator('#fbStatus').textContent(),await page.evaluate(()=>window.AlphaI18n.t('contact.fbErr')));
for(const mode of ['invalid','http','rejected']){
 await page.evaluate(mode=>window.formMode=mode,mode);
 await page.locator('#fbSend').click();
 await page.waitForFunction(()=>!document.getElementById('fbSend').disabled);
 assert.equal(await page.locator('#fbMsg').inputValue(),'Keep this feedback');
 assert(await page.locator('#fbStatus').evaluate(el=>el.classList.contains('is-err')));
}
await page.evaluate(()=>window.formMode='success');
await page.locator('#fbSend').click();
await page.waitForFunction(()=>document.getElementById('fbStatus').classList.contains('is-ok'));
assert.equal(await page.locator('#fbMsg').inputValue(),'');
assert.equal(await page.evaluate(()=>window.lastPayload._subject),'alphaff.gg - site feedback');
assert.deepEqual(errors,[]);
console.log('PASS: timeout releases form, preserves input, prevents concurrent sends, handles invalid JSON/HTTP/rejection, translates status and resets only on success. No email sent.');
await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
