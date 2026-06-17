const db = require('../config/db');

class Product {

  // ─── Get all products (customer product listing page) ────────
  static async findAll({ categoryId, search, limit = 20, offset = 0 } = {}) {
    let query = `SELECT * FROM vw_product_catalogue WHERE 1=1`;
    const params = [];

    // Add after the search filter block:
    if (promotion) {
      params.push(promotion);
      query += ` AND promotion = $${params.length}`;
    }
    
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

  // ─── Get one product with all images + options ───────────────
  static async findById(productId) {
    // Main product info
    const productResult = await db.query(
      `SELECT * FROM vw_product_catalogue WHERE product_id = $1`,
      [productId]
    );
    if (!productResult.rows[0]) return null;

    const product = productResult.rows[0];

    // All images
    const imagesResult = await db.query(
      `SELECT image_id, image_url, is_primary
       FROM product_images WHERE product_id = $1
       ORDER BY is_primary DESC`,
      [productId]
    );
    product.images = imagesResult.rows;

    // All options
    const optionsResult = await db.query(
      `SELECT option_id, option_name
       FROM product_options WHERE product_id = $1
       ORDER BY sort_order`,
      [productId]
    );
    product.options = optionsResult.rows;

    return product;
  }

  // ─── Create new product (admin only) ─────────────────────────
  static async create({ productCode, productName, productDescription,
                         productPrice, originalPrice, discount, discountFlat,
                         productStock, stockStatus }) {
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

  // ─── Set options for product ──────────────────────────────────
  static async setOptions(productId, optionNames) {
    await db.query(
      `DELETE FROM product_options WHERE product_id = $1`,
      [productId]
    );
    for (let i = 0; i < optionNames.length; i++) {
      await db.query(
        `INSERT INTO product_options (product_id, option_name, sort_order)
         VALUES ($1, $2, $3)`,
        [productId, optionNames[i], i + 1]
      );
    }
  }

}

module.exports = Product;