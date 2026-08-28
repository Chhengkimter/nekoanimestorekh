-- ============================================================
-- MIGRATION: Finance System (Phase 4)
-- ============================================================

-- 1. Add profit to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS profit DECIMAL(10, 2) DEFAULT NULL;

-- 2. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    expense_id      SERIAL PRIMARY KEY,
    amount          DECIMAL(10, 2) NOT NULL,
    category        VARCHAR(50) NOT NULL, -- e.g., 'ads', 'content_creator', 'other'
    description     TEXT,
    expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date filtering
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- 3. Update Order Summary view to include profit
CREATE OR REPLACE VIEW vw_order_summary AS
SELECT
    o.orderID,
    o.orderCode,
    o.userID,
    u.userFirstName || ' ' || u.userLastName         AS customerName,
    u.userEmail,
    o.orderStatus,
    o.orderDate,
    o.shippingMethod,
    o.shippingCost,
    o.subtotal,
    o.total,
    o.profit, -- <--- ADDED PROFIT HERE
    o.phone1,
    o.phone2,
    o.orderNote,
    o.adminNote,
    o.customerNote,
    COUNT(oi.orderItemID)                            AS totalLines,
    SUM(oi.productQuantity)                          AS totalUnits
FROM Orders o
JOIN Users      u  ON u.userID  = o.userID
LEFT JOIN OrderItems oi ON oi.orderID = o.orderID
GROUP BY o.orderID, o.orderCode, o.userID, customerName, u.userEmail,
         o.orderStatus, o.orderDate, o.shippingMethod, o.shippingCost,
         o.subtotal, o.total, o.profit, o.phone1, o.phone2, o.orderNote, o.adminNote, o.customerNote;
