const { Pool } = require('pg');
const { DB_URL } = require('./env');

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false } // required for Supabase
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Database connected successfully');
    release();
  }
});

module.exports = pool;