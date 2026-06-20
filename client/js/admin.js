// ── DATA ──
let products   = [];
let categories = [];
let editingId = null;
let modalImages = [];
let modalOptions = [];
let pendingDeleteId = null;
let activeFilter = 'All';
let invFilter = 'All';
let allCategoryObjects = []; // stores { category_id, category_name }

async function initApp() {
  await Promise.all([loadProducts(), loadCategories(), loadOrders()]);
  renderAll();
}

async function loadProducts() {
  const res = await apiFetch('/products');
  const data = await res.json();
  products = data.map(p => ({
    id:           p.product_code || p.product_id,
    dbId:         p.product_id,
    name:         p.product_name,
    categories:   p.categories ? p.categories.split(', ') : [],
    price:        parseFloat(p.product_price),
    discount:     parseFloat(p.discount)     || 0,
    discountFlat: p.discount_flat            || false,
    inventory:    p.product_stock,
    stockStatus:  p.stock_status,
    description:  p.product_description      || '',
    options:      [],
    images:       p.primary_image ? [p.primary_image] : [],
    promotion:    p.promotion                || null
  }));
}

async function loadCategories() {
  const res = await apiFetch('/admin/categories');
  allCategoryObjects = await res.json();
  categories = allCategoryObjects.map(c => c.category_name);
}

// ── NAVIGATION ──
function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelector('[data-section="' + name + '"]').classList.add('active');
  if (name === 'inventory') renderInventory();
  if (name === 'categories') renderCategories();
  if (name === 'orders') { loadOrders().then(renderOrders); }
}

// ── RENDER ALL ──
function renderAll() { renderStats(); renderProducts(); buildFilters(); renderOrders(); }
// ── STATS ──
function renderStats() {
  const total = products.length;
  const totalVal = products.reduce((a,p) => a + p.price * p.inventory, 0);
  const low = products.filter(p => p.inventory > 0 && p.inventory <= 5).length;
  const out = products.filter(p => p.inventory === 0).length;
  document.getElementById('stats-row').innerHTML =
    `<div class="stat-card"><div class="stat-label">Total products</div><div class="stat-value">${total}</div><div class="stat-sub">across ${categories.length} categories</div></div>
     <div class="stat-card"><div class="stat-label">Stock value</div><div class="stat-value">$${totalVal.toFixed(2)}</div><div class="stat-sub">retail estimate</div></div>
     <div class="stat-card"><div class="stat-label">Low stock</div><div class="stat-value stat-low">${low}</div><div class="stat-sub">≤ 5 units left</div></div>
     <div class="stat-card"><div class="stat-label">Out of stock</div><div class="stat-value stat-low">${out}</div><div class="stat-sub">need restocking</div></div>`;
}

// ── FILTERS ──
function buildFilters() {
  const cats = ['All', ...categories];
  document.getElementById('table-filters').innerHTML = cats.map(c =>
    `<button class="filter-btn ${c===activeFilter?'active':''}" onclick="setFilter('${c}')">${c}</button>`
  ).join('');
}
function setFilter(c) { activeFilter = c; buildFilters(); renderProducts(); }

// ── PRODUCTS TABLE ──
function renderProducts() {
  const q = (document.getElementById('prod-search')?.value||'').toLowerCase();
  const filtered = products.filter(p => {
    const mq = p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const cats = p.categories || (p.category ? [p.category] : []);
    const mc = activeFilter==='All' || cats.includes(activeFilter);
    return mq && mc;
  });
  if (!filtered.length) {
    document.getElementById('product-table-body').innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>No products found</p></div>`;
    return;
  }
  document.getElementById('product-table-body').innerHTML = `<table><thead><tr>
    <th style="width:36px"><input type="checkbox" id="select-all-products" onchange="toggleSelectAll(this.checked)"></th>
    <th>Product</th><th>Categories</th><th>Price</th><th>Inventory</th><th>Status</th><th>Actions</th>
  </tr></thead><tbody>${filtered.map(p => {
    const thumb = p.images&&p.images[0]
  ? `<img class="prod-thumb" src="${p.images[0]}" onerror="this.style.opacity=.3">`
  : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;font-size:22px">📦</div>`;
    const status = p.inventory===0
      ? `<span class="badge badge-red">Out of stock</span>`
      : p.inventory<=5
      ? `<span class="badge badge-amber">Low stock</span>`
      : `<span class="badge badge-green">In stock</span>`;
    const cats = (p.categories||[p.category]).filter(Boolean);
    const catBadges = cats.map(c=>`<span class="badge badge-purple" style="margin-right:3px">${c}</span>`).join('');
    const salePrice = calcSale(p.price, p.discount, p.discountFlat);
    const priceHtml = p.discount > 0
      ? `<span style="text-decoration:line-through;color:var(--muted);font-size:11px">$${Number(p.price).toFixed(2)}</span><br><span style="color:var(--green);font-weight:700">$${salePrice}</span>`
      : `<span style="font-weight:600">$${Number(p.price).toFixed(2)}</span>`;
    const isChecked = selectedProductIds.includes(p.id);
    return `<tr class="${isChecked ? 'row-selected' : ''}">
      <td><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleProductSelect('${p.id}', this.checked)"></td>
      <td><div class="prod-cell">${thumb}<div><div class="prod-name">${p.name}</div><div class="prod-id">#${p.id}</div></div></div></td>
      <td>${catBadges}</td>
      <td style="font-family:var(--mono)">${priceHtml}</td>
      <td style="font-family:var(--mono)">${p.inventory}</td>
      <td>${status}</td>
      <td><div class="action-btns">
        <button class="action-btn" onclick="openModal('${p.id}')">Edit</button>
        <button class="action-btn del" onclick="confirmDelete('${p.id}')">Delete</button>
      </div></td>
    </tr>`;
  }).join('')}</tbody></table>`;

  syncSelectAllCheckbox();
}

// ── MODAL ──
let modalCats = [];
function openModal(id) {
  editingId = id || null;
  modalImages = []; modalOptions = []; modalCats = [];
  renderCatPicker();
  if (id) {
    const p = products.find(x => x.id === id);
    document.getElementById('modal-title').textContent = 'Edit product';
    document.getElementById('f-name').value = p.name;
    document.getElementById('f-price').value = p.price;
    document.getElementById('f-inv').value = p.inventory;
    document.getElementById('f-desc').value = p.description;
    document.getElementById('f-discount').value = p.discount || 0;
    document.getElementById('f-discount-type').checked = p.discountFlat || false;
    modalOptions = [...(p.options || [])];
    modalImages = [...(p.images || [])];
    modalCats = [...(p.categories || (p.category ? [p.category] : []))];
    // set stock status buttons
    setStockStatusUI(p.stockStatus || 'instock');
  } else {
    document.getElementById('modal-title').textContent = 'Add product';
    ['f-name','f-price','f-inv','f-desc','f-discount'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('f-discount-type').checked = false;
    setStockStatusUI('instock');
  }
  renderCatPicker(); renderOptions(); renderImagePreviews(); updateSalePreview();
  document.getElementById('modal-overlay').classList.add('open');
}

function setStockStatusUI(status) {
  document.querySelectorAll('.stock-status-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.status === status);
  });
  // show/hide inventory qty field
  const invGroup = document.getElementById('inv-group');
  invGroup.style.display = (status === 'preorder') ? 'none' : '';
}

function selectStockStatus(status) {
  setStockStatusUI(status);
}

function getStockStatus() {
  const sel = document.querySelector('.stock-status-btn.selected');
  return sel ? sel.dataset.status : 'instock';
}
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

function renderCatPicker() {
  document.getElementById('f-cat-picker').innerHTML = categories.map(c =>
    `<div class="cat-pick-chip ${modalCats.includes(c)?'selected':''}" onclick="toggleCat('${c}')">${c}</div>`
  ).join('');
}
function toggleCat(c) {
  if (modalCats.includes(c)) modalCats = modalCats.filter(x=>x!==c);
  else modalCats.push(c);
  renderCatPicker();
}

function calcSale(price, discount, flat) {
  if (!discount || discount <= 0) return Number(price).toFixed(2);
  const d = flat ? Number(discount) : price * (discount/100);
  return Math.max(0, price - d).toFixed(2);
}
function updateSalePreview() {
  const price = parseFloat(document.getElementById('f-price').value)||0;
  const disc = parseFloat(document.getElementById('f-discount').value)||0;
  const flat = document.getElementById('f-discount-type').checked;
  const el = document.getElementById('sale-preview');
  if (disc > 0 && price > 0) {
    const sale = calcSale(price, disc, flat);
    const label = flat ? `$${disc} off` : `${disc}% off`;
    el.textContent = `Sale price: $${sale} (${label})`;
  } else {
    el.textContent = '';
  }
}

async function saveProduct() {
  const name = document.getElementById('f-name').value.trim();
  const price = parseFloat(document.getElementById('f-price').value);
  const stockStatus = getStockStatus();
  const inv = stockStatus === 'preorder' ? 0 : parseInt(document.getElementById('f-inv').value);
  const desc = document.getElementById('f-desc').value.trim();
  const discount = parseFloat(document.getElementById('f-discount').value) || 0;
  const discountFlat = document.getElementById('f-discount-type').checked;
  const promotion = document.getElementById('f-promotion').value || null;
  if (!name || isNaN(price)) { toast('Fill in name and price', true); return; }
  if (stockStatus !== 'preorder' && isNaN(inv)) { toast('Fill in inventory qty', true); return; }
  if (modalCats.length === 0) { toast('Select at least one category', true); return; }
  
  const payload = {
    productName:        name,
    productPrice:       price,
    productDescription: desc,
    productStock:       inv,
    discount,
    discountFlat,
    stockStatus,
    promotion,
    categories: modalCats.map(c => {
      const found = allCategoryObjects.find(x => x.category_name === c);
      return found ? found.category_id : null;
    }).filter(Boolean),
    options: modalOptions
  };

  if (editingId) {
    const p      = products.find(x => x.id === editingId);
    const res    = await apiFetch(`/admin/products/${p.dbId}`, {
      method: 'PUT',
      body:   JSON.stringify(payload)
    });
    if (!res.ok) { toast('Update failed', true); return; }
    toast('Product updated ✓');
  } else {
    const res = await apiFetch('/admin/products', {
      method: 'POST',
      body:   JSON.stringify(payload)
    });
    if (!res.ok) { toast('Add failed', true); return; }
    toast('Product added ✓');
  }

  await loadProducts();
  renderAll(); buildFilters(); closeModal();
}
// ── OPTIONS ──
function addOption() {
  const val = document.getElementById('opt-input').value.trim();
  if (val && !modalOptions.includes(val)) { modalOptions.push(val); document.getElementById('opt-input').value = ''; renderOptions(); }
}
function removeOption(i) { modalOptions.splice(i,1); renderOptions(); }
function renderOptions() {
  document.getElementById('options-tags').innerHTML = modalOptions.map((o,i) =>
    `<span class="option-tag">${o}<button onclick="removeOption(${i})">✕</button></span>`
  ).join('');
}

// ── IMAGES ──
function handleImageUpload(e) {
  Array.from(e.target.files).forEach(file => {
    if (file.size > 5*1024*1024) { toast('File too large (max 5MB)', true); return; }
    const reader = new FileReader();
    reader.onload = ev => { modalImages.push(ev.target.result); renderImagePreviews(); };
    reader.readAsDataURL(file);
  });
}
function addImageUrl() {
  const url = document.getElementById('url-input').value.trim();
  if (url) { modalImages.push(url); document.getElementById('url-input').value=''; renderImagePreviews(); }
}
function removeImage(i) { modalImages.splice(i,1); renderImagePreviews(); }
function renderImagePreviews() {
  document.getElementById('img-preview-row').innerHTML = modalImages.map((src,i) =>
    `<div class="img-preview-item"><img src="${src}" onerror="this.style.opacity=.3"><button onclick="removeImage(${i})">✕</button></div>`
  ).join('');
}

// ── DELETE ──
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-overlay').classList.add('open');
  
  document.getElementById('confirm-del-btn').onclick = async () => {
    const p   = products.find(x => x.id === id);
    const res = await apiFetch(`/admin/products/${p.dbId}`, { method: 'DELETE' });
    if (!res.ok) { toast('Delete failed', true); return; }
    await loadProducts();
    renderAll(); buildFilters(); closeConfirm(); toast('Product deleted');
  };
}
function closeConfirm() { document.getElementById('confirm-overlay').classList.remove('open'); }

// ── INVENTORY ──
function renderInventory() {
  const cats = ['All', ...categories];
  document.getElementById('inv-cat-row').innerHTML = cats.map(c =>
    `<div class="cat-chip ${c === invFilter ? 'active' : ''}" onclick="setInvFilter('${c}')">${c}</div>`
  ).join('');

  const q = (document.getElementById('inv-search')?.value || '').toLowerCase();

  const filtered = products.filter(p => {
    const inInv = p.stockStatus === 'instock' || p.stockStatus === 'both';
    if (!inInv) return false;
    const matchCat = invFilter === 'All' || (p.categories || [p.category] || []).includes(invFilter);
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (!filtered.length) {
    document.getElementById('inv-grid').innerHTML = `<div class="empty-state"><div class="es-icon">📦</div><p>No products in inventory</p></div>`;
    return;
  }

  document.getElementById('inv-grid').innerHTML = `<div class="inv-table-wrap">${filtered.map(p => {
    const thumb = p.images && p.images[0]
      ? `<div class="inv-thumb"><img src="${p.images[0]}" onerror="this.style.opacity=.3"></div>`
      : `<div class="inv-thumb">📦</div>`;
    const cats = (p.categories || [p.category]).filter(Boolean).join(', ');
    const salePrice = calcSale(p.price, p.discount, p.discountFlat);
    const priceHtml = p.discount > 0
      ? `<span style="text-decoration:line-through;color:var(--muted);font-size:10px">$${Number(p.price).toFixed(2)}</span><br><span style="color:var(--green);font-weight:700">$${salePrice}</span>`
      : `<span style="color:var(--text)">$${Number(p.price).toFixed(2)}</span>`;
    const statusBadge = p.inventory === 0
      ? `<span class="badge badge-red">Out of stock</span>`
      : p.inventory <= 5
      ? `<span class="badge badge-amber">Low stock</span>`
      : `<span class="badge badge-green">In stock</span>`;
    return `<div class="inv-row">
      ${thumb}
      <div class="inv-info">
        <div class="inv-info-name">${p.name}</div>
        <div class="inv-info-meta">#${p.id} · ${cats}</div>
      </div>
      <div class="inv-price-col">${priceHtml}</div>
      <div class="inv-qty-col">
        <button class="inv-adj-btn" onclick="adjustInv('${p.id}',-1)">−</button>
        <input class="inv-qty-input" type="number" min="0" value="${p.inventory}"
          onchange="setInv('${p.id}', this.value)"
          oninput="this.value=this.value.replace(/[^0-9]/g,'')">
        <button class="inv-adj-btn" onclick="adjustInv('${p.id}',1)">+</button>
      </div>
      <div class="inv-status-col">${statusBadge}</div>
      <div>
        <button class="action-btn del" style="font-size:10px" onclick="removeFromInventory('${p.id}')">Remove</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

async function removeFromInventory(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const res = await apiFetch('/admin/inventory/adjust', {
    method: 'POST',
    body:   JSON.stringify({ productId: p.dbId, newQty: 0, note: 'Moved to pre-order' })
  });
  if (!res.ok) { toast('Failed to remove from inventory', true); return; }
  await loadProducts();
  renderInventory(); renderStats(); renderProducts();
  toast(`"${p.name}" moved to pre-order`);
}

async function addToInventory(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const res = await apiFetch('/admin/inventory/restock', {
    method: 'POST',
    body:   JSON.stringify({ productId: p.dbId, quantity: 1, note: 'Added to inventory' })
  });
  if (!res.ok) { toast('Failed to add to inventory', true); return; }
  await loadProducts();
  renderStats(); renderProducts();
  renderAddInvList();
  toast(`"${p.name}" added to inventory ✓`);
}

function renderAddInvList() {
  const q = (document.getElementById('add-inv-search')?.value || '').toLowerCase();
  const cat = document.getElementById('add-inv-cat-filter')?.value || 'All';

  const eligible = products.filter(p => {
    const isPreorder = !p.stockStatus || p.stockStatus === 'preorder';
    if (!isPreorder) return false;
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const matchCat = cat === 'All' || (p.categories || []).includes(cat);
    return matchQ && matchCat;
  });

  document.getElementById('add-inv-list').innerHTML = !eligible.length
    ? `<div class="empty-state" style="padding:30px 20px">
        <div class="es-icon">✓</div>
        <p>${q || cat !== 'All' ? 'No products match your search' : 'All products are already in inventory'}</p>
       </div>`
    : eligible.map(p => {
        const thumb = p.images && p.images[0]
          ? `<img class="prod-thumb" src="${p.images[0]}" onerror="this.style.opacity=.3">`
          : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px">📦</div>`;
        const cats = (p.categories || [p.category]).filter(Boolean).join(', ');
        return `<div class="add-inv-row" id="add-inv-row-${p.id}">
          ${thumb}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">${p.name}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px">#${p.id} · ${cats}</div>
          </div>
          <span class="badge badge-amber" style="flex-shrink:0">Pre-order</span>
          <button class="add-btn" style="padding:7px 16px;font-size:12px;flex-shrink:0" onclick="addToInventory('${p.id}')">+ Add</button>
        </div>`;
      }).join('');
}

function closeAddInvModal() {
  document.getElementById('add-inv-overlay').classList.remove('open');
  renderInventory();
}
function setInvFilter(c) { invFilter=c; renderInventory(); }

function adjustInv(id, delta) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const newQty = Math.max(0, p.inventory + delta);
  p.inventory = newQty;

  if (delta > 0) {
    // adding stock → use restock
    apiFetch('/admin/inventory/restock', {
      method: 'POST',
      body: JSON.stringify({ productId: p.dbId, quantity: delta, note: 'Admin adjustment' })
    });
  } else {
    // reducing stock → use adjust with new total
    apiFetch('/admin/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ productId: p.dbId, newQty, note: 'Admin adjustment' })
    });
  }

  // update UI without re-render (keep this part same as before)
  const rows = document.querySelectorAll('.inv-row');
  rows.forEach(row => {
    const meta = row.querySelector('.inv-info-meta');
    if (meta && meta.textContent.includes(id)) {
      row.querySelector('.inv-qty-input').value = p.inventory;
      const badge = row.querySelector('.inv-status-col');
      badge.innerHTML = p.inventory === 0
        ? `<span class="badge badge-red">Out of stock</span>`
        : p.inventory <= 5
        ? `<span class="badge badge-amber">Low stock</span>`
        : `<span class="badge badge-green">In stock</span>`;
    }
  });
  renderStats();
}

function setInv(id, val) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const n = parseInt(val);
  p.inventory = isNaN(n) || n < 0 ? 0 : n;
  apiFetch('/admin/inventory/adjust', {
    method: 'POST',
    body:   JSON.stringify({ productId: p.dbId, newQty: p.inventory })
  });
  renderStats();
  // update just the status badge without full re-render
  const rows = document.querySelectorAll('.inv-row');
  rows.forEach(row => {
    const input = row.querySelector('.inv-qty-input');
    if (input && row.querySelector('.inv-info-meta').textContent.includes(id)) {
      const badge = row.querySelector('.inv-status-col');
      badge.innerHTML = p.inventory===0
        ? `<span class="badge badge-red">Out of stock</span>`
        : p.inventory<=5
        ? `<span class="badge badge-amber">Low stock</span>`
        : `<span class="badge badge-green">In stock</span>`;
    }
  });
}

// ── CATEGORIES ──
let catDetailName = null;
let catDetailPendingRemovals = [];

function openCategoryDetail(catName) {
  catDetailName = catName;
  catDetailPendingRemovals = [];
  renderCategoryDetail();   // ← this runs FIRST, while sec-cat-detail is still hidden
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-cat-detail').classList.add('active');
}

function closeCategoryDetail() {
  catDetailName = null;
  catDetailPendingRemovals = [];
  switchSection('categories');
}

function renderCategoryDetail() {
  const prods = products.filter(p => (p.categories||[p.category]||[]).includes(catDetailName));
  const hasPending = catDetailPendingRemovals.length > 0;

  document.getElementById('cat-detail-content').innerHTML = `
    <div class="cat-detail-header">
      <button class="cat-back-btn" onclick="closeCategoryDetail()">
        ← Back
      </button>
      <div>
        <div class="cat-detail-title">${catDetailName}</div>
        <div class="cat-detail-sub">${prods.length} product${prods.length!==1?'s':''}</div>
      </div>
      <div class="cat-detail-actions">
        ${hasPending ? `<span class="pending-badge">⚠ ${catDetailPendingRemovals.length} pending removal</span>` : ''}
        <button class="btn-cancel" onclick="cancelCategoryEdits()" ${!hasPending?'style="opacity:.4;pointer-events:none"':''}>Cancel</button>
        <button class="btn-save" onclick="saveCategoryEdits()" ${!hasPending?'style="opacity:.4;pointer-events:none"':''}>Save changes</button>
      </div>
    </div>
    <div class="table-wrap">
      ${!prods.length
        ? `<div class="empty-state"><div class="es-icon"></div><p>No products in this category</p></div>`
        : `<table><thead><tr>
            <th>Product</th><th>Price</th><th>Inventory</th><th>Status</th><th>Remove</th>
           </tr></thead><tbody>
           ${prods.map(p => {
             const isPending = catDetailPendingRemovals.includes(p.id);
             const thumb = p.images && p.images[0]
               ? `<img class="prod-thumb" src="${p.images[0]}" onerror="this.style.opacity=.3">`
               : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
             const status = p.inventory===0
               ? `<span class="badge badge-red">Out of stock</span>`
               : p.inventory<=5
               ? `<span class="badge badge-amber">Low stock</span>`
               : `<span class="badge badge-green">In stock</span>`;
             const salePrice = calcSale(p.price, p.discount, p.discountFlat);
             const priceHtml = p.discount > 0
               ? `<span style="text-decoration:line-through;color:var(--muted);font-size:11px">$${Number(p.price).toFixed(2)}</span><br><span style="color:var(--green);font-weight:700">$${salePrice}</span>`
               : `$${Number(p.price).toFixed(2)}`;
             return `<tr style="${isPending ? 'opacity:.4;' : ''}">
               <td><div class="prod-cell">${thumb}
                 <div>
                   <div class="prod-name" style="${isPending ? 'text-decoration:line-through' : ''}">${p.name}</div>
                   <div class="prod-id">#${p.id}</div>
                 </div>
               </div></td>
               <td style="font-family:var(--mono)">${priceHtml}</td>
               <td style="font-family:var(--mono)">${p.inventory}</td>
               <td>${status}</td>
               <td>
                 ${isPending
                   ? `<button class="action-btn" onclick="undoRemoveFromCat('${p.id}')">Undo</button>`
                   : `<button class="action-btn del" onclick="markRemoveFromCat('${p.id}')">Remove</button>`
                 }
               </td>
             </tr>`;
           }).join('')}
           </tbody></table>`
      }
    </div>`;
}

function markRemoveFromCat(prodId) {
  if (!catDetailPendingRemovals.includes(prodId)) catDetailPendingRemovals.push(prodId);
  renderCategoryDetail();
}

function undoRemoveFromCat(prodId) {
  catDetailPendingRemovals = catDetailPendingRemovals.filter(id => id !== prodId);
  renderCategoryDetail();
}

function cancelCategoryEdits() {
  catDetailPendingRemovals = [];
  renderCategoryDetail();
}

async function saveCategoryEdits() {
  if (!catDetailPendingRemovals.length) return;
  for (const prodId of catDetailPendingRemovals) {
    const p   = products.find(x => x.id === prodId);
    const cat = allCategoryObjects.find(c => c.category_name === catDetailName);
    if (!p || !cat) continue;
    const newCats = p.categories
      .filter(c => c !== catDetailName)
      .map(c => allCategoryObjects.find(x => x.category_name === c)?.category_id)
      .filter(Boolean);
    await apiFetch(`/admin/products/${p.dbId}`, {
      method: 'PUT',
      body:   JSON.stringify({ categories: newCats })
    });
  }
  const count = catDetailPendingRemovals.length;
  catDetailPendingRemovals = [];
  await loadProducts();
  renderAll(); buildFilters();
  toast(`Removed ${count} product${count!==1?'s':''} from "${catDetailName}" ✓`);
  renderCategoryDetail();
}

function renderCategories() {
  document.getElementById('cat-table-body').innerHTML = `<table>
    <thead><tr><th>Category name</th><th>Products</th><th>Actions</th></tr></thead>
    <tbody>${categories.map((c, i) => {
      const count = products.filter(p => (p.categories||[p.category]||[]).includes(c)).length;
      return `<tr style="cursor:pointer" onclick="openCategoryDetail('${c}')" title="Click to view products">
        <td style="font-weight:600">${c}
          <span style="font-size:10px;color:var(--muted);margin-left:6px;font-family:var(--mono)">→ view</span>
        </td>
        <td><span class="badge badge-purple">${count}</span></td>
        <td onclick="event.stopPropagation()"><div class="action-btns">
          <button class="action-btn" onclick="editCategory(${i})">Edit</button>
          <button class="action-btn del" onclick="deleteCategory(${i})">Delete</button>
        </div></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}
// ✅ addCategory()
async function addCategory() {
  const name = prompt('New category name:');
  if (!name || !name.trim() || categories.includes(name.trim())) return;
  const res = await apiFetch('/admin/categories', {
    method: 'POST',
    body:   JSON.stringify({ categoryName: name.trim() })
  });
  if (!res.ok) { toast('Failed to add category', true); return; }
  await loadCategories();
  renderCategories(); buildFilters(); toast('Category added ✓');
}

// ✅ editCategory()
async function editCategory(i) {
  const oldName = categories[i];
  const newName = prompt('Rename category:', oldName);
  if (!newName || !newName.trim() || newName.trim() === oldName) return;
  const trimmed = newName.trim();
  if (categories.includes(trimmed)) { toast(`"${trimmed}" already exists`, true); return; }
  const cat = allCategoryObjects.find(c => c.category_name === oldName);
  if (!cat) return;
  const res = await apiFetch(`/admin/categories/${cat.category_id}`, {
    method: 'PUT',
    body:   JSON.stringify({ categoryName: trimmed })
  });
  if (!res.ok) { toast('Rename failed', true); return; }
  await loadCategories();
  await loadProducts();
  renderCategories(); buildFilters(); renderAll();
  toast(`"${oldName}" renamed to "${trimmed}" ✓`);
}

// ✅ deleteCategory()
async function deleteCategory(i) {
  const name = categories[i];
  if (products.some(p => (p.categories||[]).includes(name))) {
    toast(`"${name}" is used by products`, true); return;
  }
  if (!confirm(`Delete category "${name}"?`)) return;
  const cat = allCategoryObjects.find(c => c.category_name === name);
  if (!cat) return;
  const res = await apiFetch(`/admin/categories/${cat.category_id}`, { method: 'DELETE' });
  if (!res.ok) { toast('Delete failed', true); return; }
  await loadCategories();
  renderCategories(); buildFilters(); toast('Category deleted');
}

// ── TOAST ──
let toastTimer;
function toast(msg, err=false) {
  const el = document.getElementById('toast');
  document.getElementById('toast-dot').className = 'toast-dot'+(err?' err':'');
  document.getElementById('toast-msg').textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

let selectedProductIds = [];

function toggleProductSelect(id, checked) {
  if (checked) {
    if (!selectedProductIds.includes(id)) selectedProductIds.push(id);
  } else {
    selectedProductIds = selectedProductIds.filter(x => x !== id);
  }
  renderBulkBar();
  syncSelectAllCheckbox();
}

function toggleSelectAll(checked) {
  const visibleIds = getCurrentlyFilteredProductIds();
  if (checked) {
    visibleIds.forEach(id => { if (!selectedProductIds.includes(id)) selectedProductIds.push(id); });
  } else {
    selectedProductIds = selectedProductIds.filter(id => !visibleIds.includes(id));
  }
  renderProducts();
  renderBulkBar();
}

function syncSelectAllCheckbox() {
  const all = document.getElementById('select-all-products');
  if (!all) return;
  const visibleIds = getCurrentlyFilteredProductIds();
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedProductIds.includes(id));
  all.checked = allSelected;
}

function getCurrentlyFilteredProductIds() {
  const q = (document.getElementById('prod-search')?.value || '').toLowerCase();
  return products.filter(p => {
    const mq = p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const cats = p.categories || (p.category ? [p.category] : []);
    const mc = activeFilter === 'All' || cats.includes(activeFilter);
    return mq && mc;
  }).map(p => p.id);
}

function clearSelection() {
  selectedProductIds = [];
  renderProducts();
  renderBulkBar();
}

function renderBulkBar() {
  const existing = document.getElementById('bulk-action-bar');
  if (existing) existing.remove();

  if (selectedProductIds.length === 0) return;

  const bar = document.createElement('div');
  bar.id = 'bulk-action-bar';
  bar.className = 'bulk-action-bar';
  bar.innerHTML = `
    <span class="bulk-count">${selectedProductIds.length} selected</span>
    <button class="btn-cancel" onclick="clearSelection()">Clear</button>
    <button class="btn-save" onclick="openBulkEditModal()">Bulk edit</button>
  `;
  document.body.appendChild(bar);
}

// ── BULK EDIT MODAL (add + remove categories) ──
let bulkAddCats    = [];
let bulkRemoveCats = [];

function openBulkEditModal() {
  if (!selectedProductIds.length) return;
  bulkAddCats = [];
  bulkRemoveCats = [];

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));

  document.getElementById('bulk-edit-summary').innerHTML = selectedProducts.map(p => {
    const cats = (p.categories || []).filter(Boolean);
    return `<div class="bulk-edit-prod-row">
      <span class="bulk-edit-prod-name">${p.name}</span>
      <span class="bulk-edit-prod-cats">${cats.map(c => `<span class="badge badge-purple">${c}</span>`).join(' ') || '<span style="color:var(--muted);font-size:11px">No categories</span>'}</span>
    </div>`;
  }).join('');

  document.getElementById('bulk-price').value = '';
  document.getElementById('bulk-discount').value = '';
  document.getElementById('bulk-discount-type').checked = false;
  renderBulkCatPicker();
  renderBulkRemoveCatPicker();

  document.getElementById('bulk-edit-overlay').classList.add('open');
}

function closeBulkEditModal() {
  document.getElementById('bulk-edit-overlay').classList.remove('open');
}

function renderBulkCatPicker() {
  document.getElementById('bulk-cat-picker').innerHTML = categories.map(c =>
    `<div class="cat-pick-chip ${bulkAddCats.includes(c) ? 'selected' : ''}" onclick="toggleBulkCat('${c}')">${c}</div>`
  ).join('');
}

function toggleBulkCat(c) {
  if (bulkAddCats.includes(c)) bulkAddCats = bulkAddCats.filter(x => x !== c);
  else bulkAddCats.push(c);
  renderBulkCatPicker();
}

// Remove picker only shows categories actually present across the current selection —
// no point offering to remove a category none of the selected products have
function renderBulkRemoveCatPicker() {
  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));
  const presentCats = [...new Set(selectedProducts.flatMap(p => p.categories || []))];

  document.getElementById('bulk-remove-cat-picker').innerHTML = presentCats.length
    ? presentCats.map(c =>
        `<div class="cat-pick-chip remove-chip ${bulkRemoveCats.includes(c) ? 'selected' : ''}" onclick="toggleBulkRemoveCat('${c}')">${c}</div>`
      ).join('')
    : `<p style="font-size:11px;color:var(--muted)">Selected products share no categories to remove</p>`;
}

function toggleBulkRemoveCat(c) {
  if (bulkRemoveCats.includes(c)) bulkRemoveCats = bulkRemoveCats.filter(x => x !== c);
  else bulkRemoveCats.push(c);
  renderBulkRemoveCatPicker();
}

// Applies in order: price (overwrite) -> discount (overwrite) -> add categories (union)
// -> remove categories (subtraction, applied after add so remove always wins on overlap).
// Guards against leaving any product with zero categories.
async function applyBulkEdit() {
  const priceVal    = document.getElementById('bulk-price').value.trim();
  const discountVal = document.getElementById('bulk-discount').value.trim();
  const discountFlat = document.getElementById('bulk-discount-type').checked;

  const newPrice    = priceVal    !== '' ? parseFloat(priceVal)    : null;
  const newDiscount = discountVal !== '' ? parseFloat(discountVal) : null;

  if (priceVal !== '' && isNaN(newPrice))       { toast('Invalid price', true); return; }
  if (discountVal !== '' && isNaN(newDiscount)) { toast('Invalid discount', true); return; }

  const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));
  if (!selectedProducts.length) return;

  // Pre-check: would any product end up with zero categories?
  if (bulkRemoveCats.length > 0) {
    const wouldGoEmpty = selectedProducts.some(p => {
      const existingCats = p.categories || [];
      const merged  = [...new Set([...existingCats, ...bulkAddCats])];
      const after   = merged.filter(c => !bulkRemoveCats.includes(c));
      return after.length === 0;
    });
    if (wouldGoEmpty) {
      toast('Cannot remove — at least one product would be left with no categories', true);
      return;
    }
  }

  let successCount = 0;

  for (const p of selectedProducts) {
    const payload = {};

    if (newPrice !== null)    payload.productPrice = newPrice;
    if (newDiscount !== null) { payload.discount = newDiscount; payload.discountFlat = discountFlat; }

    if (bulkAddCats.length > 0 || bulkRemoveCats.length > 0) {
      const existingCats = p.categories || [];
      const merged = [...new Set([...existingCats, ...bulkAddCats])];
      const finalNames = merged.filter(c => !bulkRemoveCats.includes(c));

      payload.categories = finalNames
        .map(name => allCategoryObjects.find(x => x.category_name === name)?.category_id)
        .filter(Boolean);
    }

    if (Object.keys(payload).length === 0) continue;

    const res = await apiFetch(`/admin/products/${p.dbId}`, {
      method: 'PUT',
      body:   JSON.stringify(payload)
    });
    if (res.ok) successCount++;
  }

  toast(`Updated ${successCount} of ${selectedProducts.length} product${selectedProducts.length !== 1 ? 's' : ''} ✓`);

  closeBulkEditModal();
  clearSelection();
  await loadProducts();
  renderAll();
}