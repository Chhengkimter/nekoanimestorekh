// financeAdmin.js

let financeChartInstance = null;
let currentFinanceRange = 'last30';
let financeOffset = 0; // 0 = current, negative = past, positive = future

function formatDateIso(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getFinanceDateRange() {
  const now = new Date();
  let startObj, endObj, label;

  if (currentFinanceRange === 'last30') {
    const endDaysAgo = -financeOffset * 30;
    endObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - endDaysAgo);
    startObj = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate() - 30);

    const sStr = startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const eStr = endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    label = `${sStr} – ${eStr}`;
  } else if (currentFinanceRange === 'thisMonth') {
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + financeOffset, 1);
    startObj = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    endObj = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

    label = targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (currentFinanceRange === 'thisYear') {
    const targetYear = now.getFullYear() + financeOffset;
    startObj = new Date(targetYear, 0, 1);
    endObj = new Date(targetYear, 11, 31);

    label = `${targetYear}`;
  }

  return {
    start: formatDateIso(startObj),
    end: formatDateIso(endObj),
    label
  };
}

function shiftFinancePeriod(dir) {
  financeOffset += dir;
  loadFinanceSummary();
}

function setFinanceRange(btn) {
  document.querySelectorAll('#fin-range-tabs .ord-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFinanceRange = btn.dataset.range;
  financeOffset = 0; // Reset to current period on tab switch
  
  // Auto-adjust group by based on range
  const groupBySelect = document.getElementById('fin-group-by');
  if (currentFinanceRange === 'last30' || currentFinanceRange === 'thisMonth') {
    groupBySelect.value = 'day';
  } else if (currentFinanceRange === 'thisYear') {
    groupBySelect.value = 'month';
  }

  loadFinanceSummary();
}

async function loadFinanceSummary() {
  const { start, end, label } = getFinanceDateRange();
  const periodLabelEl = document.getElementById('fin-period-label');
  if (periodLabelEl) periodLabelEl.textContent = label;

  const nextBtn = document.getElementById('fin-next-btn');
  if (nextBtn) {
    nextBtn.style.opacity = financeOffset >= 0 ? '0.4' : '1';
  }

  const groupBySelect = document.getElementById('fin-group-by');
  const groupBy = groupBySelect ? groupBySelect.value : 'day';
  
  try {
    const res = await apiFetch(`/admin/finance/summary?start=${start}&end=${end}&groupBy=${groupBy}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    
    renderFinanceSummary(data);
    loadExpenses(); // load expenses table
  } catch (err) {
    toast('Failed to load finance summary', true);
  }
}

function renderFinanceSummary(data) {
  // Update Cards
  const statsRow = document.getElementById('finance-stats-row');
  statsRow.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Revenue</div>
      <div class="stat-val" style="color:var(--accent)">$${data.totals.revenue.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Profit (Orders)</div>
      <div class="stat-val" style="color:green">$${data.totals.profit.toFixed(2)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Spending</div>
      <div class="stat-val" style="color:red">$${data.totals.expenses.toFixed(2)}</div>
    </div>
    <div class="stat-card" style="background:#f4f4f4">
      <div class="stat-label">Net Income</div>
      <div class="stat-val" style="color:${data.totals.net_income >= 0 ? '#111' : 'red'}">$${data.totals.net_income.toFixed(2)}</div>
    </div>
  `;

  // Draw Chart
  const ctx = document.getElementById('financeChart').getContext('2d');
  
  if (financeChartInstance) {
    financeChartInstance.destroy();
  }

  const labels = data.data.map(d => d.period);
  
  financeChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Revenue',
          data: data.data.map(d => d.revenue),
          backgroundColor: '#82659D',
          borderRadius: 4
        },
        {
          label: 'Profit',
          data: data.data.map(d => d.profit),
          backgroundColor: 'rgba(76, 175, 80, 0.8)',
          borderRadius: 4
        },
        {
          label: 'Expenses',
          data: data.data.map(d => -Math.abs(d.expenses)), // Show below 0
          backgroundColor: 'rgba(244, 67, 54, 0.8)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          ticks: {
            callback: function(value) {
              return '$' + value;
            }
          }
        }
      }
    }
  });
}

// ─── Expenses Table ────────────────────────────────────────────────

async function loadExpenses() {
  try {
    const res = await apiFetch('/admin/finance/expenses');
    if (!res.ok) throw new Error();
    const expenses = await res.json();
    renderExpenses(expenses);
  } catch (err) {
    document.getElementById('expense-table-body').innerHTML = '<div class="ord-loading">Failed to load expenses.</div>';
  }
}

function renderExpenses(expenses) {
  const container = document.getElementById('expense-table-body');
  
  if (expenses.length === 0) {
    container.innerHTML = '<div class="ord-loading">No expenses recorded.</div>';
    return;
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Description</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:right">Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  expenses.forEach(e => {
    html += `
      <tr>
        <td>${new Date(e.expense_date).toLocaleDateString()}</td>
        <td style="text-transform:capitalize">${e.category.replace('_', ' ')}</td>
        <td>${e.description || '-'}</td>
        <td style="text-align:right; font-weight:600; color:red">-$${parseFloat(e.amount).toFixed(2)}</td>
        <td style="text-align:right">
          <button class="action-btn del" onclick="deleteExpense(${e.expense_id})">Delete</button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ─── Add Expense Modal ─────────────────────────────────────────────

function openExpenseModal() {
  document.getElementById('expense-modal-overlay').classList.add('open');
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
}

function closeExpenseModal() {
  document.getElementById('expense-modal-overlay').classList.remove('open');
}

async function submitExpense() {
  const amount = document.getElementById('exp-amount').value;
  const category = document.getElementById('exp-category').value;
  const date = document.getElementById('exp-date').value;
  const desc = document.getElementById('exp-desc').value;

  if (!amount || amount <= 0) {
    toast('Please enter a valid amount', true);
    return;
  }

  try {
    const res = await apiFetch('/admin/finance/expenses', {
      method: 'POST',
      body: JSON.stringify({ amount, category, expenseDate: date, description: desc })
    });
    if (!res.ok) throw new Error();
    toast('Expense recorded ✓');
    closeExpenseModal();
    loadFinanceSummary(); // Reload everything
  } catch (err) {
    toast('Failed to record expense', true);
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense record?')) return;
  try {
    const res = await apiFetch(`/admin/finance/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    toast('Expense deleted ✓');
    loadFinanceSummary();
  } catch (err) {
    toast('Failed to delete expense', true);
  }
}
