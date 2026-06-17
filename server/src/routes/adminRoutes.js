// Add at the top of adminRoutes.js:
const db = require('../config/db');

const express          = require('express');
const router           = express.Router();
const AdminController  = require('../controllers/AdminController');
const ProductController = require('../controllers/ProductController');
const { requireAuth, adminOnly } = require('../middleware/auth');

// All admin routes require login + admin role
router.use(requireAuth, adminOnly);

// ─── Dashboard ────────────────────────────────────────────────
router.get('/dashboard',               AdminController.getDashboard);

// ─── Orders ──────────────────────────────────────────────────
router.get('/orders',                  AdminController.getAllOrders);
router.get('/orders/:id',              AdminController.getOrder);
router.patch('/orders/:id/status',     AdminController.updateOrderStatus);

// ─── Customers ───────────────────────────────────────────────
router.get('/customers',               AdminController.getAllCustomers);

// ─── Inventory ───────────────────────────────────────────────
router.get('/inventory',               AdminController.getInventoryLog);
router.post('/inventory/restock',      AdminController.restockProduct);
router.post('/inventory/adjust',       AdminController.adjustStock);

// ─── Products (admin version — same controller, already has adminOnly in productRoutes)
// These are duplicated here for clarity in admin panel JS calls
router.get('/products',                ProductController.getAll);
router.post('/products',               ProductController.create);
router.put('/products/:id',            ProductController.update);
router.delete('/products/:id',         ProductController.remove);

// adminRoutes.js — add this line:
router.get('/categories', async (req, res) => {
  const result = await db.query('SELECT * FROM categories ORDER BY category_name');
  res.json(result.rows);
});

// Add these 3 routes after the existing /categories GET:
router.post('/categories', async (req, res) => {
  const { categoryName } = req.body;
  if (!categoryName) return res.status(400).json({ error: 'Category name required' });
  const result = await db.query(
    'INSERT INTO categories (category_name) VALUES ($1) RETURNING *',
    [categoryName]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/categories/:id', async (req, res) => {
  const { categoryName } = req.body;
  const result = await db.query(
    'UPDATE categories SET category_name = $1 WHERE category_id = $2 RETURNING *',
    [categoryName, req.params.id]
  );
  res.json(result.rows[0]);
});

router.delete('/categories/:id', async (req, res) => {
  await db.query('DELETE FROM categories WHERE category_id = $1', [req.params.id]);
  res.json({ message: 'Category deleted' });
});

module.exports = router;