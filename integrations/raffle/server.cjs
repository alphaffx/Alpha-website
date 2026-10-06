const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { openRaffle } = require('./service.cjs');
const root = path.resolve(__dirname,'../..');

function databasePath() {
  const file = path.resolve(process.env.RAFFLE_DB || path.join(os.homedir(),'.alpha-raffle-local','raffle.sqlite'));
  const relative = path.relative(root,file);
  if (!relative.startsWith('..'+path.sep) && !path.isAbsolute(relative)) throw Error('Store the raffle database outside the public website directory.');
  fs.mkdirSync(path.dirname(file),{ recursive:true });
  return file;
}
function createServer(service) {
  const limits = new Map();
  return http.createServer(async (req,res) => {
    const origin = `http://127.0.0.1:${req.socket.localPort}`;
    const json = (status,value) => { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); };
    if (req.headers.host !== new URL(origin).host) return json(403,{error:'Local host required.'});
    const url = new URL(req.url,origin);
    if (url.pathname.startsWith('/api/raffle/')) {
      if (req.method === 'GET' && url.pathname === '/api/raffle/status') return json(200,{ mode:'local-test', draw:service.status() });
      if (req.method !== 'POST' || !['/api/raffle/enter','/api/raffle/verify'].includes(url.pathname)) return json(404,{error:'Not found.'});
      if (req.headers.origin !== origin || !req.headers['content-type']?.startsWith('application/json')) return json(403,{error:'Same-origin JSON required.'});
      const now = Date.now();
      const key = req.socket.remoteAddress;
      const bucket = limits.get(key);
      if (!bucket || bucket.until < now) limits.set(key,{until:now+60000,count:0});
      if (++limits.get(key).count > 30) return json(429,{error:'Too many requests. Wait a minute and try again.'});
      try {
        let body = '';
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body)>2048) { json(413,{error:'Request too large.'}); return; } }
        const data = JSON.parse(body);
        if (url.pathname.endsWith('/enter')) { service.enter(data.month,data.email,origin); return json(200,{message:'Verification saved to the local test outbox. No email was sent.'}); }
        const month = service.verify(data.token);
        return json(200,{message:`Email verified. You are entered in the ${month} test draw.`});
      } catch (error) { return json(400,{error: error.code?.startsWith('ERR_SQLITE') ? 'Unable to process request.' : error.message}); }
    }
    if (!['GET','HEAD'].includes(req.method)) return json(405,{error:'Method not allowed.'});
    // Explicit public asset allowlist: never serve backend, databases, Git or local outbox files.
    const asset = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const allowedRoot = /^(index\.html|app\.js|forms\.js|raffle\.js|i18n\.js|model-search\.js|style\.css|components\.css|store\.json|lessons\.json|alpha-logo\.svg|favicon\.(svg|ico)|apple-touch-icon\.png)$/;
    if (!allowedRoot.test(asset) && !/^(media|assets|models|presets)\/[a-zA-Z0-9 _./@-]+\.(webp|jpg|png|svg|glb|json|woff2)$/.test(asset)) return json(404,{error:'Not found.'});
    const file = path.resolve(root,asset);
    if (!file.startsWith(root+path.sep)) return json(404,{error:'Not found.'});
    fs.readFile(file,(error,data) => {
      if (error) return json(404,{error:'Not found.'});
      const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'};
      res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}
if (require.main === module) {
  const service = openRaffle(databasePath());
  createServer(service).listen(8787,'127.0.0.1',() => console.log('Local test only: http://127.0.0.1:8787/#redeem — no outgoing email.'));
}
module.exports = { createServer, databasePath };
