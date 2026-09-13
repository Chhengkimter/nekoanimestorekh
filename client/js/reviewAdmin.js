// reviewAdmin.js

let allReviews = [];
let currentReviewTab = 'all';
let editReviewId = null;
let currentReviewLinkedProducts = [];

async function loadReviews() {
  const container = document.getElementById('review-table-body');
  if (container) container.innerHTML = '<div class="ord-loading">Loading reviews…</div>';
  try {
    const res = await apiFetch('/admin/reviews?_=' + Date.now());
    if (!res || !res.ok) {
      allReviews = [];
      renderReviews();
      return;
    }
    const data = await res.json();
    allReviews = Array.isArray(data) ? data : [];
    renderReviews();
  } catch (err) {
    console.error('loadReviews error:', err);
    allReviews = [];
    renderReviews();
  }
}

function setReviewTab(btn) {
  document.querySelectorAll('#rev-status-tabs .ord-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentReviewTab = btn.dataset.status || 'all';
  renderReviews();
}

function renderReviews() {
  const container = document.getElementById('review-table-body');
  if (!container) return;
  
  if (!Array.isArray(allReviews)) {
    allReviews = [];
  }

  const filtered = currentReviewTab === 'all' 
    ? allReviews 
    : allReviews.filter(r => r && (r.status || 'pending').toLowerCase() === currentReviewTab.toLowerCase());
  
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="padding:40px 20px"><div class="es-icon">⭐</div><p>No reviews found</p></div>';
    return;
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>User</th>
          <th>Product</th>
          <th>Rating</th>
          <th>Review Text</th>
          <th>Date</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach(r => {
    const ratingVal = parseInt(r.rating) || 5;
    const clampedRating = Math.max(1, Math.min(5, ratingVal));
    const stars = '★'.repeat(clampedRating) + '☆'.repeat(5 - clampedRating);
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '—';
    const status = (r.status || 'pending').toLowerCase();
    
    // Check if it is linked to multiple products
    let linkedText = '';
    if (r.linked_products && Array.isArray(r.linked_products) && r.linked_products.length > 0) {
      linkedText = `<div style="font-size:11px;color:var(--muted)">Linked to ${r.linked_products.length} others</div>`;
    }

    const reviewText = (r.review_text || '').replace(/"/g, '&quot;');
    const userName = `${r.first_name || 'Anonymous'} ${r.last_name || ''}`.trim();
    const productName = r.product_name || 'Product';
    const productUrl = r.product_id ? `../pages/productpage.html?id=${r.product_id}#review-${r.review_id}` : '#';

    html += `
      <tr>
        <td>
          <div style="font-weight:600">${userName}</div>
          <div style="font-size:12px;color:var(--muted)">${r.email || ''}</div>
        </td>
        <td>
          <div style="font-weight:600">
            ${r.product_id ? `<a href="${productUrl}" target="_blank" rel="noopener" style="color:var(--accent); text-decoration:underline;">${productName} ↗</a>` : productName}
          </div>
          ${linkedText}
        </td>
        <td style="color:#ffd700;font-size:14px">${stars}</td>
        <td>
          <div style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reviewText}">
            ${reviewText || '<i style="color:var(--muted)">No text</i>'}
          </div>
          ${r.product_id ? `<div style="margin-top:4px;">
            <a href="${productUrl}" target="_blank" rel="noopener" style="color:var(--accent); font-size:11px; font-weight:600; text-decoration:underline;">
              🔗 View on Store Page ↗
            </a>
          </div>` : ''}
          ${r.image_url ? `<div style="margin-top:5px; display:flex; gap:10px; flex-wrap:wrap;">
            ${r.image_url.split(',').map((url, i) => `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:11px;"><i class="fa fa-image"></i> Image ${i + 1}</a>`).join('')}
          </div>` : ''}
          ${r.admin_note ? `<div style="font-size:11px;color:var(--accent)">Note: ${r.admin_note}</div>` : ''}
        </td>
        <td>${date}</td>
        <td style="text-align:right">
          <div class="action-btns" style="justify-content:flex-end; align-items:center; gap:6px;">
            ${status === 'pending' ? `
              <button class="action-btn" onclick="updateReviewStatus(${r.review_id}, 'approved')" style="color:green;border-color:green">Approve</button>
              <button class="action-btn del" onclick="updateReviewStatus(${r.review_id}, 'rejected')">Reject</button>
            ` : `
              <span class="badge ${status === 'approved' ? 'badge-green' : 'badge-red'}" style="margin-right:6px;">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            `}
            <button class="action-btn" onclick="openReviewActionModal(${r.review_id})">More</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

async function updateReviewStatus(reviewId, status) {
  try {
    const res = await apiFetch(`/admin/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error();
    toast('Review ' + status);
    await loadReviews();
  } catch (err) {
    toast('Failed to update review status', true);
  }
}

async function openReviewActionModal(reviewId) {
  editReviewId = reviewId;
  const r = allReviews.find(x => x.review_id === reviewId);
  if (!r) return;

  document.getElementById('rev-admin-note').value = r.admin_note || '';

  currentReviewLinkedProducts = [...(r.linked_products || [])];
  renderReviewLinkedProducts();

  // Setup delete button
  const delBtn = document.getElementById('rev-delete-btn');
  delBtn.onclick = async () => {
    if (!confirm('Are you sure you want to permanently delete this review?')) return;
    try {
      const delRes = await apiFetch(`/admin/reviews/${reviewId}`, { method: 'DELETE' });
      if (!delRes.ok) throw new Error();
      toast('Review deleted');
      closeReviewActionModal();
      loadReviews();
    } catch {
      toast('Failed to delete', true);
    }
  };

  document.getElementById('review-action-modal').classList.add('open');
}

function closeReviewActionModal() {
  document.getElementById('review-action-modal').classList.remove('open');
  editReviewId = null;
}

async function saveReviewAction() {
  if (!editReviewId) return;

  const adminNote = document.getElementById('rev-admin-note').value.trim();
  const linkedProductIds = currentReviewLinkedProducts.map(p => p.product_id);
  
  // We keep the current status
  const r = allReviews.find(x => x.review_id === editReviewId);
  
  try {
    const res = await apiFetch(`/admin/reviews/${editReviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status: r.status,
        adminNote: adminNote,
        linkedProductIds: linkedProductIds
      })
    });
    
    if (!res.ok) throw new Error();
    toast('Review updated');
    closeReviewActionModal();
    await loadReviews();
  } catch (err) {
    toast('Failed to update review', true);
  }
}

// ── NEW LINK PRODUCTS LOGIC ──
function renderReviewLinkedProducts() {
  const container = document.getElementById('rev-linked-products-list');
  if (currentReviewLinkedProducts.length === 0) {
    container.innerHTML = '<div style="color:var(--muted); font-size:12px">No products linked</div>';
    return;
  }
  container.innerHTML = currentReviewLinkedProducts.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border)">
      <span style="font-size:13px; font-weight:600">${p.product_name}</span>
      <button class="del-btn" style="border:none; background:transparent; color:#d94343; font-size:12px; cursor:pointer;" onclick="removeReviewProduct(${p.product_id})">Remove</button>
    </div>
  `).join('');
}

function removeReviewProduct(pid) {
  currentReviewLinkedProducts = currentReviewLinkedProducts.filter(x => x.product_id !== pid);
  renderReviewLinkedProducts();
}

function openAddReviewProductModal() {
  document.getElementById('add-rev-prod-search').value = '';
  
  // Populate category filter
  const catSelect = document.getElementById('add-rev-prod-cat-filter');
  if (catSelect && typeof categories !== 'undefined') {
    catSelect.innerHTML = `<option value="All">All categories</option>` +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  
  renderAddReviewProductList();
  document.getElementById('add-review-product-overlay').classList.add('open');
}

function closeAddReviewProductModal() {
  document.getElementById('add-review-product-overlay').classList.remove('open');
}

async function renderAddReviewProductList() {
  const container = document.getElementById('add-review-product-list');
  const query = document.getElementById('add-rev-prod-search').value.trim().toLowerCase();
  const catFilter = document.getElementById('add-rev-prod-cat-filter')?.value || 'All';
  
  try {
    const res = await apiFetch('/products');
    let fetchedProducts = await res.json();
    
    const r = allReviews.find(x => x.review_id === editReviewId);
    
    // filter out main product and already linked ones
    fetchedProducts = fetchedProducts.filter(p => p.product_id !== (r ? r.product_id : -1));
    fetchedProducts = fetchedProducts.filter(p => !currentReviewLinkedProducts.some(lp => lp.product_id === p.product_id));
    
    if (query) {
      fetchedProducts = fetchedProducts.filter(p => p.product_name.toLowerCase().includes(query) || String(p.product_id).includes(query));
    }
    
    if (catFilter !== 'All') {
      fetchedProducts = fetchedProducts.filter(p => {
        const cats = p.categories ? p.categories.split(', ') : [];
        return cats.includes(catFilter);
      });
    }
    
    if (fetchedProducts.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:30px 20px"><div class="es-icon">🔍</div><p>No products match</p></div>';
      return;
    }
    
    container.innerHTML = fetchedProducts.map(p => {
      const thumb = p.primary_image
        ? `<img class="prod-thumb" src="${p.primary_image}" onerror="this.style.opacity=.3">`
        : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px">📦</div>`;
      
      const cats = p.categories || 'No category';
      const handler = `addReviewProduct(${p.product_id}, '${p.product_name.replace(/'/g, "\\'")}')`;
      
      let finalPrice = p.product_price;
      if (typeof calcSale === 'function') {
         finalPrice = calcSale(p.product_price, p.discount_percentage, p.is_discount_flat === 1);
      } else {
         finalPrice = Number(p.product_price || 0).toFixed(2);
      }
      
      const dispId = 'PID' + String(p.product_id).padStart(6, '0');
      
      return `<div class="add-inv-row">
        ${thumb}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${p.product_name}</div>
          <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px">#${dispId} · ${cats}</div>
        </div>
        <span style="font-family:var(--mono);font-weight:700;font-size:13px">$${finalPrice}</span>
        <button class="add-btn" style="padding:7px 16px;font-size:12px;flex-shrink:0" onclick="${handler}">+ Add</button>
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div style="padding:16px; color:#d94343">Failed to load products</div>';
  }
}

function addReviewProduct(pid, pname) {
  currentReviewLinkedProducts.push({ product_id: pid, product_name: pname });
  renderReviewLinkedProducts();
  closeAddReviewProductModal();
}
