// reviewAdmin.js

let allReviews = [];
let currentReviewTab = 'pending';
let editReviewId = null;

async function loadReviews() {
  try {
    const res = await apiFetch('/admin/reviews');
    if (!res.ok) throw new Error();
    allReviews = await res.json();
    renderReviews();
  } catch (err) {
    document.getElementById('review-table-body').innerHTML = '<div class="ord-loading">Failed to load reviews.</div>';
  }
}

function setReviewTab(btn) {
  document.querySelectorAll('#rev-status-tabs .ord-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentReviewTab = btn.dataset.status;
  renderReviews();
}

function renderReviews() {
  const container = document.getElementById('review-table-body');
  
  const filtered = allReviews.filter(r => r.status === currentReviewTab);
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="ord-loading">No reviews found.</div>';
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
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const date = new Date(r.created_at).toLocaleDateString();
    
    // Check if it is linked to multiple products
    let linkedText = '';
    if (r.linked_products && r.linked_products.length > 0) {
      linkedText = `<div style="font-size:11px;color:var(--muted)">Linked to ${r.linked_products.length} others</div>`;
    }

    html += `
      <tr>
        <td>
          <div style="font-weight:600">${r.first_name || 'Anonymous'} ${r.last_name || ''}</div>
          <div style="font-size:12px;color:var(--muted)">${r.email}</div>
        </td>
        <td>
          <div style="font-weight:600">${r.product_name}</div>
          ${linkedText}
        </td>
        <td style="color:#ffd700;font-size:14px">${stars}</td>
        <td>
          <div style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${r.review_text}">
            ${r.review_text}
          </div>
          ${r.admin_note ? `<div style="font-size:11px;color:var(--accent)">Note: ${r.admin_note}</div>` : ''}
        </td>
        <td>${date}</td>
        <td style="text-align:right">
          ${currentReviewTab !== 'approved' ? `<button class="act-btn" onclick="updateReviewStatus(${r.review_id}, 'approved')" style="color:green">Approve</button>` : ''}
          ${currentReviewTab !== 'rejected' ? `<button class="act-btn" onclick="updateReviewStatus(${r.review_id}, 'rejected')" style="color:red">Reject</button>` : ''}
          <button class="act-btn" onclick="openReviewActionModal(${r.review_id})">More</button>
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
    showToast('Review ' + status);
    loadReviews();
  } catch (err) {
    showToast('Failed to update review status', true);
  }
}

async function openReviewActionModal(reviewId) {
  editReviewId = reviewId;
  const r = allReviews.find(x => x.review_id === reviewId);
  if (!r) return;

  document.getElementById('rev-admin-note').value = r.admin_note || '';

  // Load products to link
  const select = document.getElementById('rev-link-products');
  try {
    const res = await apiFetch('/products');
    const products = await res.json();
    
    // Create options
    select.innerHTML = '';
    
    // We already know r.linked_products has the current links
    const linkedIds = (r.linked_products || []).map(p => p.product_id);
    
    products.forEach(p => {
      // Skip the original product, you can't unlink the main one
      if (p.product_id === r.product_id) return;
      
      const opt = document.createElement('option');
      opt.value = p.product_id;
      opt.textContent = p.product_name;
      opt.selected = linkedIds.includes(p.product_id);
      select.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }

  // Setup delete button
  const delBtn = document.getElementById('rev-delete-btn');
  delBtn.onclick = async () => {
    if (!confirm('Are you sure you want to permanently delete this review?')) return;
    try {
      const delRes = await apiFetch(`/admin/reviews/${reviewId}`, { method: 'DELETE' });
      if (!delRes.ok) throw new Error();
      showToast('Review deleted');
      closeReviewActionModal();
      loadReviews();
    } catch {
      showToast('Failed to delete', true);
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
  const select = document.getElementById('rev-link-products');
  const linkedProductIds = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));
  
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
    showToast('Review updated');
    closeReviewActionModal();
    loadReviews();
  } catch (err) {
    showToast('Failed to update review', true);
  }
}
