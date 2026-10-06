const fs=require('node:fs');
const {config,privatePath}=require('./config.cjs');
const {openStore}=require('./store.cjs');
// Admin access uses the host's authenticated shell and file permissions. Never expose
// these commands through a web route, public workflow input, or browser-embedded key.
async function main() {
  const cfg=config(),store=openStore(cfg);
  try {
    const [command,month,input]=process.argv.slice(2);
    if(command==='configure') {
      const data=JSON.parse(fs.readFileSync(privatePath(input),'utf8'));
      store.configure(month,data.closes,data.rules);console.log('Draft configured. Entries remain closed.');
    } else if(command==='import') {
      const file=privatePath(input);
      if(fs.statSync(file).size>2*1024*1024) throw Error('Inventory file too large.');
      const codes=fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      console.log(JSON.stringify(store.importCodes(month,codes)));
    } else if(command==='open') {store.open(month);console.log('Draw opened.');}
    else if(command==='draw') console.log(JSON.stringify(store.draw(month)));
    else if(command==='status') console.log(JSON.stringify(store.summary(),null,2));
    else if(command==='smoke') {store.queueSmoke(month);console.log('Authorized sandbox test queued. Run the mail worker to send.');}
    else if(command==='backup') {
      const target=privatePath(month);
      if(fs.existsSync(target)) throw Error('Choose a new backup path.');
      await store.backup(target);console.log('Consistent database backup saved. Preserve the encryption key separately.');
    } else throw Error('Commands: configure YYYY-MM PRIVATE_JSON | import YYYY-MM PRIVATE_CODES_FILE | open YYYY-MM | draw YYYY-MM | status | smoke AUTHORIZED_TEST_EMAIL | backup PRIVATE_PATH');
  } finally {store.close();}
}
if(require.main===module) main().catch(error=>{console.error(error.code?.startsWith('ERR_SQLITE') ? 'Database operation failed; import rolled back. Check duplicates and configuration.' : error.message);process.exitCode=1;});
