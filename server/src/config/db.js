const { Pool } = require('pg');
const { DB_URL } = require('./env');

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }, // required for Supabase
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

// Handle unexpected errors on idle pool clients to prevent crash
pool.on('error', (err, client) => {
  console.error('Unexpected database pool client error:', err.message);
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