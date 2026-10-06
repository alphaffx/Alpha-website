(() => {
  const form = document.getElementById('raffleForm');
  const status = document.getElementById('raffleStatus');
  const details = document.getElementById('raffleDraw');
  const submit = form.querySelector('button');
  const verify = document.getElementById('raffleVerify');
  let month, busy = false, token, rulesHash, production=false;
  const configuredOrigin = document.querySelector('meta[name="raffle-api-origin"]')?.content || '';
  // The deployer supplies a public HTTPS API origin; never a credential or visitor-controlled URL.
  const apiOrigin = configuredOrigin && /^https:\/\/[^/]+$/.test(configuredOrigin) ? configuredOrigin : '';
  async function api(endpoint,data) {
    const response = await fetch(apiOrigin+'/api/raffle/'+endpoint, {method:data ? 'POST':'GET', headers:data ? {'Content-Type':'application/json'} : {}, body:data ? JSON.stringify(data):undefined, signal:AbortSignal.timeout(10000)});
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Request failed. Try again.');
    return result;
  }
  function readToken() {
    if (!location.hash.startsWith('#redeem?verify=')) return;
    token = new URLSearchParams(location.hash.split('?')[1]).get('verify');
    history.replaceState(null,'','#redeem');
    verify.hidden = false;
    status.textContent = 'Confirm your email to complete your entry.';
  }
  readToken();
  window.addEventListener('hashchange',readToken);
  api('status').then(result => {
    if (!['local-test','production'].includes(result.mode)) throw Error('Unavailable');
    production=result.mode==='production';
    document.getElementById('raffleTest').hidden = production;
    month = result.draw?.month;
    details.textContent = month ? `${month} · ${result.draw.prizes} ${production ? 'reward' : 'dummy'} codes · ${result.draw.state === 'open' ? 'Entries open' : result.draw.state === 'drawn' ? 'Draw completed' : 'Entries closed'}` : production ? 'No draw is open yet.' : 'No test draw has been set up yet.';
    if (production) {
      document.getElementById('raffleEmail').placeholder='you@example.com';
      document.getElementById('rafflePrivacy').textContent='Your email is used for entry verification and raffle results. Read the rules below for eligibility, timing and privacy details.';
      document.getElementById('raffleRulesBlock').hidden=!month;
      document.getElementById('raffleRules').textContent=result.draw?.rules || '';
      document.getElementById('raffleConsent').required=!!month;
      rulesHash=result.draw?.rules_hash;
      if(month) details.textContent+=` · Entries close ${new Date(result.draw.closes).toLocaleString()}`;
    }
    submit.disabled = !month || result.draw.state !== 'open';
    if (!token) status.textContent = submit.disabled ? 'Entries are currently closed.' : production ? 'Verify your email before entries close to join this draw.' : 'Use an @example.test address. Verification links appear in the local admin outbox.';
  }).catch(() => { if (!token) status.textContent = 'The raffle is not open yet. Please check back later.'; });
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (busy || !month || !form.reportValidity()) return;
    busy=true; submit.disabled=true;
    try { status.textContent=(await api('enter',{month,email:form.elements.email.value,rulesHash,consent:production && document.getElementById('raffleConsent').checked})).message; }
    catch (error) { status.textContent=error.name === 'TimeoutError' ? 'Request timed out. Please try again.' : error.message; }
    finally { busy=false; submit.disabled=false; }
  });
  verify.addEventListener('click',async () => {
    if (busy || !token) return;
    busy=true; verify.disabled=true;
    try { status.textContent=(await api('verify',{token})).message; token=null; verify.hidden=true; }
    catch (error) { status.textContent=error.message; }
    finally { busy=false; verify.disabled=false; }
  });
})();
