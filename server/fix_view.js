const db = require('./src/config/db');

async function fix() {
  try {
    await db.query(`DROP VIEW IF EXISTS vw_order_summary CASCADE;`);
    await db.query(`
      CREATE OR REPLACE VIEW vw_order_summary AS
      SELECT 
          o.order_id, o.order_code, o.user_id, o.order_status, o.order_date,
          o.subtotal, o.total, o.profit, o.shipping_method, o.shipping_cost,
          o.addr_type, o.addr_line1, o.addr_district, o.addr_city, o.addr_landmark,
          o.maps_link, o.maps_detail, o.phone1, o.phone2, o.order_note, o.admin_note, o.customer_note,
          COALESCE(u.first_name || ' ' || u.last_name, o.guest_name) AS customer_name,
          o.guest_name, o.guest_email,
          o.payment_method, o.payment_status, o.is_phnom_penh,
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
