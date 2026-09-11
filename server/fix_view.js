const db = require('./src/config/db');

async function fix() {
  try {
    await db.query(`DROP VIEW IF EXISTS vw_order_summary CASCADE;`);
    await db.query(`
      CREATE OR REPLACE VIEW vw_order_summary AS
      SELECT 
          o.*,
          COALESCE(u.first_name || ' ' || u.last_name, o.guest_name) AS customer_name,
          COUNT(oi.order_item_id) AS total_items
      FROM orders o
      LEFT JOIN users u ON u.user_id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.order_id
      GROUP BY o.order_id, u.user_id;
    `);
    console.log('done');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
fix();
