// Add at the top of adminRoutes.js:
const db = require('../config/db');

const express          = require('express');
const router           = express.Router();
const multer           = require('multer');
const AdminController  = require('../controllers/AdminController');
const ProductController = require('../controllers/ProductController');
const CouponController  = require('../controllers/CouponController');
const QuestController   = require('../controllers/QuestController');
const ReviewController  = require('../controllers/ReviewController');
const FinanceController = require('../controllers/FinanceController');
const OrderController   = require('../controllers/OrderController');
const { requireAuth, adminOnly } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  }
});

// All admin routes require login + admin role
router.use(requireAuth, adminOnly);

// ─── Dashboard ────────────────────────────────────────────────
router.get('/dashboard',               AdminController.getDashboard);

// ─── Customers ───────────────────────────────────────────────
router.get('/customers/search',         AdminController.searchCustomers);  // ← BEFORE :id
router.get('/customers',                AdminController.getAllCustomers);

// ─── Orders ──────────────────────────────────────────────────
router.get('/orders',                   AdminController.getAllOrders);
router.post('/orders',                  AdminController.createOrder);
router.get('/orders/:id',               AdminController.getOrder);
router.patch('/orders/:id/status',      AdminController.updateOrderStatus);
router.patch('/orders/:id/profit',      OrderController.updateProfit);
router.post('/orders/:id/ship',         upload.single('shippingImage'), AdminController.shipOrder);
router.post('/orders/:id/refund',       upload.single('refundImage'), AdminController.refundOrder);
router.patch('/orders/:id/edit',        AdminController.updateOrderFields);
router.put('/orders/:id/items',         AdminController.updateOrderItems);
router.post('/orders/:id/request-payment', AdminController.requestFinalPayment);
router.get('/orders/:id/payments',    AdminController.getOrderPayments);
router.post('/orders/:id/payments',     AdminController.addOrderPayment);
router.delete('/orders/:id/payments/:paymentId', AdminController.deleteOrderPayment);

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
router.post('/orders',                  AdminController.createOrder);
router.get('/customers/search',         AdminController.searchCustomers);
 

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

// ─── Coupons ─────────────────────────────────────────────────
router.get('/coupons',                CouponController.getAll);
router.get('/coupons/:id',            CouponController.getOne);
router.post('/coupons',               CouponController.create);
router.put('/coupons/:id',            CouponController.update);
router.delete('/coupons/:id',         CouponController.remove);
router.get('/coupons/:id/claims',     CouponController.getClaims);

// ─── Quests ──────────────────────────────────────────────────
router.get('/quests',                 QuestController.getAll);
router.get('/quests/:id',             QuestController.getOne);
router.post('/quests',                QuestController.create);
router.put('/quests/:id',             QuestController.update);
router.delete('/quests/:id',          QuestController.remove);
router.get('/quests/:id/progress',    QuestController.getProgress);

// ─── Reviews ─────────────────────────────────────────────────
router.get('/reviews',                ReviewController.getAll);
router.put('/reviews/:id',            ReviewController.update);
router.delete('/reviews/:id',         ReviewController.remove);

// ─── Finance ─────────────────────────────────────────────────
router.get('/finance/summary',        FinanceController.getSummary);
router.get('/finance/expenses',       FinanceController.getExpenses);
router.post('/finance/expenses',      FinanceController.addExpense);
router.delete('/finance/expenses/:id', FinanceController.deleteExpense);

module.exports = router;