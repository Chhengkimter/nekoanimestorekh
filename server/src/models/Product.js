const db = require('../config/db');

class Product {

  // ─── Get all products (customer product listing page) ────────
  static async findAll({ categoryId, search, promotion, limit = 20, offset = 0 } = {}) {
    let query = `SELECT * FROM vw_product_catalogue WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND product_name ILIKE $${params.length}`;
    }

    if (categoryId) {
      params.push(categoryId);
      query += ` AND product_id IN (
        SELECT product_id FROM product_categories WHERE category_id = $${params.length}
      )`;
    }

    query += ` AND product_status != 'archived'`;
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    return result.rows;
  }

  static async findById(productId) {
    const productResult = await db.query(
      `SELECT * FROM vw_product_catalogue WHERE product_id = $1`,
      [productId]
    );
    if (!productResult.rows[0]) return null;
    const product = productResult.rows[0];

    const imagesResult = await db.query(
      `SELECT image_id, image_url, is_primary
      FROM product_images WHERE product_id = $1
      ORDER BY is_primary DESC`,
      [productId]
    );
    product.images = imagesResult.rows;

    // variant_price included — NULL means "no override, use base product price"
    const variantsResult = await db.query(
      `SELECT variant_id, variant_name, variant_stock, variant_sku, variant_price, sort_order
      FROM product_variants WHERE product_id = $1
      ORDER BY sort_order, variant_id`,
      [productId]
    );
    product.variants = variantsResult.rows;

    return product;
  }

  // ─── Create new product (admin only) ─────────────────────────
static async create({ productCode, productName, productDescription,
                       productPrice, originalPrice, discount, discountFlat,
                       productStock, stockStatus }) {

  // Auto-generate product_code if not provided
    if (!productCode) {
      const countResult = await db.query('SELECT COUNT(*) FROM products');
      const count = parseInt(countResult.rows[0].count) + 1;
      productCode = 'PID' + String(count).padStart(6, '0');
    }

    const result = await db.query(
      `INSERT INTO products
        (product_code, product_name, product_description,
          product_price, original_price, discount, discount_flat,
          product_stock, stock_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [productCode, productName, productDescription,
      productPrice, originalPrice || null, discount || 0, discountFlat || false,
      productStock || 0, stockStatus || 'instock']
    );
    return result.rows[0];
  }

  // ─── Update product (admin only) ─────────────────────────────
  static async update(productId, fields) {
    const {
      productName, productDescription, productPrice,
      originalPrice, discount, discountFlat,
      productStock, stockStatus, productStatus
    } = fields;

    const result = await db.query(
      `UPDATE products SET
         product_name        = COALESCE($1, product_name),
         product_description = COALESCE($2, product_description),
         product_price       = COALESCE($3, product_price),
         original_price      = COALESCE($4, original_price),
         discount            = COALESCE($5, discount),
         discount_flat       = COALESCE($6, discount_flat),
         product_stock       = COALESCE($7, product_stock),
         stock_status        = COALESCE($8, stock_status),
         product_status      = COALESCE($9, product_status)
       WHERE product_id = $10
       RETURNING *`,
      [productName, productDescription, productPrice,
       originalPrice, discount, discountFlat,
       productStock, stockStatus, productStatus,
       productId]
    );
    return result.rows[0];
  }

  // ─── Delete product (admin only) ─────────────────────────────
  static async delete(productId) {
    await db.query(
      `DELETE FROM products WHERE product_id = $1`,
      [productId]
    );
  }

  // ─── Add image to product ─────────────────────────────────────
  static async addImage(productId, imageUrl, isPrimary = false) {
    const result = await db.query(
      `INSERT INTO product_images (product_id, image_url, is_primary)
       VALUES ($1, $2, $3) RETURNING *`,
      [productId, imageUrl, isPrimary]
    );
    return result.rows[0];
  }

  // ─── Delete image ─────────────────────────────────────────────
  static async deleteImage(imageId) {
    const result = await db.query(
      `DELETE FROM product_images WHERE image_id = $1 RETURNING image_url`,
      [imageId]
    );
    return result.rows[0];
  }

  // ─── Set categories for product ──────────────────────────────
  static async setCategories(productId, categoryIds) {
    // Remove all existing category links
    await db.query(
      `DELETE FROM product_categories WHERE product_id = $1`,
      [productId]
    );
    // Insert new ones
    for (const categoryId of categoryIds) {
      await db.query(
        `INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)`,
        [productId, categoryId]
      );
    }
  }

  // ─── Get all variants for a product ──────────────────────────
  static async getVariants(productId) {
    const result = await db.query(
      `SELECT variant_id, variant_name, variant_stock, variant_sku, variant_price, sort_order
      FROM product_variants
      WHERE product_id = $1
      ORDER BY sort_order, variant_id`,
      [productId]
    );
    return result.rows;
  }

  // ─── Set variants (replaces all existing) ────────────────────
  static async setVariants(productId, variants) {
    // variants: [{ variantName, variantStock, variantSku, variantPrice, sortOrder }]
    await db.query(
      `DELETE FROM product_variants WHERE product_id = $1`,
      [productId]
    );
    for (let i = 0; i < variants.length; i++) {
      await db.query(
        `INSERT INTO product_variants (product_id, variant_name, variant_stock, variant_sku, variant_price, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [productId, variants[i].variantName, variants[i].variantStock || 0,
        variants[i].variantSku || null, variants[i].variantPrice ?? null, i + 1]
      );
    }
  }

  // ─── Update single variant fields ─────────────────────────────
  // clearPrice: true explicitly resets variant_price back to NULL
  // (so the variant falls back to base product price). Plain
  // COALESCE can't express "set to NULL", hence the CASE branch.
  static async updateVariant(variantId, { variantStock, variantName, variantSku, variantPrice, clearPrice }) {
    const result = await db.query(
      `UPDATE product_variants SET
        variant_stock = COALESCE($1, variant_stock),
        variant_name  = COALESCE($2, variant_name),
        variant_sku   = COALESCE($3, variant_sku),
        variant_price = CASE WHEN $5 THEN NULL ELSE COALESCE($4, variant_price) END
      WHERE variant_id = $6 RETURNING *`,
      [variantStock, variantName, variantSku, variantPrice, !!clearPrice, variantId]
    );
    return result.rows[0];
  }

  // ─── Add single variant ───────────────────────────────────────
  static async addVariant(productId, variantName, variantStock, variantSku, variantPrice = null) {
    const result = await db.query(
      `INSERT INTO product_variants (product_id, variant_name, variant_stock, variant_sku, variant_price)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [productId, variantName, variantStock || 0, variantSku || null, variantPrice]
    );
    return result.rows[0];
  }

  // ─── Delete single variant ────────────────────────────────────
  static async deleteVariant(variantId) {
    const result = await db.query(
      `DELETE FROM product_variants WHERE variant_id = $1 RETURNING *`,
      [variantId]
    );
    return result.rows[0];
  }

  // ─── Get total stock across all variants ─────────────────────
  static async syncProductStockFromVariants(productId) {
    const result = await db.query(
      `UPDATE products SET product_stock = (
        SELECT COALESCE(SUM(variant_stock), 0)
        FROM product_variants WHERE product_id = $1
      ) WHERE product_id = $1 RETURNING product_stock`,
      [productId]
    );
    return result.rows[0]?.product_stock ?? 0;
  }

}

module.exports = Product;