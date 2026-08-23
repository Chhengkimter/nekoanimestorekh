const db = require('./src/config/db');
const Order = require('./src/models/Order');

async function checkSchema() {
  try {
    const enumTypes = await db.query(`
      SELECT n.nspname AS schema, t.typname, e.enumlabel
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'order_status_type'
    `);
    if (enumTypes.rows.length > 0) {
      console.log("ENUM:", enumTypes.rows);
    } else {
      const constraints = await db.query(`
        SELECT pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'orders' AND c.contype = 'c'
      `);
      console.log("CHECK CONSTRAINTS:", constraints.rows);
    }
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
