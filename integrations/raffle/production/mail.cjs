// Adapter chosen for preparation, not an assertion that a Resend account is connected.
// All network calls are injected in tests. API acceptance is not inbox delivery.
async function sendNext(store,cfg,request=fetch) {
  if(cfg.mailMode==='disabled') return {state:'disabled'};
  const row=store.claimMail();
  if(!row) return {state:'empty'};
  if(cfg.mailMode==='sandbox' && !row.payload.to.every(email=>cfg.allowlist.includes(email))) {
    store.finishMail(row,{retry:false,error:'recipient-not-authorized'});
    return {state:'review'};
  }
  try {
    const response=await request('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${cfg.apiKey}`,'Content-Type':'application/json','Idempotency-Key':`alpha-raffle/${row.id}`},
      body:JSON.stringify(row.payload),signal:AbortSignal.timeout(15000),redirect:'error'
    });
    if(!response.ok) {
      // Never persist provider response bodies: they may contain addresses or credentials.
      store.finishMail(row,{retry:response.status===429 || response.status>=500,error:`provider-${response.status}`});
      return {state:'retry-or-review'};
    }
    const data=await response.json();
    if(typeof data.id!=='string' || !data.id) throw Error('Missing provider ID');
    store.finishMail(row,{id:data.id});
    return {state:'accepted'};
  } catch {
    store.finishMail(row,{retry:true,error:'network-or-response-error'});
    return {state:'retry'};
  }
}
async function refreshDelivery(store,cfg,request=fetch) {
  if(cfg.mailMode==='disabled') return;
  for(const row of store.deliveryRows()) {
    try {
      const response=await request(`https://api.resend.com/emails/${encodeURIComponent(row.provider_id)}`,{headers:{Authorization:`Bearer ${cfg.apiKey}`},signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!response.ok) break;
      const data=await response.json();
      store.recordDelivery(row.id,data.last_event);
    } catch { break; }
  }
}
module.exports={sendNext,refreshDelivery};
