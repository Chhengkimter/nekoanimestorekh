// ── COUPON ADMIN JS ──────────────────────────────────────────
let allCoupons = [];
let editingCouponId = null;

// ── Load coupons from API ────────────────────────────────────
async function loadCoupons() {
  try {
    const res = await apiFetch('/admin/coupons');
    allCoupons = await res.json();
  } catch (e) { console.error('loadCoupons:', e); }
}

// ── Render stats row ─────────────────────────────────────────
function renderCouponStats() {
  const total = allCoupons.length;
  const active = allCoupons.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date())).length;
  const expired = allCoupons.filter(c => c.expires_at && new Date(c.expires_at) <= new Date()).length;
  const totalUsed = allCoupons.reduce((a, c) => a + (c.times_used || 0), 0);

  document.getElementById('coupon-stats-row').innerHTML =
    `<div class="stat-card"><div class="stat-label">Total coupons</div><div class="stat-value">${total}</div><div class="stat-sub">created</div></div>
     <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value" style="color:var(--green)">${active}</div><div class="stat-sub">available now</div></div>
     <div class="stat-card"><div class="stat-label">Expired</div><div class="stat-value stat-low">${expired}</div><div class="stat-sub">past expiry</div></div>
     <div class="stat-card"><div class="stat-label">Total uses</div><div class="stat-value">${totalUsed}</div><div class="stat-sub">claims used</div></div>`;
}

// ── Render coupons table ─────────────────────────────────────
function renderCoupons() {
  renderCouponStats();

  if (!allCoupons.length) {
    document.getElementById('coupon-table-body').innerHTML =
      `<div class="empty-state"><div class="es-icon">🎟️</div><p>No coupons yet</p></div>`;
    return;
  }

  document.getElementById('coupon-table-body').innerHTML = `<table>
    <thead><tr>
      <th>Code</th><th>Discount</th><th>Min spent</th><th>Uses</th><th>Status</th><th>Expires</th><th>Actions</th>
    </tr></thead>
    <tbody>${allCoupons.map(c => {
      const isExpired = c.expires_at && new Date(c.expires_at) <= new Date();
      const discountStr = c.discount_type === 'percent'
        ? `${c.discount_value}%` + (c.max_discount ? ` (max $${Number(c.max_discount).toFixed(2)})` : '')
        : `$${Number(c.discount_value).toFixed(2)}`;
      const status = !c.is_active
        ? `<span class="badge badge-grey">Inactive</span>`
        : isExpired
        ? `<span class="badge badge-red">Expired</span>`
        : `<span class="badge badge-green">Active</span>`;
      const usesStr = c.max_uses_total
        ? `${c.times_used} / ${c.max_uses_total}`
        : `${c.times_used} / ∞`;
      const expiresStr = c.expires_at
        ? new Date(c.expires_at).toLocaleDateString()
        : '—';
      const cats = c.applicable_categories || 'All categories';

      return `<tr style="cursor:pointer" onclick="openCouponDetail(${c.coupon_id})">
        <td><span style="font-weight:700; font-family:var(--mono); letter-spacing:.05em">${c.coupon_code}</span>
          <div style="font-size:10px; color:var(--muted); margin-top:2px">${c.description || ''}</div>
          <div style="font-size:9px; color:var(--accent); margin-top:2px">${cats}</div>
        </td>
        <td style="font-family:var(--mono); font-weight:600">${discountStr}</td>
        <td style="font-family:var(--mono)">$${Number(c.min_spent).toFixed(2)}</td>
        <td style="font-family:var(--mono)">${usesStr}</td>
        <td>${status}</td>
        <td style="font-family:var(--mono); font-size:11px">${expiresStr}</td>
        <td onclick="event.stopPropagation()"><div class="action-btns">
          <button class="action-btn" onclick="openCouponModal(${c.coupon_id})">Edit</button>
          <button class="action-btn del" onclick="deleteCoupon(${c.coupon_id})">Delete</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

// ── Open create/edit modal ───────────────────────────────────
function openCouponModal(couponId) {
  editingCouponId = couponId || null;
  document.getElementById('coupon-modal-title').textContent = couponId ? 'Edit coupon' : 'Create coupon';

  // Populate category checkboxes
  const catContainer = document.getElementById('cpn-categories');
  catContainer.innerHTML = categories.map(c => {
    const catObj = allCategoryObjects.find(x => x.category_name === c);
    return `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface)">
      <input type="checkbox" class="cpn-cat-check" value="${catObj?.category_id || ''}" data-name="${c}"> ${c}
    </label>`;
  }).join('');

  if (couponId) {
    const c = allCoupons.find(x => x.coupon_id === couponId);
    if (!c) return;
    document.getElementById('cpn-code').value = c.coupon_code;
    document.getElementById('cpn-type').value = c.discount_type;
    document.getElementById('cpn-value').value = c.discount_value;
    document.getElementById('cpn-max-discount').value = c.max_discount || '';
    document.getElementById('cpn-min-spent').value = c.min_spent || '';
    document.getElementById('cpn-max-uses').value = c.max_uses_total || '';
    document.getElementById('cpn-max-per-user').value = c.max_uses_per_user || 1;
    document.getElementById('cpn-active').value = String(c.is_active);
    document.getElementById('cpn-starts').value = c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : '';
    document.getElementById('cpn-expires').value = c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : '';
    document.getElementById('cpn-desc').value = c.description || '';

    // Check applicable categories
    const catIds = Array.isArray(c.category_ids) ? c.category_ids : [];
    document.querySelectorAll('.cpn-cat-check').forEach(cb => {
      cb.checked = catIds.includes(parseInt(cb.value));
    });
  } else {
    document.getElementById('cpn-code').value = '';
    document.getElementById('cpn-type').value = 'percent';
    document.getElementById('cpn-value').value = '';
    document.getElementById('cpn-max-discount').value = '';
    document.getElementById('cpn-min-spent').value = '';
    document.getElementById('cpn-max-uses').value = '';
    document.getElementById('cpn-max-per-user').value = '1';
    document.getElementById('cpn-active').value = 'true';
    document.getElementById('cpn-starts').value = '';
    document.getElementById('cpn-expires').value = '';
    document.getElementById('cpn-desc').value = '';
    document.querySelectorAll('.cpn-cat-check').forEach(cb => cb.checked = false);
  }

  document.getElementById('coupon-modal-overlay').classList.add('open');
}

function closeCouponModal() {
  document.getElementById('coupon-modal-overlay').classList.remove('open');
  editingCouponId = null;
}

// ── Save (create or update) ──────────────────────────────────
async function saveCoupon() {
  const code = document.getElementById('cpn-code').value.trim();
  const value = document.getElementById('cpn-value').value;
  if (!code || !value) { toast('Code and discount value are required', true); return; }

  const checkedCats = [...document.querySelectorAll('.cpn-cat-check:checked')].map(cb => parseInt(cb.value)).filter(Boolean);

  const body = {
    couponCode: code,
    description: document.getElementById('cpn-desc').value.trim() || null,
    discountType: document.getElementById('cpn-type').value,
    discountValue: parseFloat(value),
    minSpent: parseFloat(document.getElementById('cpn-min-spent').value) || 0,
    maxDiscount: parseFloat(document.getElementById('cpn-max-discount').value) || null,
    maxUsesTotal: parseInt(document.getElementById('cpn-max-uses').value) || null,
    maxUsesPerUser: parseInt(document.getElementById('cpn-max-per-user').value) || 1,
    startsAt: document.getElementById('cpn-starts').value || null,
    expiresAt: document.getElementById('cpn-expires').value || null,
    isActive: document.getElementById('cpn-active').value === 'true',
    categoryIds: checkedCats.length > 0 ? checkedCats : []
  };

  try {
    const url = editingCouponId ? `/admin/coupons/${editingCouponId}` : '/admin/coupons';
    const method = editingCouponId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json();
      toast(err.error || 'Failed to save coupon', true);
      return;
    }
    closeCouponModal();
    await loadCoupons();
    renderCoupons();
    toast(editingCouponId ? 'Coupon updated ✓' : 'Coupon created ✓');
  } catch (e) {
    toast('Error saving coupon', true);
  }
}

// ── Delete coupon ────────────────────────────────────────────
async function deleteCoupon(id) {
  if (!confirm('Delete this coupon? This cannot be undone.')) return;
  try {
    await apiFetch(`/admin/coupons/${id}`, { method: 'DELETE' });
    await loadCoupons();
    renderCoupons();
    toast('Coupon deleted');
  } catch (e) { toast('Failed to delete', true); }
}

// ── Coupon detail (claims view) ──────────────────────────────
async function openCouponDetail(couponId) {
  const coupon = allCoupons.find(c => c.coupon_id === couponId);
  if (!coupon) return;

  // Load claims
  let claims = [];
  try {
    const res = await apiFetch(`/admin/coupons/${couponId}/claims`);
    claims = await res.json();
  } catch (e) { console.error(e); }

  const discountStr = coupon.discount_type === 'percent'
    ? `${coupon.discount_value}%` + (coupon.max_discount ? ` (max $${Number(coupon.max_discount).toFixed(2)})` : '')
    : `$${Number(coupon.discount_value).toFixed(2)}`;
  const totalSaved = claims.filter(c => c.used_at).reduce((a, c) => a + parseFloat(c.saved_amount || 0), 0);

  document.getElementById('coupon-detail-content').innerHTML = `
    <div class="cat-detail-header">
      <button class="cat-back-btn" onclick="switchSection('coupons')">← Back</button>
      <div>
        <div class="cat-detail-title" style="font-family:var(--mono); letter-spacing:.08em">${coupon.coupon_code}</div>
        <div class="cat-detail-sub">${discountStr} off · ${coupon.applicable_categories || 'All categories'}</div>
      </div>
    </div>

    <div class="stats-row" style="margin-top:20px;">
      <div class="stat-card"><div class="stat-label">Times used</div><div class="stat-value">${coupon.times_used}</div></div>
      <div class="stat-card"><div class="stat-label">Total claimed</div><div class="stat-value">${claims.length}</div></div>
      <div class="stat-card"><div class="stat-label">Total saved</div><div class="stat-value" style="color:var(--green)">$${totalSaved.toFixed(2)}</div></div>
      <div class="stat-card"><div class="stat-label">Per user limit</div><div class="stat-value">${coupon.max_uses_per_user}</div></div>
    </div>

    <div class="table-wrap" style="margin-top:20px;">
      ${!claims.length
        ? `<div class="empty-state"><div class="es-icon">📋</div><p>No claims yet</p></div>`
        : `<table>
            <thead><tr>
              <th>User</th><th>Claimed</th><th>Used</th><th>Order</th><th>Order total</th><th>Saved</th>
            </tr></thead>
            <tbody>${claims.map(cl => {
              const name = `${cl.first_name || ''} ${cl.last_name || ''}`.trim() || cl.email;
              const claimedDate = new Date(cl.claimed_at).toLocaleDateString();
              const usedDate = cl.used_at ? new Date(cl.used_at).toLocaleDateString() : `<span class="badge badge-amber">Unused</span>`;
              return `<tr>
                <td><div style="font-weight:600">${name}</div><div style="font-size:10px;color:var(--muted)">${cl.email}</div></td>
                <td style="font-family:var(--mono); font-size:11px">${claimedDate}</td>
                <td>${usedDate}</td>
                <td style="font-family:var(--mono)">${cl.order_code || '—'}</td>
                <td style="font-family:var(--mono)">${cl.order_total ? '$' + Number(cl.order_total).toFixed(2) : '—'}</td>
                <td style="font-family:var(--mono); color:var(--green); font-weight:700">${cl.saved_amount ? '$' + Number(cl.saved_amount).toFixed(2) : '—'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>`
      }
    </div>`;

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-coupon-detail').classList.add('active');
}

// ── QUEST ADMIN JS ───────────────────────────────────────────
let allQuests = [];
let editingQuestId = null;

async function loadQuests() {
  try {
    const res = await apiFetch('/admin/quests');
    allQuests = await res.json();
  } catch (e) { console.error('loadQuests:', e); }
}

function renderQuests() {
  if (!allQuests.length) {
    document.getElementById('quest-table-body').innerHTML =
      `<div class="empty-state"><div class="es-icon">🏆</div><p>No quests created</p></div>`;
    return;
  }

  document.getElementById('quest-table-body').innerHTML = `<table>
    <thead><tr>
      <th>Quest name</th><th>Type & Target</th><th>Reward</th><th>Completions</th><th>Status</th><th>Expires</th><th>Actions</th>
    </tr></thead>
    <tbody>${allQuests.map(q => {
      const isExpired = q.expires_at && new Date(q.expires_at) <= new Date();
      const status = !q.is_active
        ? `<span class="badge badge-grey">Inactive</span>`
        : isExpired
        ? `<span class="badge badge-red">Expired</span>`
        : `<span class="badge badge-green">Active</span>`;
        
      const expiresStr = q.expires_at ? new Date(q.expires_at).toLocaleDateString() : '—';
      const rewardStr = q.reward_type === 'coupon' && q.reward_coupon_code
        ? `<span class="badge badge-amber">Coupon: ${q.reward_coupon_code}</span>`
        : `<span class="badge badge-grey">None</span>`;

      return `<tr>
        <td><div style="font-weight:600">${q.quest_name}</div>
            <div style="font-size:10px; color:var(--muted); margin-top:2px">${q.description || ''}</div>
        </td>
        <td>
          <div style="font-weight:600">${q.quest_type.replace('_', ' ')}</div>
          <div style="font-family:var(--mono); font-size:11px; color:var(--muted)">Target: ${q.target_value}</div>
        </td>
        <td>${rewardStr}</td>
        <td style="font-family:var(--mono)">${q.completions || 0}</td>
        <td>${status}</td>
        <td style="font-family:var(--mono); font-size:11px">${expiresStr}</td>
        <td onclick="event.stopPropagation()"><div class="action-btns">
          <button class="action-btn" onclick="openQuestModal(${q.quest_id})">Edit</button>
          <button class="action-btn del" onclick="deleteQuest(${q.quest_id})">Delete</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function openQuestModal(questId) {
  editingQuestId = questId || null;
  document.getElementById('quest-modal-title').textContent = questId ? 'Edit quest' : 'Create quest';

  // Populate reward coupon dropdown
  const cpnSelect = document.getElementById('qst-reward-coupon');
  cpnSelect.innerHTML = `<option value="">None</option>` + allCoupons
    .filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) > new Date()))
    .map(c => `<option value="${c.coupon_id}">${c.coupon_code}</option>`)
    .join('');

  if (questId) {
    const q = allQuests.find(x => x.quest_id === questId);
    if (!q) return;
    document.getElementById('qst-name').value = q.quest_name;
    document.getElementById('qst-type').value = q.quest_type;
    document.getElementById('qst-target').value = q.target_value;
    document.getElementById('qst-reward-coupon').value = q.reward_coupon_id || '';
    document.getElementById('qst-active').value = String(q.is_active);
    document.getElementById('qst-starts').value = q.starts_at ? new Date(q.starts_at).toISOString().slice(0, 16) : '';
    document.getElementById('qst-expires').value = q.expires_at ? new Date(q.expires_at).toISOString().slice(0, 16) : '';
    document.getElementById('qst-desc').value = q.description || '';
  } else {
    document.getElementById('qst-name').value = '';
    document.getElementById('qst-type').value = 'review_count';
    document.getElementById('qst-target').value = '1';
    document.getElementById('qst-reward-coupon').value = '';
    document.getElementById('qst-active').value = 'true';
    document.getElementById('qst-starts').value = '';
    document.getElementById('qst-expires').value = '';
    document.getElementById('qst-desc').value = '';
  }

  document.getElementById('quest-modal-overlay').classList.add('open');
}

function closeQuestModal() {
  document.getElementById('quest-modal-overlay').classList.remove('open');
  editingQuestId = null;
}

async function saveQuest() {
  const name = document.getElementById('qst-name').value.trim();
  if (!name) { toast('Quest name is required', true); return; }

  const body = {
    questName: name,
    description: document.getElementById('qst-desc').value.trim() || null,
    questType: document.getElementById('qst-type').value,
    targetValue: parseInt(document.getElementById('qst-target').value) || 1,
    rewardType: document.getElementById('qst-reward-coupon').value ? 'coupon' : 'none',
    rewardCouponId: document.getElementById('qst-reward-coupon').value || null,
    isActive: document.getElementById('qst-active').value === 'true',
    startsAt: document.getElementById('qst-starts').value || null,
    expiresAt: document.getElementById('qst-expires').value || null
  };

  try {
    const url = editingQuestId ? `/admin/quests/${editingQuestId}` : '/admin/quests';
    const method = editingQuestId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json();
      toast(err.error || 'Failed to save quest', true);
      return;
    }
    closeQuestModal();
    await loadQuests();
    renderQuests();
    toast(editingQuestId ? 'Quest updated ✓' : 'Quest created ✓');
  } catch (e) {
    toast('Error saving quest', true);
  }
}

async function deleteQuest(id) {
  if (!confirm('Delete this quest? This cannot be undone.')) return;
  try {
    await apiFetch(`/admin/quests/${id}`, { method: 'DELETE' });
    await loadQuests();
    renderQuests();
    toast('Quest deleted');
  } catch (e) { toast('Failed to delete', true); }
}
