const Finance = require('../models/Finance');

class FinanceController {

  // GET /api/admin/finance/summary?start=YYYY-MM-DD&end=YYYY-MM-DD&groupBy=day|week|month
  static async getSummary(req, res) {
    try {
      const { start, end, groupBy } = req.query;
      
      // Default to last 30 days if no dates provided
      let startDate = start;
      let endDate = end;
      if (!startDate || !endDate) {
        const d = new Date();
        endDate = d.toISOString().split('T')[0];
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
      }

      const summary = await Finance.getSummary(startDate, endDate, groupBy || 'day');
      res.json(summary);
    } catch (err) {
      console.error('FinanceController.getSummary error:', err);
      res.status(500).json({ error: 'Failed to fetch financial summary' });
    }
  }

  // GET /api/admin/finance/expenses
  static async getExpenses(req, res) {
    try {
      const expenses = await Finance.getAllExpenses();
      res.json(expenses);
    } catch (err) {
      console.error('FinanceController.getExpenses error:', err);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  }

  // POST /api/admin/finance/expenses
  static async addExpense(req, res) {
    try {
      const { amount, category, description, expenseDate } = req.body;
      if (!amount || !category) {
        return res.status(400).json({ error: 'Amount and category are required' });
      }
      
      const exp = await Finance.createExpense(amount, category, description, expenseDate);
      res.status(201).json(exp);
    } catch (err) {
      console.error('FinanceController.addExpense error:', err);
      res.status(500).json({ error: 'Failed to add expense' });
    }
  }

  // DELETE /api/admin/finance/expenses/:id
  static async deleteExpense(req, res) {
    try {
      await Finance.deleteExpense(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('FinanceController.deleteExpense error:', err);
      res.status(500).json({ error: 'Failed to delete expense' });
    }
  }
}

module.exports = FinanceController;
