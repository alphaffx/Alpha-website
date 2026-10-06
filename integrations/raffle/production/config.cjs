const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../../..');
function privatePath(value) {
  if (!value || !path.isAbsolute(value)) throw Error('Use an absolute private path outside the website repository.');
  const resolved = fs.existsSync(value) ? fs.realpathSync(value) : path.join(fs.realpathSync(path.dirname(value)),path.basename(value));
  const relative = path.relative(root,resolved);
  if (!relative || (!relative.startsWith('..'+path.sep) && !path.isAbsolute(relative))) throw Error('Private files must stay outside the website repository.');
  return resolved;
}
function config(env=process.env) {
  process.umask(0o077);
  const secret = name => env[name+'_FILE'] ? fs.readFileSync(privatePath(env[name+'_FILE']),'utf8').trim() : env[name];
  const key = secret('RAFFLE_ENCRYPTION_KEY');
  if (!/^[a-f0-9]{64}$/i.test(key || '')) throw Error('RAFFLE_ENCRYPTION_KEY must be a private, persistent 32-byte hex key.');
  const origin = new URL(env.RAFFLE_SITE_ORIGIN || 'https://alphaff.gg');
  if (origin.protocol !== 'https:' || origin.origin !== origin.href.replace(/\/$/,'')) throw Error('RAFFLE_SITE_ORIGIN must be an HTTPS origin without a path.');
  const mailMode = env.RAFFLE_MAIL_MODE || 'disabled';
  if (!['disabled','sandbox','live'].includes(mailMode)) throw Error('Unknown mail mode.');
  const sender = env.RAFFLE_FROM || '';
  const apiKey = mailMode === 'disabled' ? undefined : secret('RESEND_API_KEY');
  if (mailMode !== 'disabled' && (!apiKey || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender))) throw Error('Email requires a private Resend API key and a verified sender address.');
  const allowlist = (env.RAFFLE_TEST_RECIPIENTS || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (mailMode === 'sandbox' && !allowlist.length) throw Error('Sandbox mail requires explicitly authorized RAFFLE_TEST_RECIPIENTS.');
  return {file:privatePath(env.RAFFLE_DB),key:Buffer.from(key,'hex'),origin:origin.origin,mailMode,sender,apiKey,allowlist,
    liveEnabled:env.RAFFLE_LIVE_ENABLED==='true' && mailMode==='live',port:Number(env.PORT || 8788)};
}
module.exports={config,privatePath};
