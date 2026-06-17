-- ============================================================
--  Neko Animestore — PostgreSQL Schema
--  Matched exactly to: auth.js, cart.js, address.js,
--  confirmation.js, productlist.js, productpage.js,
--  customer.js, user.js + admin panel JS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────────────────────
--  USERS
--  auth.js: firstName, lastName, email, password, role, createdAt
--  session: { role, email, name }
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Users (
    userID          SERIAL        PRIMARY KEY,
    userFirstName   VARCHAR(100)  NOT NULL,
    userLastName    VARCHAR(100)  NOT NULL,
    userEmail       VARCHAR(255)  NOT NULL UNIQUE,
    userHashedPW    TEXT          NOT NULL,
    userPhoneNumber VARCHAR(30),                          -- address.js: phone1 / phone2
    role            VARCHAR(20)   NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('customer', 'admin')),
    userCreatedAt   TIMESTAMPTZ   NOT NULL DEFAULT NOW(), -- auth.js: createdAt
    userLastLogin   TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON Users(userEmail);


-- ─────────────────────────────────────────────────────────────
--  ADMIN
--  auth.js: ADMIN_CREDENTIALS { email, password }
--  admin panel JS: adminRole ('superadmin' | 'staff')
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Admin (
    adminID          SERIAL        PRIMARY KEY,
    adminFirstName   VARCHAR(100)  NOT NULL,
    adminLastName    VARCHAR(100)  NOT NULL,
    adminEmail       VARCHAR(255)  NOT NULL UNIQUE,
    adminHashedPW    TEXT          NOT NULL,
    adminPhoneNumber VARCHAR(30),
    adminRole        VARCHAR(20)   NOT NULL DEFAULT 'staff'
                         CHECK (adminRole IN ('superadmin', 'staff')),
    adminCreatedAt   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    adminLastLogin   TIMESTAMPTZ
);


-- ─────────────────────────────────────────────────────────────
--  ADDRESS
--  address.js: type ('manual'|'maps'), line1, district, city,
--              landmark, mapsLink, mapsDetail, phone1, phone2
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Address (
    addressID     SERIAL        PRIMARY KEY,
    userID        INT           REFERENCES Users(userID) ON DELETE CASCADE,
    addrType      VARCHAR(10)   NOT NULL DEFAULT 'manual'
                      CHECK (addrType IN ('manual', 'maps')),
    -- manual fields
    addressLine1  VARCHAR(255),
    district      VARCHAR(100),
    city          VARCHAR(100),
    landmark      VARCHAR(255),
    -- maps fields
    mapsLink      TEXT,
    mapsDetail    TEXT,
    -- shared
    phone1        VARCHAR(30)   NOT NULL,
    phone2        VARCHAR(30),
    is_default    BOOLEAN       NOT NULL DEFAULT FALSE,
    createdAt     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_address_userid ON Address(userID);


-- ─────────────────────────────────────────────────────────────
--  CATEGORY
--  admin panel JS: categoryName (Figures, Clothing, Accessories…)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Category (
    categoryID   SERIAL        PRIMARY KEY,
    categoryName VARCHAR(100)  NOT NULL UNIQUE
);


-- ─────────────────────────────────────────────────────────────
--  PRODUCTS
--  productpage.js:  id, name, price, description, image
--  productlist.js:  id, name, price, originalPrice, image
--  admin panel JS:  id (PID…), name, categories[], price,
--                   discount, discountFlat, inventory,
--                   stockStatus, description, options[], images[]
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Products (
    productID          SERIAL          PRIMARY KEY,
    productCode        VARCHAR(20)     UNIQUE,             -- admin: 'PID000001' format
    productName        VARCHAR(255)    NOT NULL,
    productDescription TEXT,
    productPrice       NUMERIC(10,2)   NOT NULL CHECK (productPrice >= 0),
    originalPrice      NUMERIC(10,2),                      -- productlist.js: originalPrice (pre-discount base)
    discount           NUMERIC(10,2)   NOT NULL DEFAULT 0, -- admin: discount value
    discountFlat       BOOLEAN         NOT NULL DEFAULT FALSE, -- admin: flat $ vs %
    productStock       INT             NOT NULL DEFAULT 0  CHECK (productStock >= 0),
    productStatus      VARCHAR(20)     NOT NULL DEFAULT 'active'
                           CHECK (productStatus IN ('active','inactive','archived','out_of_stock')),
    stockStatus        VARCHAR(20)     NOT NULL DEFAULT 'instock'
                           CHECK (stockStatus IN ('instock','preorder')), -- admin panel: stockStatus
    createdAt          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_status ON Products(productStatus);
CREATE INDEX idx_products_stock  ON Products(stockStatus);

-- Auto-manage productStatus when stock changes
CREATE OR REPLACE FUNCTION trg_auto_product_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.productStock = 0 AND NEW.productStatus = 'active' THEN
        NEW.productStatus := 'out_of_stock';
    ELSIF NEW.productStock > 0 AND NEW.productStatus = 'out_of_stock' THEN
        NEW.productStatus := 'active';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_status_on_stock
BEFORE UPDATE OF productStock ON Products
FOR EACH ROW EXECUTE FUNCTION trg_auto_product_status();


-- ─────────────────────────────────────────────────────────────
--  PRODUCT OPTIONS
--  productpage.js: options[] = ["Standard","With Base","Box Set","Deluxe Edition"]
--  cart.js: item.option (single selected option string)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ProductOptions (
    optionID    SERIAL        PRIMARY KEY,
    productID   INT           NOT NULL REFERENCES Products(productID) ON DELETE CASCADE,
    optionName  VARCHAR(100)  NOT NULL,
    sortOrder   INT           NOT NULL DEFAULT 0,
    UNIQUE (productID, optionName)
);

CREATE INDEX idx_productoptions_productid ON ProductOptions(productID);


-- ─────────────────────────────────────────────────────────────
--  PRODUCT IMAGES
--  admin panel JS: images[] (URLs or base64), isPrimary
--  productpage.js / productlist.js: image (single URL displayed)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ProductImages (
    imageID    SERIAL   PRIMARY KEY,
    productID  INT      NOT NULL REFERENCES Products(productID) ON DELETE CASCADE,
    imageURL   TEXT     NOT NULL,
    isPrimary  BOOLEAN  NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_productimages_productid ON ProductImages(productID);

-- Enforce only one primary image per product
CREATE OR REPLACE FUNCTION trg_enforce_primary_image()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.isPrimary THEN
        UPDATE ProductImages
        SET isPrimary = FALSE
        WHERE productID = NEW.productID AND imageID <> NEW.imageID;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_one_primary_img
AFTER INSERT OR UPDATE ON ProductImages
FOR EACH ROW EXECUTE FUNCTION trg_enforce_primary_image();


-- ─────────────────────────────────────────────────────────────
--  PRODUCT ↔ CATEGORY  (junction)
--  admin panel JS: product.categories[] (multi-select chips)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ProductCategories (
    productID   INT  NOT NULL REFERENCES Products(productID) ON DELETE CASCADE,
    categoryID  INT  NOT NULL REFERENCES Category(categoryID) ON DELETE CASCADE,
    PRIMARY KEY (productID, categoryID)
);

CREATE INDEX idx_prodcat_categoryid ON ProductCategories(categoryID);


-- ─────────────────────────────────────────────────────────────
--  WISHLIST
--  productlist.js: wishlistState { productId: bool }
--  productpage.js: isWishlisted, cardWishlist{}
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Wishlist (
    wishlistID  SERIAL       PRIMARY KEY,
    userID      INT          NOT NULL REFERENCES Users(userID) ON DELETE CASCADE,
    productID   INT          NOT NULL REFERENCES Products(productID) ON DELETE CASCADE,
    addedAt     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (userID, productID)
);

CREATE INDEX idx_wishlist_userid ON Wishlist(userID);


-- ─────────────────────────────────────────────────────────────
--  CART
--  cart.js: neko_cart in sessionStorage
--  one cart per user, auto-created on first item
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Cart (
    cartID     SERIAL       PRIMARY KEY,
    userID     INT          NOT NULL UNIQUE REFERENCES Users(userID) ON DELETE CASCADE,
    createdAt  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updatedAt  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
--  CART ITEMS
--  cart.js: { cartId, productId, name, option, price, qty, img, note }
--  NOTE: same product with different options = separate rows (cartId is unique key)
--  option stored as text (the selected option string, e.g. "Box Set")
-- ─────────────────────────────────────────────────────────────
CREATE TABLE CartItems (
    cartItemID       SERIAL        PRIMARY KEY,
    cartID           INT           NOT NULL REFERENCES Cart(cartID) ON DELETE CASCADE,
    productID        INT           NOT NULL REFERENCES Products(productID) ON DELETE CASCADE,
    selectedOption   VARCHAR(100),                          -- cart.js: item.option
    priceSnapshot    NUMERIC(10,2) NOT NULL,                -- cart.js: item.price (captured at add time)
    quantity         INT           NOT NULL DEFAULT 1 CHECK (quantity > 0),
    note             TEXT,                                  -- cart.js: item.note (gift note, etc.)
    addedAt          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- same product + same option = one row (qty increments)
    UNIQUE (cartID, productID, selectedOption)
);

CREATE INDEX idx_cartitems_cartid ON CartItems(cartID);


-- ─────────────────────────────────────────────────────────────
--  ORDERS
--  address.js:      orderId ('NK-…'), createdAt, status 'pending'
--                   shipping { method, cost }, phones { phone1, phone2 }
--                   note (order-level note, 500 char max)
--                   address { type, …fields }, subtotal, total
--  confirmation.js: orderId, createdAt, shipping.method, total
-- ─────────────────────────────────────────────────────────────


CREATE TABLE Orders (
    orderID          SERIAL          PRIMARY KEY,
    orderCode        VARCHAR(30)     UNIQUE,               -- address.js: 'NK-' + base36 timestamp
    userID           INT             NOT NULL REFERENCES Users(userID) ON DELETE RESTRICT,
    orderStatus      VARCHAR(20)     NOT NULL DEFAULT 'pending'
                         CHECK (orderStatus IN
                             ('pending','confirmed','shipped','delivered','cancelled','refunded')),
    -- address snapshot (stored here so it survives address edits)
    addrType         VARCHAR(10)     NOT NULL DEFAULT 'manual'
                         CHECK (addrType IN ('manual','maps')),
    addrLine1        VARCHAR(255),
    addrDistrict     VARCHAR(100),
    addrCity         VARCHAR(100),
    addrLandmark     VARCHAR(255),
    mapsLink         TEXT,
    mapsDetail       TEXT,
    phone1           VARCHAR(30)     NOT NULL,
    phone2           VARCHAR(30),
    -- shipping
    shippingMethod   VARCHAR(20)     NOT NULL DEFAULT 'express'
                         CHECK (shippingMethod IN ('express','standard','economy','pickup','undetermined')),
    shippingCost     NUMERIC(8,2),                         -- NULL when 'undetermined'
    -- financials
    subtotal         NUMERIC(12,2)   NOT NULL DEFAULT 0,   -- address.js: subtotal
    total            NUMERIC(12,2),                        -- NULL when shipping undetermined
    -- order-level note (address.js: order-note textarea, 500 chars)
    orderNote        TEXT,
    orderDate        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_userid  ON Orders(userID);
CREATE INDEX idx_orders_status  ON Orders(orderStatus);
CREATE INDEX idx_orders_code    ON Orders(orderCode);


-- ─────────────────────────────────────────────────────────────
--  ORDER ITEMS
--  confirmation.js: items[] { name, option, qty, price, note, img }
--  cart.js:         same shape passed through sessionStorage
-- ─────────────────────────────────────────────────────────────
CREATE TABLE OrderItems (
    orderItemID      SERIAL          PRIMARY KEY,
    orderID          INT             NOT NULL REFERENCES Orders(orderID) ON DELETE CASCADE,
    productID        INT             NOT NULL REFERENCES Products(productID) ON DELETE RESTRICT,
    selectedOption   VARCHAR(100),                          -- confirmation.js: item.option
    productQuantity  INT             NOT NULL CHECK (productQuantity > 0),
    priceAtPurchase  NUMERIC(10,2)   NOT NULL,              -- cart.js: item.price (locked at checkout)
    itemNote         TEXT,                                  -- cart.js: item.note (per-item gift note)
    UNIQUE (orderID, productID, selectedOption)
);

CREATE INDEX idx_orderitems_orderid   ON OrderItems(orderID);
CREATE INDEX idx_orderitems_productid ON OrderItems(productID);


-- ─────────────────────────────────────────────────────────────
--  INVENTORY
--  admin panel JS: inventory (qty), stockStatus ('instock'|'preorder')
--                  adjustInv(), setInv(), addToInventory(), removeFromInventory()
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Inventory (
    inventoryID   SERIAL        PRIMARY KEY,
    productID     INT           NOT NULL REFERENCES Products(productID) ON DELETE CASCADE,
    movementType  VARCHAR(20)   NOT NULL
                      CHECK (movementType IN ('restock','sale','adjustment','return','remove')),
    quantityDelta INT           NOT NULL,   -- + in / - out
    quantityAfter INT           NOT NULL,   -- stock snapshot after movement
    note          TEXT,
    performedBy   INT           REFERENCES Admin(adminID) ON DELETE SET NULL,
    performedAt   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_productid ON Inventory(productID);
CREATE INDEX idx_inventory_date      ON Inventory(performedAt);


-- ─────────────────────────────────────────────────────────────
--  NEWSLETTER
--  customer.js / Script.js: email submit → "10% off"
--  productlist.js / productpage.js: newsletter-form
-- ─────────────────────────────────────────────────────────────
CREATE TABLE Newsletter (
    newsletterID  SERIAL        PRIMARY KEY,
    email         VARCHAR(255)  NOT NULL UNIQUE,
    subscribedAt  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    isActive      BOOLEAN       NOT NULL DEFAULT TRUE
);


-- ─────────────────────────────────────────────────────────────
--  STORED PROCEDURES
-- ─────────────────────────────────────────────────────────────

-- 1. Place order from cart  (address.js → submit-order-btn)
--    Reads CartItems, creates Order + OrderItems, deducts stock, logs Inventory, clears cart.
CREATE OR REPLACE PROCEDURE sp_place_order(
    p_userID         INT,
    p_orderCode      VARCHAR,
    p_addrType       VARCHAR,
    p_addrLine1      VARCHAR  DEFAULT NULL,
    p_addrDistrict   VARCHAR  DEFAULT NULL,
    p_addrCity       VARCHAR  DEFAULT NULL,
    p_addrLandmark   VARCHAR  DEFAULT NULL,
    p_mapsLink       TEXT     DEFAULT NULL,
    p_mapsDetail     TEXT     DEFAULT NULL,
    p_phone1         VARCHAR  DEFAULT NULL,
    p_phone2         VARCHAR  DEFAULT NULL,
    p_shippingMethod VARCHAR  DEFAULT 'express',
    p_shippingCost   NUMERIC  DEFAULT NULL,
    p_orderNote      TEXT     DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_cartID   INT;
    v_orderID  INT;
    v_subtotal NUMERIC(12,2) := 0;
    v_total    NUMERIC(12,2);
    v_after    INT;
    rec        RECORD;
BEGIN
    SELECT cartID INTO v_cartID FROM Cart WHERE userID = p_userID;
    IF NOT FOUND THEN RAISE EXCEPTION 'No cart for userID %', p_userID; END IF;

    -- Stock check
    FOR rec IN
        SELECT ci.productID, ci.quantity, p.productStock
        FROM CartItems ci JOIN Products p ON p.productID = ci.productID
        WHERE ci.cartID = v_cartID AND p.stockStatus = 'instock'
    LOOP
        IF rec.quantity > rec.productStock THEN
            RAISE EXCEPTION 'Insufficient stock for productID %', rec.productID;
        END IF;
    END LOOP;

    -- Subtotal
    SELECT SUM(priceSnapshot * quantity) INTO v_subtotal
    FROM CartItems WHERE cartID = v_cartID;

    v_total := CASE WHEN p_shippingCost IS NOT NULL
                    THEN v_subtotal + p_shippingCost
                    ELSE NULL END;

    -- Create order
    INSERT INTO Orders (
        orderCode, userID, orderStatus,
        addrType, addrLine1, addrDistrict, addrCity, addrLandmark,
        mapsLink, mapsDetail, phone1, phone2,
        shippingMethod, shippingCost, subtotal, total, orderNote
    ) VALUES (
        p_orderCode, p_userID, 'pending',
        p_addrType, p_addrLine1, p_addrDistrict, p_addrCity, p_addrLandmark,
        p_mapsLink, p_mapsDetail, p_phone1, p_phone2,
        p_shippingMethod, p_shippingCost, v_subtotal, v_total, p_orderNote
    ) RETURNING orderID INTO v_orderID;

    -- Insert items + deduct stock + log inventory
    FOR rec IN
        SELECT ci.productID, ci.selectedOption, ci.quantity,
               ci.priceSnapshot, ci.note
        FROM CartItems ci WHERE ci.cartID = v_cartID
    LOOP
        INSERT INTO OrderItems (
            orderID, productID, selectedOption,
            productQuantity, priceAtPurchase, itemNote
        ) VALUES (
            v_orderID, rec.productID, rec.selectedOption,
            rec.quantity, rec.priceSnapshot, rec.note
        );

        UPDATE Products
        SET productStock = productStock - rec.quantity
        WHERE productID = rec.productID AND stockStatus = 'instock'
        RETURNING productStock INTO v_after;

        IF FOUND THEN
            INSERT INTO Inventory (productID, movementType, quantityDelta, quantityAfter, note)
            VALUES (rec.productID, 'sale', -rec.quantity, v_after, 'Order ' || p_orderCode);
        END IF;
    END LOOP;

    DELETE FROM CartItems WHERE cartID = v_cartID;
    RAISE NOTICE 'Order % created (ID=%)', p_orderCode, v_orderID;
END;
$$;


-- 2. Add / update cart item  (cart.js: changeQty, add to cart from productpage.js)
CREATE OR REPLACE PROCEDURE sp_upsert_cart_item(
    p_userID        INT,
    p_productID     INT,
    p_option        VARCHAR,
    p_quantity      INT,
    p_priceSnapshot NUMERIC,
    p_note          TEXT DEFAULT ''
)
LANGUAGE plpgsql AS $$
DECLARE v_cartID INT;
BEGIN
    INSERT INTO Cart (userID) VALUES (p_userID)
    ON CONFLICT (userID) DO NOTHING;

    SELECT cartID INTO v_cartID FROM Cart WHERE userID = p_userID;

    INSERT INTO CartItems (cartID, productID, selectedOption, priceSnapshot, quantity, note)
    VALUES (v_cartID, p_productID, p_option, p_priceSnapshot, p_quantity, p_note)
    ON CONFLICT (cartID, productID, selectedOption)
    DO UPDATE SET quantity = CartItems.quantity + EXCLUDED.quantity,
                  note     = EXCLUDED.note;
END;
$$;


-- 3. Restock product  (admin panel: + button / Add to Inventory modal)
CREATE OR REPLACE PROCEDURE sp_restock_product(
    p_productID  INT,
    p_quantity   INT,
    p_adminID    INT  DEFAULT NULL,
    p_note       TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE v_after INT;
BEGIN
    IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
    UPDATE Products SET productStock = productStock + p_quantity,
                        stockStatus  = 'instock'
    WHERE productID = p_productID RETURNING productStock INTO v_after;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', p_productID; END IF;
    INSERT INTO Inventory (productID, movementType, quantityDelta, quantityAfter, note, performedBy)
    VALUES (p_productID, 'restock', p_quantity, v_after, p_note, p_adminID);
END;
$$;


-- 4. Manual stock adjustment  (admin panel: inv-qty-input onchange → setInv())
CREATE OR REPLACE PROCEDURE sp_adjust_stock(
    p_productID INT,
    p_newQty    INT,
    p_adminID   INT  DEFAULT NULL,
    p_note      TEXT DEFAULT 'Manual adjustment'
)
LANGUAGE plpgsql AS $$
DECLARE v_current INT; v_delta INT;
BEGIN
    IF p_newQty < 0 THEN RAISE EXCEPTION 'Stock cannot be negative'; END IF;
    SELECT productStock INTO v_current FROM Products WHERE productID = p_productID;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', p_productID; END IF;
    v_delta := p_newQty - v_current;
    UPDATE Products SET productStock = p_newQty WHERE productID = p_productID;
    INSERT INTO Inventory (productID, movementType, quantityDelta, quantityAfter, note, performedBy)
    VALUES (p_productID, 'adjustment', v_delta, p_newQty, p_note, p_adminID);
END;
$$;


-- 5. Remove from inventory → preorder  (admin panel: removeFromInventory())
CREATE OR REPLACE PROCEDURE sp_remove_from_inventory(
    p_productID INT,
    p_adminID   INT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE v_current INT;
BEGIN
    SELECT productStock INTO v_current FROM Products WHERE productID = p_productID;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', p_productID; END IF;
    UPDATE Products SET productStock = 0, stockStatus = 'preorder', productStatus = 'inactive'
    WHERE productID = p_productID;
    INSERT INTO Inventory (productID, movementType, quantityDelta, quantityAfter, note, performedBy)
    VALUES (p_productID, 'remove', -v_current, 0, 'Moved to pre-order', p_adminID);
END;
$$;


-- ─────────────────────────────────────────────────────────────
--  VIEWS
-- ─────────────────────────────────────────────────────────────

-- Product catalogue (productlist.js + productpage.js shape)
-- Returns: id, name, price, originalPrice, salePrice, primaryImage, categories, stockStatus
CREATE OR REPLACE VIEW vw_product_catalogue AS
SELECT
    p.productID,
    p.productCode,
    p.productName,
    p.productDescription,
    p.productPrice,
    p.originalPrice,
    p.discount,
    p.discountFlat,
    p.promotion,
    -- computed sale price matching calcSale() in admin JS
    CASE
        WHEN p.discount = 0 THEN p.productPrice
        WHEN p.discountFlat THEN GREATEST(0, p.productPrice - p.discount)
        ELSE GREATEST(0, p.productPrice - (p.productPrice * p.discount / 100))
    END                                              AS salePrice,
    p.productStock,
    p.productStatus,
    p.stockStatus,
    img.imageURL                                     AS primaryImage,
    STRING_AGG(c.categoryName, ', ' ORDER BY c.categoryName) AS categories
FROM Products p
LEFT JOIN ProductImages     img ON img.productID = p.productID AND img.isPrimary = TRUE
LEFT JOIN ProductCategories pc  ON pc.productID  = p.productID
LEFT JOIN Category          c   ON c.categoryID  = pc.categoryID
GROUP BY p.productID, p.productCode, p.productName, p.productDescription,
         p.productPrice, p.originalPrice, p.discount, p.discountFlat,
         p.productStock, p.productStatus, p.stockStatus, img.imageURL;


-- Order summary  (confirmation.js shape)
-- Returns: orderCode, date, shippingLabel, subtotal, total, items[]
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
    o.phone1,
    o.phone2,
    o.orderNote,
    COUNT(oi.orderItemID)                            AS totalLines,
    SUM(oi.productQuantity)                          AS totalUnits
FROM Orders o
JOIN Users      u  ON u.userID  = o.userID
JOIN OrderItems oi ON oi.orderID = o.orderID
GROUP BY o.orderID, o.orderCode, o.userID, customerName, u.userEmail,
         o.orderStatus, o.orderDate, o.shippingMethod, o.shippingCost,
         o.subtotal, o.total, o.phone1, o.phone2, o.orderNote;


-- Cart summary  (cart.js renderSummary() shape)
CREATE OR REPLACE VIEW vw_cart_summary AS
SELECT
    c.cartID,
    c.userID,
    u.userFirstName || ' ' || u.userLastName         AS customerName,
    COUNT(ci.cartItemID)                             AS itemLines,
    SUM(ci.quantity)                                 AS totalUnits,
    SUM(ci.quantity * ci.priceSnapshot)              AS cartTotal
FROM Cart c
JOIN Users     u  ON u.userID    = c.userID
JOIN CartItems ci ON ci.cartID   = c.cartID
GROUP BY c.cartID, c.userID, customerName;


-- Low-stock alert  (admin panel: stat-card "Low stock ≤5", "Out of stock")
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT productID, productCode, productName, productStock, productStatus, stockStatus
FROM Products
WHERE productStatus IN ('active','out_of_stock')
  AND productStock < 10
ORDER BY productStock ASC;


-- Inventory log  (admin panel: future audit trail page)
CREATE OR REPLACE VIEW vw_inventory_log AS
SELECT
    i.inventoryID,
    i.productID,
    p.productName,
    i.movementType,
    i.quantityDelta,
    i.quantityAfter,
    i.note,
    a.adminFirstName || ' ' || a.adminLastName       AS performedBy,
    i.performedAt
FROM Inventory i
JOIN Products p       ON p.productID = i.productID
LEFT JOIN Admin a     ON a.adminID   = i.performedBy
ORDER BY i.performedAt DESC;


-- ─────────────────────────────────────────────────────────────
--  SEED DATA
-- ─────────────────────────────────────────────────────────────

-- Categories  (admin panel JS default list)
INSERT INTO Category (categoryName) VALUES
    ('Figures'), ('Clothing'), ('Accessories'), ('Keychains'), ('Posters'),
    ('Stationery'), ('Other');

-- Products  (productlist.js + productpage.js demo data)
INSERT INTO Products (productCode, productName, productDescription, productPrice, originalPrice, discount, discountFlat, productStock, stockStatus) VALUES
    ('PID000001', 'Naruto Hokage Figure',
        'High-quality PVC figure of Naruto in Hokage outfit.',
        24.99, NULL, 0, FALSE, 12, 'instock'),
    ('PID000002', 'Demon Slayer Hoodie',
        'Tanjiro-inspired unisex hoodie, soft fleece.',
        34.99, NULL, 10, FALSE, 3, 'instock'),
    ('PID000003', 'One Piece Keychain Set',
        'Set of 5 Straw Hat crew keychains.',
        8.99,  NULL, 0, FALSE, 45, 'instock'),
    ('PID000004', 'Attack on Titan Poster',
        'A2 size glossy poster, Survey Corps design.',
        5.99,  NULL, 2, TRUE,  0, 'preorder'),
    ('PID000005', 'Demon Slayer Tanjiro Figure – Limited Edition',
        'Hand-painted PVC, 22cm, certificate of authenticity.',
        24.99, 34.99, 10, FALSE, 20, 'instock');

-- Product Options  (productpage.js: options[])
INSERT INTO ProductOptions (productID, optionName, sortOrder) VALUES
    (1, 'Small',          1), (1, 'Large',          2),
    (2, 'S',              1), (2, 'M',              2), (2, 'L', 3), (2, 'XL', 4),
    (5, 'Standard',       1), (5, 'With Base',      2),
    (5, 'Box Set',        3), (5, 'Deluxe Edition', 4);

-- Product Images  (admin panel JS: images[])
INSERT INTO ProductImages (productID, imageURL, isPrimary) VALUES
    (1, 'https://cdn.neko.com/img/naruto-figure.jpg',    TRUE),
    (2, 'https://cdn.neko.com/img/ds-hoodie.jpg',        TRUE),
    (3, 'https://cdn.neko.com/img/op-keychain.jpg',      TRUE),
    (4, 'https://cdn.neko.com/img/aot-poster.jpg',       TRUE),
    (5, 'https://cdn.neko.com/img/tanjiro-figure-1.jpg', TRUE),
    (5, 'https://cdn.neko.com/img/tanjiro-figure-2.jpg', FALSE);

-- Product ↔ Category
INSERT INTO ProductCategories (productID, categoryID) VALUES
    (1,1),(2,2),(2,3),(3,4),(3,3),(4,5),(5,1);

-- Inventory seed entries
INSERT INTO Inventory (productID, movementType, quantityDelta, quantityAfter, note) VALUES
    (1,'restock',12,12,'Initial stock'), (2,'restock',3,3,'Initial stock'),
    (3,'restock',45,45,'Initial stock'),(4,'restock',0,0,'Pre-order, no stock'),
    (5,'restock',20,20,'Initial stock');

-- ─────────────────────────────────────────────────────────────
--  FILE: save as  neko_database.sql
--  Run:  psql -U <user> -d <dbname> -f neko_database.sql
-- ─────────────────────────────────────────────────────────────