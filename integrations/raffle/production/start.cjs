// Run both processes on the SAME host/volume. SQLite is not a network database.
const {fork}=require('node:child_process');
const path=require('node:path');
const {config}=require('./config.cjs');
try {
  const cfg=config();
  const children=[fork(path.join(__dirname,'server.cjs'),[],{stdio:'inherit'})];
  if(cfg.mailMode!=='disabled') children.push(fork(path.join(__dirname,'worker.cjs'),['--loop'],{stdio:'inherit'}));
  let stopping=false;
  const stop=()=>{if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');};
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,stop);
  for(const child of children)child.on('exit',code=>{if(!stopping)process.exitCode=code || 1;stop();});
} catch(error) {console.error(error.message);process.exitCode=1;}
