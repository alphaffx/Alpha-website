const { DatabaseSync } = require('node:sqlite');
const { randomBytes, createHash, randomInt } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');

function openRaffle(file) {
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS draws (month TEXT PRIMARY KEY, state TEXT NOT NULL DEFAULT 'open');
    CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, month TEXT REFERENCES draws(month), email TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0, token TEXT UNIQUE, expires INTEGER, UNIQUE(month,email));
    CREATE TABLE IF NOT EXISTS codes (id INTEGER PRIMARY KEY, month TEXT REFERENCES draws(month), code TEXT UNIQUE NOT NULL,
      entry INTEGER UNIQUE REFERENCES entries(id));
    CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY, recipient TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL);
  `);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const monthValid = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  return {
    close: () => db.close(),
    inventory(month, codes) {
      if (!monthValid(month) || !Array.isArray(codes) || !codes.length || codes.some(c => !/^DUMMY-[A-Z0-9-]{1,80}$/.test(c))) throw Error('Only DUMMY- codes are accepted in this test system.');
      return transaction(() => {
        db.prepare('INSERT OR IGNORE INTO draws(month) VALUES (?)').run(month);
        if (db.prepare('SELECT state FROM draws WHERE month=?').get(month).state !== 'open') throw Error('Draw already completed.');
        for (const code of codes) db.prepare('INSERT INTO codes(month,code) VALUES (?,?)').run(month, code);
      });
    },
    status() {
      return db.prepare("SELECT month,state,(SELECT count(*) FROM codes WHERE month=draws.month) AS prizes FROM draws ORDER BY month DESC LIMIT 1").get() || null;
    },
    enter(month, address, origin) {
      const email = String(address || '').trim().toLowerCase();
      // Hard safety boundary: this implementation cannot accept real visitor addresses.
      if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@example\.test$/.test(email)) throw Error('Use an @example.test email in this local test.');
      return transaction(() => {
        if (db.prepare('SELECT state FROM draws WHERE month=?').get(month)?.state !== 'open') throw Error('This draw is closed or unavailable.');
        const previous = db.prepare('SELECT * FROM entries WHERE month=? AND email=?').get(month,email);
        if (previous?.verified || previous?.expires > Date.now()) return;
        const token = randomBytes(32).toString('hex');
        db.prepare(`INSERT INTO entries(month,email,token,expires) VALUES (?,?,?,?)
          ON CONFLICT(month,email) DO UPDATE SET token=excluded.token,expires=excluded.expires`).run(month,email,hash(token),Date.now()+86400000);
        db.prepare('INSERT INTO outbox(recipient,kind,body) VALUES (?,?,?)').run(email,'verification',`${origin}/#redeem?verify=${token}`);
      });
    },
    verify(token) {
      if (!/^[a-f0-9]{64}$/.test(String(token))) throw Error('Invalid verification link.');
      return transaction(() => {
        const entry = db.prepare('SELECT * FROM entries WHERE token=?').get(hash(token));
        if (!entry || entry.expires < Date.now()) throw Error('This link is invalid or expired. Request another link.');
        if (db.prepare('SELECT state FROM draws WHERE month=?').get(entry.month).state !== 'open') throw Error('This draw has closed.');
        db.prepare('UPDATE entries SET verified=1,token=NULL,expires=NULL WHERE id=?').run(entry.id);
        return entry.month;
      });
    },
    draw(month) {
      return transaction(() => {
        const draw = db.prepare('SELECT state FROM draws WHERE month=?').get(month);
        if (!draw) throw Error('Unknown draw.');
        if (draw.state === 'drawn') return { winners: db.prepare('SELECT count(*) AS n FROM codes WHERE month=? AND entry IS NOT NULL').get(month).n, alreadyDrawn: true };
        const codes = db.prepare('SELECT * FROM codes WHERE month=? AND entry IS NULL').all(month);
        if (!codes.length) throw Error('Add inventory before drawing.');
        const entries = db.prepare('SELECT * FROM entries WHERE month=? AND verified=1').all(month);
        // Partial Fisher-Yates using cryptographic, unbiased integer sampling.
        const count = Math.min(codes.length,entries.length);
        for (let i=0; i<count; i++) {
          const j = randomInt(i,entries.length); [entries[i],entries[j]] = [entries[j],entries[i]];
          db.prepare('UPDATE codes SET entry=? WHERE id=?').run(entries[i].id,codes[i].id);
          db.prepare('INSERT INTO outbox(recipient,kind,body) VALUES (?,?,?)').run(entries[i].email,'winner',`You won the ${month} test draw. Your dummy code: ${codes[i].code}`);
        }
        db.prepare("UPDATE draws SET state='drawn' WHERE month=?").run(month);
        return { winners: count, alreadyDrawn: false };
      });
    },
    outbox: () => db.prepare('SELECT * FROM outbox ORDER BY id').all(),
  };
}
module.exports = { openRaffle };
