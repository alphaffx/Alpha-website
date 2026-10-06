// Local OS access is the admin boundary. There are no HTTP admin routes or browser secrets.
const { openRaffle } = require('./service.cjs');
const { databasePath } = require('./server.cjs');
const service = openRaffle(databasePath());
try {
  const [command,month] = process.argv.slice(2);
  if (command === 'seed') {
    service.inventory(month,[1,2,3].map(n => `DUMMY-${month}-${n}`));
    console.log('Added three dummy codes.');
  } else if (command === 'draw') console.log(service.draw(month));
  else if (command === 'outbox') console.log(JSON.stringify(service.outbox(),null,2));
  else throw Error('Usage: node integrations/raffle/admin.cjs seed YYYY-MM | draw YYYY-MM | outbox');
} catch (error) { console.error(error.message); process.exitCode=1; }
finally { service.close(); }
