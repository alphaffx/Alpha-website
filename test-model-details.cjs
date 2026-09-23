const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { inspectGlb } = require('./generate-model-details.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || path.join(require('os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
// Add a real translation animation to a copy of the model, served only in this test.
const original = fs.readFileSync('models/alpha.glb');
const jsonLength = original.readUInt32LE(12);
const gltf = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
const oldBin = original.subarray(28 + jsonLength);
const offset = Math.ceil(oldBin.length / 4) * 4;
const bin = Buffer.alloc(offset + 32); oldBin.copy(bin);
[0, 1, 0, 0, 0, 0, 0.25, 0].forEach((n, i) => bin.writeFloatLE(n, offset + i * 4));
const viewIndex = gltf.bufferViews.length, accessorIndex = gltf.accessors.length;
gltf.bufferViews.push({buffer:0, byteOffset:offset, byteLength:8}, {buffer:0, byteOffset:offset+8, byteLength:24});
gltf.accessors.push({bufferView:viewIndex, componentType:5126, count:2, type:'SCALAR', min:[0], max:[1]}, {bufferView:viewIndex+1, componentType:5126, count:2, type:'VEC3'});
gltf.animations = ['Rise', 'Float'].map(name => ({name, samplers:[{input:accessorIndex, output:accessorIndex+1}], channels:[{sampler:0,target:{node:0,path:'translation'}}]}));
gltf.buffers[0].byteLength=bin.length;
const json=Buffer.from(JSON.stringify(gltf)); const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32); json.copy(padded);
const animated=Buffer.alloc(28+padded.length+bin.length); animated.write('glTF'); animated.writeUInt32LE(2,4); animated.writeUInt32LE(animated.length,8); animated.writeUInt32LE(padded.length,12); animated.writeUInt32LE(0x4e4f534a,16); padded.copy(animated,20); animated.writeUInt32LE(bin.length,20+padded.length); animated.writeUInt32LE(0x004e4942,24+padded.length); bin.copy(animated,28+padded.length);
assert.deepEqual(inspectGlb(animated).animations,['Rise','Float']);
assert.throws(()=>inspectGlb(Buffer.from('partial')));
const catalog=JSON.parse(fs.readFileSync('models/models.json'));
catalog.models[0].glbDetails=inspectGlb(animated);
catalog.models[0].blenderCompatibility='4.5 — tested';
delete catalog.models.find(m=>m.id==='camy').glbDetails;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 const url=decodeURIComponent(req.url.split('?')[0]);
 if(url==='/models/alpha.glb'){res.writeHead(200,{'Content-Type':types['.glb']});return res.end(animated);}
 if(url==='/models/models.json'){res.writeHead(200,{'Content-Type':types['.json']});return res.end(JSON.stringify(catalog));}
 const file=path.join(__dirname,url==='/'?'index.html':url);
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/#models/alpha`);
 await page.waitForFunction(()=>!document.getElementById('animationControls').hidden,null,{timeout:60000});
 assert.match(await page.locator('#modelDetails').textContent(),/4.5 — tested/);
 assert.equal(await page.locator('#animationClip option').count(),2);
 assert.equal(await page.locator('#mainModel').evaluate(v=>v.paused),true);
 await page.locator('#animationToggle').click();
 assert.equal(await page.locator('#mainModel').evaluate(v=>v.paused),false);
 await page.locator('#animationClip').selectOption('Float');
 assert.equal(await page.locator('#mainModel').evaluate(v=>v.animationName),'Float');
 assert.equal(await page.locator('#mainModel').evaluate(v=>v.paused),true);
 for(const code of ['en','fr','pt','es','id','th','vi','ar']){
 await page.evaluate(code=>window.AlphaI18n.set(code),code);
 assert(!/details\./.test(await page.locator('.model-details').textContent()));
 for(const width of [1440,390,320]){
 await page.setViewportSize({width,height:1000});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${code} ${width} overflow`);
 }
 }
 await page.evaluate(()=>window.AlphaI18n.set('en'));
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'review-model-details-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'review-model-details-mobile.png',fullPage:true});
 await page.locator('.model-card[data-id="beesto"]').click();
 await page.waitForFunction(()=>document.getElementById('captionName').textContent==='Beesto');
 assert.equal(await page.locator('#animationControls').isVisible(),false);
 assert.match(await page.locator('#modelDetails').textContent(),/Not verified/);
 assert.match(await page.locator('#modelDetails').textContent(),/7 embedded/);
 await page.locator('.model-card[data-id="camy"]').click();
 assert.match(await page.locator('#modelDetails').textContent(),/Not specified/);
 assert.deepEqual(errors,[]);
 console.log('PASS: GLB extraction, real animation playback and switching, metadata fallback, all 8 languages, mobile and RTL layouts.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
