const {config}=require('./config.cjs');
const {openStore}=require('./store.cjs');
const {sendNext,refreshDelivery}=require('./mail.cjs');
async function main() {
  const cfg=config(),store=openStore(cfg);
  let stopping=false;
  for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{stopping=true;});
  try {
    if(cfg.mailMode==='disabled') {console.log('Mail disabled. No provider requests made.');return;}
    if(process.argv.includes('--delivery-status')) {await refreshDelivery(store,cfg);return;}
    let nextStatusCheck=0;
    do {
      const result=await sendNext(store,cfg);console.log(result.state);
      if(!process.argv.includes('--loop')) break;
      if(Date.now()>=nextStatusCheck) {await refreshDelivery(store,cfg);nextStatusCheck=Date.now()+60000;}
      await new Promise(resolve=>setTimeout(resolve,result.state==='empty'?10000:1000));
    } while(!stopping);
  } finally {store.close();}
}
main().catch(()=>{console.error('Mail worker stopped. Check private configuration and provider status.');process.exitCode=1;});
