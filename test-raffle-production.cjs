const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {DatabaseSync}=require('node:sqlite');
const {config,privatePath}=require('./integrations/raffle/production/config.cjs');
const {openStore}=require('./integrations/raffle/production/store.cjs');
const {createServer}=require('./integrations/raffle/production/server.cjs');
const {sendNext,refreshDelivery}=require('./integrations/raffle/production/mail.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'alpha-production-test-'));
const cfg={file:path.join(dir,'production.sqlite'),key:randomBytes(32),origin:'https://alphaff.gg',sender:'raffle@example.test',apiKey:'mock-only',mailMode:'live',liveEnabled:true,allowlist:[]};
let now=Date.parse('2027-01-01T00:00:00Z'),store,db,server;
const rules='Test fixture rules only. One verified email per monthly draw. No real prizes or messages.';
const sent=[];
const provider=async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(options.headers.Authorization,'Bearer mock-only');
  const payload=JSON.parse(options.body);sent.push({key:options.headers['Idempotency-Key'],payload});
  return new Response(JSON.stringify({id:'provider-'+sent.length}),{status:200});
};
const verifyToken=message=>message.payload.text.match(/verify=([a-f0-9]{64})/)[1];
async function parallelDraw() {
  return Promise.all([0,1,2].map(()=>new Promise((resolve,reject)=>{
    const worker=new Worker(`const {workerData,parentPort}=require('node:worker_threads');const {openStore}=require(workerData.module);const store=openStore({...workerData.cfg,key:Buffer.from(workerData.key,'hex')},()=>workerData.now);try{parentPort.postMessage(store.draw('2027-01'));}finally{store.close();}`,{eval:true,workerData:{module:path.join(__dirname,'integrations/raffle/production/store.cjs'),cfg:{...cfg,key:undefined},key:cfg.key.toString('hex'),now}});
    worker.on('message',resolve);worker.on('error',reject);
  })));
}
(async()=>{
  try {
    assert.throws(()=>config({}));
    assert.throws(()=>privatePath(path.join(__dirname,'private.sqlite')));
    assert.throws(()=>config({RAFFLE_DB:cfg.file,RAFFLE_ENCRYPTION_KEY:cfg.key.toString('hex'),RAFFLE_MAIL_MODE:'sandbox'}));
    const disabled=config({RAFFLE_DB:cfg.file,RAFFLE_ENCRYPTION_KEY:cfg.key.toString('hex')});
    assert.equal(disabled.liveEnabled,false);
    store=openStore(cfg,()=>now);
    assert.equal(store.status(),null);
    assert.throws(()=>store.configure('2027-01','2027-01-03T00:00:00',rules));
    store.configure('2027-01','2027-01-03T00:00:00Z',rules);
    assert.throws(()=>store.open('2027-01'));
    assert.throws(()=>store.importCodes('2027-01',['DUMMY-CODE']));
    store.importCodes('2027-01',['FIXTURE-JAN-0001','FIXTURE-JAN-0002']);
    assert.throws(()=>store.importCodes('2027-01',['FIXTURE-ROLLBACK','FIXTURE-JAN-0001']));
    assert.equal(store.status(),null); // Draft inventory must not become public.
    const closed=openStore({...cfg,liveEnabled:false},()=>now);
    assert.throws(()=>closed.open('2027-01'));closed.close();
    store.open('2027-01');
    assert.equal(store.status().prizes,2);
    assert.throws(()=>store.configure('2027-01','2027-01-04T00:00:00Z',rules));
    assert.throws(()=>store.importCodes('2027-01',['FIXTURE-LATE']));
    assert.throws(()=>store.draw('2027-01'));
    assert.throws(()=>store.enter('2027-01','person@example.test','wrong',true));
    assert.throws(()=>store.enter('2027-01','person@example.test',store.status().rules_hash,false));
    for(let i=0;i<5;i++) {
      store.enter('2027-01',`person${i}@example.test`,store.status().rules_hash,true);
      assert.equal((await sendNext(store,cfg,provider)).state,'accepted');
      if(i<4) store.verify(verifyToken(sent.at(-1)));
    }
    store.enter('2027-01',' PERSON0@EXAMPLE.TEST ',store.status().rules_hash,true);
    assert.equal((await sendNext(store,cfg,provider)).state,'empty');
    assert.throws(()=>store.verify(verifyToken(sent[0])));
    const blocked=await sendNext(store,{...cfg,mailMode:'disabled'},()=>{throw Error('must not call provider');});
    assert.equal(blocked.state,'disabled');
    // Verify server CORS, consent enforcement, no admin endpoint, and persistent limits.
    server=createServer(store,cfg);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${server.address().port}`;
    const post=(body,site=cfg.origin)=>fetch(origin+'/api/raffle/enter',{method:'POST',headers:{Origin:site,'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await post({},'https://evil.test')).status,403);
    assert.equal((await fetch(origin+'/api/raffle/admin')).status,404);
    const statusResponse=await fetch(origin+'/api/raffle/status',{headers:{Origin:cfg.origin}});
    assert.equal(statusResponse.headers.get('access-control-allow-origin'),cfg.origin);
    assert(!(await statusResponse.text()).includes('FIXTURE'));
    assert.equal((await post({month:'2027-01',email:'api@example.test'})).status,400);
    assert.equal((await post({month:'2027-01',email:'api@example.test',rulesHash:store.status().rules_hash,consent:true})).status,200);
    // Sandbox refuses visitors, does not rewrite recipients or expose their codes.
    assert.equal((await sendNext(store,{...cfg,mailMode:'sandbox',allowlist:['owner@example.test']},provider)).state,'review');
    assert.equal(sent.length,5);
    // Retry reuses the exact payload and provider idempotency key after a network ambiguity.
    store.enter('2027-01','retry@example.test',store.status().rules_hash,true);
    let attempted;
    assert.equal((await sendNext(store,cfg,async(url,options)=>{attempted=options;throw Error('network');})).state,'retry');
    now+=120000;
    assert.equal((await sendNext(store,cfg,provider)).state,'accepted');
    assert.equal(sent.at(-1).key,attempted.headers['Idempotency-Key']);
    assert.equal(JSON.stringify(sent.at(-1).payload),attempted.body);
    // Concurrent sender claims cannot take the same job; expired leases keep the ID.
    store.enter('2027-01','lease@example.test',store.status().rules_hash,true);
    const lease=store.claimMail();assert(lease);
    const second=openStore(cfg,()=>now);assert.equal(second.claimMail(),null);
    now+=121000;const recovered=second.claimMail();assert.equal(recovered.id,lease.id);
    store.finishMail(lease,{id:'stale-worker'}); // stale owner cannot acknowledge recovered lease
    second.finishMail(recovered,{id:'recovered-worker'});second.close();
    now=Date.parse('2027-01-03T00:00:00Z');
    assert.equal(store.status().state,'closed');
    assert.throws(()=>store.verify(verifyToken(sent[4])));
    assert.throws(()=>store.enter('2027-01','late@example.test',store.status().rules_hash,true));
    const results=await parallelDraw();assert.equal(results.filter(x=>!x.alreadyDrawn).length,1);
    assert(results.every(x=>x.winners===2));
    // Outbox and inventory remain private at rest, including verification links.
    db=new DatabaseSync(cfg.file);
    assert.equal(db.prepare('SELECT count(*) AS n FROM codes WHERE entry IS NOT NULL').get().n,2);
    assert.equal(db.prepare("SELECT count(*) AS n FROM mail WHERE kind='winner'").get().n,2);
    for(const table of ['codes','entries','mail']) {
      const raw=JSON.stringify(db.prepare('SELECT * FROM '+table).all());
      assert(!raw.includes('FIXTURE-JAN'));assert(!raw.includes('@example.test'));assert(!raw.includes('#redeem?'));
    }
    await sendNext(store,cfg,provider);await sendNext(store,cfg,provider);
    const winnerMail=sent.filter(x=>x.payload.subject==='Your ALPHA raffle reward');
    assert.equal(winnerMail.length,2);
    assert.equal(new Set(winnerMail.map(x=>x.payload.to[0])).size,2);
    assert(winnerMail.every(x=>!x.payload.to.includes('person4@example.test')));
    await refreshDelivery(store,cfg,async()=>new Response(JSON.stringify({last_event:'delivered'})));
    assert(store.summary().mail.some(x=>x.state==='delivered'));
    // Manual review rather than duplicate send outside the provider's 24-hour window.
    db.prepare("UPDATE mail SET state='pending',first_attempt=?,next_attempt=0 WHERE kind='winner'").run(now-24*3600000);
    assert.equal(store.claimMail(),null);
    assert.equal(db.prepare("SELECT count(*) AS n FROM mail WHERE kind='winner' AND state='review'").get().n,2);
    await store.backup(path.join(dir,'backup.sqlite'));
    const restored=openStore({...cfg,file:path.join(dir,'backup.sqlite')},()=>now);
    assert.equal(restored.draw('2027-01').alreadyDrawn,true);restored.close();
    assert.throws(()=>openStore({...cfg,key:randomBytes(32)},()=>now));
    store.close();store=openStore(cfg,()=>now);
    assert.equal(store.draw('2027-01').winners,2);
    const sandboxCfg={...cfg,file:path.join(dir,'smoke.sqlite'),mailMode:'sandbox',liveEnabled:false,allowlist:['owner@example.test']};
    const sandboxStore=openStore(sandboxCfg,()=>now);
    try {
      assert.throws(()=>sandboxStore.queueSmoke('visitor@example.test'));
      sandboxStore.queueSmoke('owner@example.test');
      assert.equal((await sendNext(sandboxStore,sandboxCfg,async()=>new Response('{}',{status:422}))).state,'retry-or-review');
      assert(sandboxStore.summary().mail.some(x=>x.state==='review'));
      sandboxStore.queueSmoke('owner@example.test');
      assert.equal((await sendNext(sandboxStore,sandboxCfg,provider)).state,'accepted');
      assert.equal(sent.at(-1).payload.subject,'ALPHA raffle delivery test');
    } finally {sandboxStore.close();}
    console.log('PASS: closed-by-default production config, private import, encrypted inventory/email/outbox, immutable rules/consent, closing time, three concurrent draws, durable mail leases/retries/idempotency, disabled and allowlisted delivery, provider status, backup/restore, wrong-key refusal, CORS and private-route isolation. Provider calls mocked; no email sent.');
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    if(db)db.close();if(store)store.close();fs.rmSync(dir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
