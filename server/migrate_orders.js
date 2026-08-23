const db = require('./src/config/db');

async function migrate() {
  try {
    console.log("Starting database migration...");

    // 1. Drop and recreate order_status constraint
    console.log("Updating order_status constraint...");
    await db.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check`);
    await db.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_order_status_check 
      CHECK (order_status IN ('pending', 'modified', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'))
    `);

    // 2. Add new columns
    console.log("Adding new columns to orders...");
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'full'`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid'`);
    await db.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_phnom_penh BOOLEAN DEFAULT false`);
    
    // Update constraint for payment_method
    await db.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check`);
    await db.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_payment_method_check 
      CHECK (payment_method IN ('cod', 'half_upfront', 'full'))
    `);

    // Update constraint for payment_status
    await db.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check`);
    await db.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('unpaid', 'half_paid', 'full_paid'))
    `);

    // 3. Recreate sp_place_order
    console.log("Recreating sp_place_order...");
    await db.query(`
      CREATE OR REPLACE PROCEDURE public.sp_place_order(
          IN p_user_id integer, 
          IN p_order_code character varying, 
          IN p_addr_type character varying, 
          IN p_addr_line1 character varying DEFAULT NULL::character varying, 
          IN p_addr_district character varying DEFAULT NULL::character varying, 
          IN p_addr_city character varying DEFAULT NULL::character varying, 
          IN p_addr_landmark character varying DEFAULT NULL::character varying, 
          IN p_maps_link text DEFAULT NULL::text, 
          IN p_maps_detail text DEFAULT NULL::text, 
          IN p_phone1 character varying DEFAULT NULL::character varying, 
          IN p_phone2 character varying DEFAULT NULL::character varying, 
          IN p_shipping_method character varying DEFAULT 'express'::character varying, 
          IN p_shipping_cost numeric DEFAULT NULL::numeric, 
          IN p_order_note text DEFAULT NULL::text,
          IN p_payment_method character varying DEFAULT 'full'::character varying,
          IN p_is_phnom_penh boolean DEFAULT false
      )
      LANGUAGE plpgsql
      AS $procedure$
      DECLARE
          v_cart_id  INT;
          v_order_id INT;
          v_subtotal NUMERIC(12,2) := 0;
          v_total    NUMERIC(12,2);
          v_after    INT;
          rec        RECORD;
      BEGIN
          SELECT cart_id INTO v_cart_id FROM cart WHERE user_id = p_user_id;
          IF NOT FOUND THEN RAISE EXCEPTION 'No cart for user_id %', p_user_id; END IF;

          FOR rec IN
              SELECT ci.product_id, ci.quantity, p.product_stock
              FROM cart_items ci JOIN products p ON p.product_id = ci.product_id
              WHERE ci.cart_id = v_cart_id AND p.stock_status = 'instock'
          LOOP
              IF rec.quantity > rec.product_stock THEN
                  RAISE EXCEPTION 'Insufficient stock for product_id %', rec.product_id;
              END IF;
          END LOOP;

          SELECT SUM(price_snapshot * quantity) INTO v_subtotal
          FROM cart_items WHERE cart_id = v_cart_id;

          v_total := CASE WHEN p_shipping_cost IS NOT NULL
                          THEN v_subtotal + p_shipping_cost
                          ELSE NULL END;

          INSERT INTO orders (
              order_code, user_id, order_status,
              addr_type, addr_line1, addr_district, addr_city, addr_landmark,
              maps_link, maps_detail, phone1, phone2,
              shipping_method, shipping_cost, subtotal, total, order_note,
              payment_method, is_phnom_penh, payment_status
          ) VALUES (
              p_order_code, p_user_id, 'pending',
              p_addr_type, p_addr_line1, p_addr_district, p_addr_city, p_addr_landmark,
              p_maps_link, p_maps_detail, p_phone1, p_phone2,
              p_shipping_method, p_shipping_cost, v_subtotal, v_total, p_order_note,
              p_payment_method, p_is_phnom_penh, 'unpaid'
          ) RETURNING order_id INTO v_order_id;

          FOR rec IN
              SELECT ci.product_id, ci.selected_option, ci.quantity,
                    ci.price_snapshot, ci.note
              FROM cart_items ci WHERE ci.cart_id = v_cart_id
          LOOP
              INSERT INTO order_items (
                  order_id, product_id, selected_option,
                  product_quantity, price_at_purchase, item_note
              ) VALUES (
                  v_order_id, rec.product_id, rec.selected_option,
                  rec.quantity, rec.price_snapshot, rec.note
              );

              UPDATE products
              SET product_stock = product_stock - rec.quantity
              WHERE product_id = rec.product_id AND stock_status = 'instock'
              RETURNING product_stock INTO v_after;

              IF FOUND THEN
                  INSERT INTO inventory (product_id, movement_type, quantity_delta, quantity_after, note)
                  VALUES (rec.product_id, 'sale', -rec.quantity, v_after, 'Order ' || p_order_code);
              END IF;
          END LOOP;

          DELETE FROM cart_items WHERE cart_id = v_cart_id;
          RAISE NOTICE 'Order % created (ID=%)', p_order_code, v_order_id;
      END;
      $procedure$;
    `);

    // Update vw_order_summary to include new columns
    console.log("Updating vw_order_summary...");
    await db.query(`DROP VIEW IF EXISTS vw_order_summary CASCADE;`);
    await db.query(`
      CREATE OR REPLACE VIEW vw_order_summary AS
      SELECT 
          o.order_id, o.order_code, o.user_id, o.order_status, o.order_date,
          o.subtotal, o.total, o.shipping_method, o.shipping_cost,
          o.addr_type, o.addr_line1, o.addr_district, o.addr_city, o.addr_landmark,
          o.maps_link, o.maps_detail, o.phone1, o.phone2, o.order_note, o.admin_note,
          COALESCE(u.first_name || ' ' || u.last_name, o.guest_name) AS customer_name,
          o.guest_name, o.guest_email,
          o.payment_method, o.payment_status, o.is_phnom_penh,
          COUNT(oi.order_item_id) AS total_items
      FROM orders o
      LEFT JOIN users u ON u.user_id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.order_id
      GROUP BY o.order_id, u.user_id;
    `);

    console.log("Migration completed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    process.exit(0);
  }
}

migrate();
