const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data', 'app.db'));
const tenant = db.prepare('SELECT * FROM tenants WHERE email = ?').get('anhle.vinmec@gmail.com');
console.log('Tenant:', JSON.stringify(tenant, null, 2));
