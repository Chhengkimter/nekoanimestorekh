const db = require('./src/config/db');

async function migrateRefund() {
  try {
    console.log("Starting refund migration...");
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_date TIMESTAMP`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_image TEXT`);
    console.log("Refund columns added successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrateRefund();
