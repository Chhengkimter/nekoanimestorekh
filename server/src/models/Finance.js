const db = require('../config/db');

class Finance {

  // ─── Get financial summary grouped by time ────────────────────────
  static async getSummary(startDate, endDate, groupBy = 'day') {
    // groupBy can be 'day', 'week', 'month'
    let dateTrunc = 'day';
    if (groupBy === 'week') dateTrunc = 'week';
    if (groupBy === 'month') dateTrunc = 'month';
    if (groupBy === 'year') dateTrunc = 'year';

    // Get Revenue and Order Profit
    const revenueRes = await db.query(
      `SELECT DATE_TRUNC($1, order_date) as period,
              SUM(total) as revenue,
              SUM(profit) as profit
       FROM orders
       WHERE order_status NOT IN ('cancelled', 'refunded')
         AND order_date >= $2 AND order_date <= $3
       GROUP BY period
       ORDER BY period ASC`,
      [dateTrunc, startDate, endDate]
    );

    // Get Expenses
    const expenseRes = await db.query(
      `SELECT DATE_TRUNC($1, expense_date) as period,
              SUM(amount) as expenses
       FROM expenses
       WHERE expense_date >= $2 AND expense_date <= $3
       GROUP BY period
       ORDER BY period ASC`,
      [dateTrunc, startDate, endDate]
    );

    // Merge results by period
    const merged = {};

    revenueRes.rows.forEach(r => {
      const p = new Date(r.period).toISOString().split('T')[0];
      merged[p] = {
        period: p,
        revenue: parseFloat(r.revenue || 0),
        profit: parseFloat(r.profit || 0),
        expenses: 0
      };
    });

    expenseRes.rows.forEach(r => {
      const p = new Date(r.period).toISOString().split('T')[0];
      if (!merged[p]) {
        merged[p] = {
          period: p,
          revenue: 0,
          profit: 0,
          expenses: 0
        };
      }
      merged[p].expenses = parseFloat(r.expenses || 0);
    });

    // Calculate net income
    const resultList = Object.values(merged).sort((a, b) => new Date(a.period) - new Date(b.period));
    resultList.forEach(m => {
      m.net_income = m.profit - m.expenses;
    });

    // Also return grand totals
    const totals = resultList.reduce((acc, curr) => {
      acc.revenue += curr.revenue;
      acc.profit += curr.profit;
      acc.expenses += curr.expenses;
      acc.net_income += curr.net_income;
      return acc;
    }, { revenue: 0, profit: 0, expenses: 0, net_income: 0 });

    return { data: resultList, totals };
  }

  // ─── Expenses CRUD ────────────────────────────────────────────────
  static async getAllExpenses() {
    const res = await db.query(`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC`);
    return res.rows;
  }

  static async createExpense(amount, category, description, expenseDate) {
    const res = await db.query(
      `INSERT INTO expenses (amount, category, description, expense_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [amount, category, description || null, expenseDate || new Date()]
    );
    return res.rows[0];
  }

  static async deleteExpense(id) {
    await db.query(`DELETE FROM expenses WHERE expense_id = $1`, [id]);
  }
}

module.exports = Finance;
