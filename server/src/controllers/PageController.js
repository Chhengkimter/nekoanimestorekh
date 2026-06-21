const db      = require('../config/db');
const Product = require('../models/Product');

class PageController {

  // ─── GET /api/pages ──────────────────────────────────────────
  // Returns all active pages for the carousel
  static async getAll(req, res) {
    try {
      const result = await db.query(
        `SELECT page_id, slug, title, banner_url, sort_order
         FROM store_pages
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, page_id ASC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error('getAll pages error:', err.message);
      res.status(500).json({ error: 'Failed to fetch pages' });
    }
  }


  // ─── GET /api/pages/:slug ─────────────────────────────────────
  // Returns page info + its filtered products
  static async getPage(req, res) {
    try {
      const { slug } = req.params;

      // 1. Find the page config
      const pageResult = await db.query(
        `SELECT * FROM store_pages WHERE slug = $1 AND is_active = TRUE`,
        [slug]
      );

      if (!pageResult.rows[0]) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const page = pageResult.rows[0];

      // 2. Fetch products based on filter_type
      let products = [];

      if (page.filter_type === 'category') {
        products = await Product.findAll({ categoryId: page.filter_value });
      } else if (page.filter_type === 'promotion') {
        products = await Product.findAll({ promotion: page.filter_value });
      } else {
        // 'all' — no filter
        products = await Product.findAll({});
      }

      res.json({ page, products });

    } catch (err) {
      console.error('getPage error:', err.message);
      res.status(500).json({ error: 'Failed to fetch page' });
    }
  }

}

module.exports = PageController;