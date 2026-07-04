const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AIWorkMemory', 'db', 'workmemory.db');
console.log('Querying database at:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare('SELECT id, timestamp, ai_app, ai_task, ai_state, substr(ai_description, 1, 100) as description FROM screenshots ORDER BY id DESC LIMIT 5').all();
  
  if (rows.length === 0) {
    console.log('No screenshots found.');
  } else {
    console.table(rows);
  }
} catch (err) {
  console.error('Error opening database:', err);
}
