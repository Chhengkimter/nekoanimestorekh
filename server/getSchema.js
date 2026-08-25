const db = require('./src/config/db');
const Order = require('./src/models/Order');

async function checkSchema() {
  try {
    const res = await db.query(`SELECT conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'orders' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) LIKE '%order_status%'`);
    if(res.rows.length > 0) {
      const constraintName = res.rows[0].conname;
      await db.query(`ALTER TABLE orders DROP CONSTRAINT "${constraintName}"`);
    }
    await db.query(`ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN ('pending', 'modified', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded', 'awaiting_final_payment'))`);
    console.log("SUCCESS");
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
