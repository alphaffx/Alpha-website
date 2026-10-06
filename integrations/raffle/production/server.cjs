const http=require('node:http');
const {config}=require('./config.cjs');
const {openStore}=require('./store.cjs');
function createServer(store,cfg) {
  const server=http.createServer(async(req,res)=>{
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
    if(req.headers.origin===cfg.origin) headers['Access-Control-Allow-Origin']=cfg.origin;
    const json=(status,data)=>{res.writeHead(status,headers);res.end(JSON.stringify(data));};
    const pathname=new URL(req.url,'http://internal').pathname;
    if(req.method==='GET' && pathname==='/healthz') return json(200,{ok:true});
    if(req.method==='GET' && pathname==='/api/raffle/status') return json(200,{mode:'production',draw:store.status()});
    if(!['/api/raffle/enter','/api/raffle/verify'].includes(pathname)) return json(404,{error:'Not found.'});
    if(req.headers.origin!==cfg.origin) return json(403,{error:'Origin not allowed.'});
    if(req.method==='OPTIONS') {res.writeHead(204,{...headers,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});return res.end();}
    if(req.method!=='POST') return json(405,{error:'Method not allowed.'});
    if(req.headers['content-type']?.split(';')[0]!=='application/json') return json(415,{error:'JSON required.'});
    try {
      // Deliberately do not trust arbitrary X-Forwarded-For headers. Behind a proxy this
      // conservative limit is shared; configure per-client limits at the trusted edge.
      if(!store.limit('ip:'+req.socket.remoteAddress,100,60000)) return json(429,{error:'Please wait before trying again.'});
      let body='';
      for await(const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>4096)return json(413,{error:'Request too large.'});}
      const data=JSON.parse(body);
      if(!data || typeof data!=='object') return json(400,{error:'Invalid request.'});
      if(pathname.endsWith('/enter')) {
        if(!store.limit('email:'+String(data.email || '').trim().toLowerCase(),5,86400000)) return json(429,{error:'Please try again tomorrow.'});
        store.enter(data.month,data.email,data.rulesHash,data.consent);
        return json(200,{message:'If this address needs verification, a link has been queued. Check your inbox and spam folder shortly.'});
      }
      const month=store.verify(data.token);
      return json(200,{message:`Email verified. You are entered in the ${month} draw.`});
    } catch(error) {
      if(error.code?.startsWith('ERR_SQLITE')) return json(503,{error:'Temporarily unavailable. Please try again.'});
      return json(400,{error:error instanceof SyntaxError ? 'Invalid JSON.' : error.message});
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return server;
}
if(require.main===module) {
  try {
    const cfg=config(),store=openStore(cfg),server=createServer(store,cfg);
    server.listen(cfg.port,'0.0.0.0',()=>console.log('Raffle API listening; delivery runs only through the separate mail worker.'));
    for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
module.exports={createServer};
