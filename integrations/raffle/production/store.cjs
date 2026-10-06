const { DatabaseSync, backup } = require('node:sqlite');
const { createCipheriv,createDecipheriv,createHmac,randomBytes,randomInt,randomUUID,createHash }=require('node:crypto');
const digest=x=>createHash('sha256').update(x).digest('hex');
const fail=message=>{throw Error(message);};
function openStore(cfg,clock=Date.now) {
  const db=new DatabaseSync(cfg.file);
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='draws'").get() && !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").get()) {
    db.close(); fail('Use a separate production database; local dummy databases cannot be promoted.');
  }
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS draws (month TEXT PRIMARY KEY,state TEXT NOT NULL DEFAULT 'draft',closes INTEGER NOT NULL,rules TEXT NOT NULL,rules_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY,month TEXT NOT NULL REFERENCES draws(month),email_hash TEXT NOT NULL,email TEXT NOT NULL,verified INTEGER NOT NULL DEFAULT 0,token TEXT UNIQUE,expires INTEGER,consented INTEGER NOT NULL,rules_hash TEXT NOT NULL,UNIQUE(month,email_hash));
    CREATE TABLE IF NOT EXISTS codes (id INTEGER PRIMARY KEY,month TEXT NOT NULL REFERENCES draws(month),fingerprint TEXT UNIQUE NOT NULL,secret TEXT NOT NULL,entry INTEGER UNIQUE REFERENCES entries(id));
    CREATE TABLE IF NOT EXISTS mail (id TEXT PRIMARY KEY,entry INTEGER REFERENCES entries(id),kind TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL,expires INTEGER,first_attempt INTEGER,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,lease_until INTEGER,lease_token TEXT,provider_id TEXT,error TEXT,checked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY,at INTEGER NOT NULL,action TEXT NOT NULL,month TEXT,detail TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS suppressions (email_hash TEXT PRIMARY KEY,reason TEXT NOT NULL);
  `);
  const mac=x=>createHmac('sha256',cfg.key).update(x).digest('hex');
  const encrypt=value=>{
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',cfg.key,iv);
    const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');
  };
  const decrypt=value=>{
    const bytes=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',cfg.key,bytes.subarray(0,12));
    cipher.setAuthTag(bytes.subarray(12,28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8'));
  };
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try {const result=fn();db.exec('COMMIT');return result;} catch(error){db.exec('ROLLBACK');throw error;}};
  try { tx(()=>{
    const check=db.prepare("SELECT value FROM meta WHERE key='keycheck'").get();
    if(check && check.value!==mac('raffle-key-check-v1')) fail('Incorrect encryption key. Restore the original key.');
    db.prepare("INSERT OR IGNORE INTO meta VALUES ('keycheck',?)").run(mac('raffle-key-check-v1'));
  }); } catch(error) { db.close(); throw error; }
  const audit=(action,month,detail)=>db.prepare('INSERT INTO audit(at,action,month,detail) VALUES (?,?,?,?)').run(clock(),action,month,JSON.stringify(detail));
  const drawRow=month=>db.prepare('SELECT * FROM draws WHERE month=?').get(month) || fail('Unknown draw.');
  const emailOf=address=>{
    const email=String(address || '').trim().toLowerCase();
    if(email.length>254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) fail('Enter a valid email address.');
    return email;
  };
  const queue=(entry,kind,to,text,expires=null)=>{
    const id=randomUUID();
    const payload={from:cfg.sender,to:[to],subject:kind==='smoke' ? 'ALPHA raffle delivery test' : kind==='verification' ? 'Verify your ALPHA raffle entry' : 'Your ALPHA raffle reward',text};
    const suppressed=!!db.prepare('SELECT 1 FROM suppressions WHERE email_hash=?').get(mac('email:'+to));
    db.prepare('INSERT INTO mail(id,entry,kind,payload,created,expires,state,error) VALUES (?,?,?,?,?,?,?,?)').run(id,entry,kind,encrypt(payload),clock(),expires,suppressed?'review':'pending',suppressed?'recipient-suppressed':null);
  };
  const requireOpen=month=>{
    const draw=drawRow(month);
    if(!cfg.liveEnabled || draw.state!=='open' || clock()>=draw.closes) fail('Entries are closed.');
    return draw;
  };
  return {
    close:()=>db.close(),
    backup:target=>backup(db,target),
    queueSmoke(address) {
      const email=emailOf(address);
      if(cfg.mailMode!=='sandbox' || !cfg.allowlist.includes(email)) fail('A smoke test requires sandbox mode and an explicitly authorized test recipient.');
      return tx(()=>{queue(null,'smoke',email,'This is an authorized ALPHA raffle email delivery test. No entry was created and no reward code is included.');audit('smoke-test',null,{});});
    },
    configure(month,closes,rules) {
      const time=Date.parse(closes);
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(closes) || !Number.isFinite(time) || time<=clock() || typeof rules!=='string' || rules.trim().length<20 || rules.length>20000) fail('Supply a month, future closing timestamp with timezone and complete rules.');
      return tx(()=>{
        const existing=db.prepare('SELECT state FROM draws WHERE month=?').get(month);
        if(existing && existing.state!=='draft') fail('Rules and schedule are locked after opening.');
        db.prepare(`INSERT INTO draws(month,closes,rules,rules_hash) VALUES (?,?,?,?) ON CONFLICT(month) DO UPDATE SET closes=excluded.closes,rules=excluded.rules,rules_hash=excluded.rules_hash`).run(month,time,rules.trim(),digest(rules.trim()));
        audit('configure',month,{closes:time});
      });
    },
    importCodes(month,codes) {
      if(!Array.isArray(codes) || !codes.length || codes.length>10000 || codes.some(x=>typeof x!=='string' || !/^[A-Za-z0-9-]{4,128}$/.test(x) || /^(DUMMY|TEST|SAMPLE)-/i.test(x))) fail('Import 1–10000 real codes (letters, numbers, hyphens), without test inventory.');
      return tx(()=>{
        if(drawRow(month).state!=='draft') fail('Inventory is locked after opening.');
        for(const code of codes) db.prepare('INSERT INTO codes(month,fingerprint,secret) VALUES (?,?,?)').run(month,mac('code:'+code),encrypt(code));
        audit('import',month,{count:codes.length});
        return {imported:codes.length};
      });
    },
    open(month) {return tx(()=>{
      const draw=drawRow(month);
      if(!cfg.liveEnabled || !cfg.sender || !cfg.apiKey) fail('Live opening requires explicitly enabled live email configuration.');
      if(draw.state!=='draft' || draw.closes<=clock()) fail('Only a future draft can open.');
      if(db.prepare("SELECT 1 FROM draws WHERE state='open'").get()) fail('Close the current draw before opening another.');
      if(!db.prepare('SELECT 1 FROM codes WHERE month=?').get(month)) fail('Import inventory first.');
      db.prepare("UPDATE draws SET state='open' WHERE month=?").run(month);audit('open',month,{});
    });},
    status() {
      const draw=db.prepare("SELECT month,state,closes,rules,rules_hash FROM draws WHERE state!='draft' ORDER BY month DESC LIMIT 1").get();
      if(!draw) return null;
      return {...draw,state:draw.state==='open' && (!cfg.liveEnabled || clock()>=draw.closes) ? 'closed':draw.state,prizes:db.prepare('SELECT count(*) AS n FROM codes WHERE month=?').get(draw.month).n};
    },
    limit(identity,max,windowMs) {return tx(()=>{
      db.prepare('DELETE FROM limits WHERE until<=?').run(clock());
      const key=mac('rate:'+identity),record=db.prepare('SELECT * FROM limits WHERE key=?').get(key);
      if(record && record.count>=max) return false;
      db.prepare('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,clock()+windowMs);
      return true;
    });},
    enter(month,address,rulesHash,consent) {
      const email=emailOf(address);
      return tx(()=>{
        const draw=requireOpen(month);
        if(consent!==true || rulesHash!==draw.rules_hash) fail('Read and accept the current raffle rules.');
        const emailHash=mac('email:'+email);
        if(db.prepare('SELECT 1 FROM suppressions WHERE email_hash=?').get(emailHash)) return;
        const previous=db.prepare('SELECT * FROM entries WHERE month=? AND email_hash=?').get(month,emailHash);
        if(previous?.verified || previous?.expires>clock()) return;
        if(db.prepare('SELECT count(*) AS n FROM entries WHERE month=?').get(month).n>=10000 && !previous) fail('Entry capacity reached.');
        const token=randomBytes(32).toString('hex'),expires=Math.min(clock()+86400000,draw.closes);
        db.prepare(`INSERT INTO entries(month,email_hash,email,token,expires,consented,rules_hash) VALUES (?,?,?,?,?,?,?) ON CONFLICT(month,email_hash) DO UPDATE SET token=excluded.token,expires=excluded.expires,consented=excluded.consented,rules_hash=excluded.rules_hash`).run(month,emailHash,encrypt(email),digest(token),expires,clock(),rulesHash);
        const entry=db.prepare('SELECT id FROM entries WHERE month=? AND email_hash=?').get(month,emailHash);
        queue(entry.id,'verification',email,`Confirm your entry in the ${month} ALPHA draw:\n${cfg.origin}/#redeem?verify=${token}\n\nThis link expires at ${new Date(expires).toISOString()}. If you did not request it, ignore this message.`,expires);
      });
    },
    verify(token) {return tx(()=>{
      if(!/^[a-f0-9]{64}$/.test(String(token))) fail('Invalid or expired verification link.');
      const entry=db.prepare('SELECT * FROM entries WHERE token=?').get(digest(token));
      if(!entry || clock()>=entry.expires) fail('Invalid or expired verification link.');
      requireOpen(entry.month);
      db.prepare('UPDATE entries SET verified=1,token=NULL,expires=NULL WHERE id=?').run(entry.id);
      return entry.month;
    });},
    draw(month) {return tx(()=>{
      const draw=drawRow(month);
      const count=()=>db.prepare('SELECT count(*) AS n FROM codes WHERE month=? AND entry IS NOT NULL').get(month).n;
      if(draw.state==='drawn') return {winners:count(),alreadyDrawn:true};
      if(draw.state!=='open' || clock()<draw.closes) fail('Wait until the configured entry closing time.');
      const codes=db.prepare('SELECT * FROM codes WHERE month=?').all(month);
      const entries=db.prepare('SELECT * FROM entries WHERE month=? AND verified=1 ORDER BY id').all(month);
      for(let i=0;i<Math.min(codes.length,entries.length);i++) {
        const j=randomInt(i,entries.length);[entries[i],entries[j]]=[entries[j],entries[i]];
        db.prepare('UPDATE codes SET entry=? WHERE id=?').run(entries[i].id,codes[i].id);
        queue(entries[i].id,'winner',decrypt(entries[i].email),`You won the ${month} ALPHA reward draw.\n\nYour unique reward code: ${decrypt(codes[i].secret)}\n\nPlease follow the redemption instructions in the raffle rules.`);
      }
      db.prepare("UPDATE draws SET state='drawn' WHERE month=?").run(month);
      audit('draw',month,{winners:count()});return {winners:count(),alreadyDrawn:false};
    });},
    claimMail() {return tx(()=>{
      db.prepare("UPDATE mail SET state='review',error='recipient-suppressed',lease_token=NULL WHERE state='pending' AND entry IN (SELECT entries.id FROM entries JOIN suppressions USING(email_hash))").run();
      db.prepare("UPDATE mail SET state='expired',lease_token=NULL WHERE state IN ('pending','sending') AND expires<=?").run(clock());
      // Resend keeps idempotency keys for 24h. Never auto-retry an ambiguous send beyond that window.
      db.prepare("UPDATE mail SET state='review',error='retry-window-expired',lease_token=NULL WHERE state IN ('pending','sending') AND first_attempt<=?").run(clock()-23*3600000);
      const row=db.prepare("SELECT * FROM mail WHERE (state='pending' AND next_attempt<=?) OR (state='sending' AND lease_until<=?) ORDER BY created,id LIMIT 1").get(clock(),clock());
      if(!row) return null;
      const lease=randomUUID();
      db.prepare("UPDATE mail SET state='sending',lease_until=?,lease_token=?,attempts=attempts+1,first_attempt=coalesce(first_attempt,?) WHERE id=?").run(clock()+120000,lease,clock(),row.id);
      return {...row,lease,attempts:row.attempts+1,payload:decrypt(row.payload)};
    });},
    finishMail(row,result) {
      if(result.id) db.prepare("UPDATE mail SET state='accepted',provider_id=?,lease_token=NULL,error=NULL WHERE id=? AND lease_token=?").run(result.id,row.id,row.lease);
      else db.prepare("UPDATE mail SET state=?,next_attempt=?,error=?,lease_token=NULL WHERE id=? AND lease_token=?").run(result.retry && row.attempts<8 ? 'pending':'review',clock()+Math.min(3600000,30000*2**row.attempts),result.error,row.id,row.lease);
    },
    deliveryRows:()=>db.prepare("SELECT id,provider_id FROM mail WHERE state IN ('accepted','delivered') AND created>? ORDER BY checked,id LIMIT 100").all(clock()-7*86400000),
    recordDelivery(id,event) {return tx(()=>{
      db.prepare('UPDATE mail SET checked=? WHERE id=?').run(clock(),id);
      if(['delivered','bounced','complained','failed'].includes(event)) db.prepare("UPDATE mail SET state=? WHERE id=? AND state IN ('accepted','delivered')").run(event,id);
      if(['bounced','complained'].includes(event)) {
        const entry=db.prepare('SELECT entries.email_hash FROM entries JOIN mail ON mail.entry=entries.id WHERE mail.id=?').get(id);
        if(entry) db.prepare('INSERT OR IGNORE INTO suppressions VALUES (?,?)').run(entry.email_hash,event);
      }
    });},
    summary:()=>({draws:db.prepare('SELECT month,state,closes FROM draws').all(),mail:db.prepare('SELECT state,count(*) AS count FROM mail GROUP BY state').all(),audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 20').all()}),
  };
}
module.exports={openStore};
