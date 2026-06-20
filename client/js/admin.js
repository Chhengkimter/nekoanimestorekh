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
        <button class="action-btn" onclick="openVariantModal('${p.id}', ${p.dbId})">Variants</button>
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
  modalImages = []; modalCats = [];
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
    modalImages = [...(p.images || [])];
    modalCats = [...(p.categories || (p.category ? [p.category] : []))];
    setStockStatusUI(p.stockStatus || 'instock');
  } else {
    document.getElementById('modal-title').textContent = 'Add product';
    ['f-name','f-price','f-inv','f-desc','f-discount'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('f-discount-type').checked = false;
    setStockStatusUI('instock');
  }
  renderCatPicker(); renderImagePreviews(); updateSalePreview();
  document.getElementById('modal-overlay').classList.add('open');
}

function setStockStatusUI(status) {
  document.querySelectorAll('.stock-status-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.status === status);
  });
  document.getElementById('inv-group').style.display = 'none';
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
  const desc = document.getElementById('f-desc').value.trim();
  const discount = parseFloat(document.getElementById('f-discount').value) || 0;
  const discountFlat = document.getElementById('f-discount-type').checked;
  const promotion = document.getElementById('f-promotion').value || null;

  if (!name || isNaN(price)) { toast('Fill in name and price', true); return; }
  if (modalCats.length === 0) { toast('Select at least one category', true); return; }

  const payload = {
    productName:        name,
    productPrice:       price,
    productDescription: desc,
    productStock:       0,
    discount,
    discountFlat,
    stockStatus,
    promotion,
    categories: modalCats.map(c => {
      const found = allCategoryObjects.find(x => x.category_name === c);
      return found ? found.category_id : null;
    }).filter(Boolean)
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

function openAddToInventoryModal() {
  // populate category filter
  const catSelect = document.getElementById('add-inv-cat-filter');
  catSelect.innerHTML = `<option value="All">All categories</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
  
  renderAddInvList();
  document.getElementById('add-inv-overlay').classList.add('open');
}

// ── INVENTORY ──────────────────────────────────────────────────
let activeVariantModalProductId = null;

function renderInventory() {
  const cats = ['All', ...categories];
  document.getElementById('inv-cat-row').innerHTML = cats.map(c =>
    `<div class="cat-chip ${c === invFilter ? 'active' : ''}" onclick="setInvFilter('${c}')">${c}</div>`
  ).join('');

  const q = (document.getElementById('inv-search')?.value || '').toLowerCase();

  const filtered = products.filter(p => {
    const inInv = p.stockStatus === 'instock' || p.stockStatus === 'both';
    if (!inInv) return false;
    const matchCat = invFilter === 'All' || (p.categories || []).includes(invFilter);
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  if (!filtered.length) {
    document.getElementById('inv-grid').innerHTML =
      `<div class="empty-state"><div class="es-icon">📦</div><p>No products in inventory</p></div>`;
    return;
  }

  document.getElementById('inv-grid').innerHTML =
    `<div class="inv-table-wrap">${filtered.map(p => renderInvRow(p)).join('')}</div>`;
    
  if (expandedVariantProductId) {
    const p = products.find(x => String(x.id) === String(expandedVariantProductId));
    if (p && p.dbId) {
      apiFetch(`/products/${p.dbId}/variants`).then(r => {
        if (r.ok) r.json().then(variants => {
          if (p) p.variants = variants;
          const editorEl = document.getElementById(`variant-editor-${p.id}`);
          if (editorEl) editorEl.innerHTML = renderVariantEditor(p);
        });
      });
    }
  }
}

function renderInvRow(p) {
  const thumb = p.images && p.images[0]
    ? `<div class="inv-thumb"><img src="${p.images[0]}" onerror="this.style.opacity=.3"></div>`
    : `<div class="inv-thumb">📦</div>`;
  const cats = (p.categories || []).filter(Boolean).join(', ');
  const salePrice = calcSale(p.price, p.discount, p.discountFlat);
  const priceHtml = p.discount > 0
    ? `<span style="text-decoration:line-through;color:var(--muted);font-size:10px">$${Number(p.price).toFixed(2)}</span><br>
       <span style="color:var(--green);font-weight:700">$${salePrice}</span>`
    : `<span>$${Number(p.price).toFixed(2)}</span>`;
  const statusBadge = p.inventory === 0
    ? `<span class="badge badge-red">Out of stock</span>`
    : p.inventory <= 5
    ? `<span class="badge badge-amber">Low stock</span>`
    : `<span class="badge badge-green">In stock</span>`;

  return `
    <div class="inv-row" id="inv-row-${p.id}">
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
      <div style="display:flex;gap:6px">
        <button class="action-btn" style="font-size:10px"
                onclick="openVariantModal('${p.id}', ${p.dbId})">Variants</button>
        <button class="action-btn del" style="font-size:10px"
                onclick="removeFromInventory('${p.id}')">Remove</button>
      </div>
    </div>`;
}

function renderVariantEditor(p) {
  const variants = p.variants || [];
  const isPreorder = p.stockStatus === 'preorder';

  const totalLine = isPreorder ? '' : `
    <span style="font-size:11px;color:var(--muted);font-family:var(--mono)">
      Total stock: ${variants.reduce((s, v) => s + v.variant_stock, 0)}
    </span>`;

  return `
    <div class="variant-editor">
      <div class="variant-editor-header">
        <span>Variants for <strong>${p.name}</strong>${isPreorder ? ' <span class="badge badge-amber" style="margin-left:6px">Pre-order — labels only</span>' : ''}</span>
        ${totalLine}
      </div>

      ${variants.length === 0
        ? `<p style="font-size:12px;color:var(--muted);padding:12px 0">No variants yet. Add one below.</p>`
        : `<div class="variant-list" id="variant-list-${p.id}">
             ${variants.map(v => renderVariantRow(p.id, p.dbId, v, isPreorder)).join('')}
           </div>`
      }

      <div class="variant-add-row">
        <input type="text" id="new-variant-name-${p.id}"
               placeholder="Variant name (e.g. Size M / Red)"
               class="search-input" style="flex:1;width:auto">
        ${isPreorder ? '' : `
        <input type="number" id="new-variant-stock-${p.id}"
               placeholder="Stock" min="0"
               class="inv-qty-input" style="width:72px">`}
        <input type="text" id="new-variant-sku-${p.id}"
               placeholder="SKU (optional)"
               class="search-input" style="width:110px">
        <button class="add-btn" style="padding:7px 14px;font-size:12px"
                onclick="addVariant('${p.id}', ${p.dbId}, ${isPreorder})">+ Add</button>
      </div>
    </div>`;
}

function renderVariantRow(productLocalId, productDbId, v, isPreorder) {
  if (isPreorder) {
    return `
      <div class="variant-row" id="variant-row-${v.variant_id}">
        <div style="flex:1;font-size:13px;font-weight:600">${v.variant_name}</div>
        ${v.variant_sku ? `<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">${v.variant_sku}</div>` : ''}
        <button class="action-btn del" style="font-size:10px"
                onclick="deleteVariant('${productLocalId}', ${productDbId}, ${v.variant_id})">✕</button>
      </div>`;
  }

  return `
    <div class="variant-row" id="variant-row-${v.variant_id}">
      <div style="flex:1;font-size:13px;font-weight:600">${v.variant_name}</div>
      ${v.variant_sku ? `<div style="font-size:11px;color:var(--muted);font-family:var(--mono)">${v.variant_sku}</div>` : ''}
      <div class="inv-qty-col" style="min-width:auto">
        <button class="inv-adj-btn" onclick="adjustVariantStock('${productLocalId}', ${productDbId}, ${v.variant_id}, -1)">−</button>
        <input class="inv-qty-input" type="number" min="0" value="${v.variant_stock}"
               id="variant-stock-input-${v.variant_id}"
               onchange="setVariantStock('${productLocalId}', ${productDbId}, ${v.variant_id}, this.value)">
        <button class="inv-adj-btn" onclick="adjustVariantStock('${productLocalId}', ${productDbId}, ${v.variant_id}, 1)">+</button>
      </div>
      <span class="badge ${v.variant_stock === 0 ? 'badge-red' : v.variant_stock <= 3 ? 'badge-amber' : 'badge-green'}"
            id="variant-badge-${v.variant_id}">
        ${v.variant_stock === 0 ? 'Out' : v.variant_stock <= 3 ? 'Low' : 'OK'}
      </span>
      <button class="action-btn del" style="font-size:10px"
              onclick="deleteVariant('${productLocalId}', ${productDbId}, ${v.variant_id})">✕</button>
    </div>`;
}

async function toggleVariantEditor(productLocalId, productDbId) {
  if (String(expandedVariantProductId) === String(productLocalId)) {
    expandedVariantProductId = null;
    renderInventory();
    return;
  }

  // Load fresh variants from API before expanding
  const p = products.find(x => String(x.id) === String(productLocalId));
  if (p) {
    const varRes = await apiFetch(`/products/${productDbId}/variants`);
    if (varRes.ok) {
      p.variants = await varRes.json();
    }
  }

  expandedVariantProductId = productLocalId;
  renderInventory();
}

async function addVariant(productLocalId, productDbId, isPreorder) {
  const nameEl  = document.getElementById(`new-variant-name-${productLocalId}`);
  const stockEl = document.getElementById(`new-variant-stock-${productLocalId}`);
  const skuEl   = document.getElementById(`new-variant-sku-${productLocalId}`);

  const variantName  = nameEl.value.trim();
  const variantStock = isPreorder ? 0 : (parseInt(stockEl?.value) || 0);
  const variantSku   = skuEl.value.trim() || null;

  if (!variantName) { toast('Enter a variant name', true); return; }

  const res = await apiFetch(`/products/${productDbId}/variants`, {
    method: 'POST',
    body: JSON.stringify({ variantName, variantStock, variantSku })
  });
  if (!res.ok) { toast('Failed to add variant', true); return; }

  nameEl.value = ''; if (stockEl) stockEl.value = ''; skuEl.value = '';
  toast(`Variant "${variantName}" added ✓`);
  await reloadVariants(productLocalId, productDbId);
}

async function deleteVariant(productLocalId, productDbId, variantId) {
  if (!confirm('Delete this variant?')) return;
  const res = await apiFetch(`/products/${productDbId}/variants/${variantId}`, {
    method: 'DELETE'
  });
  if (!res.ok) { toast('Failed to delete variant', true); return; }
  toast('Variant deleted');
  await reloadVariants(productLocalId, productDbId);
}

async function setVariantStock(productLocalId, productDbId, variantId, val) {
  const n = parseInt(val);
  const stock = isNaN(n) || n < 0 ? 0 : n;
  const res = await apiFetch(`/products/${productDbId}/variants/${variantId}`, {
    method: 'PUT',
    body: JSON.stringify({ variantStock: stock })
  });
  if (!res.ok) { toast('Failed to update stock', true); return; }
  await reloadVariants(productLocalId, productDbId);
  renderStats();
}

async function adjustVariantStock(productLocalId, productDbId, variantId, delta) {
  const input = document.getElementById(`variant-stock-input-${variantId}`);
  const current = parseInt(input.value) || 0;
  const newStock = Math.max(0, current + delta);
  input.value = newStock;
  await setVariantStock(productLocalId, productDbId, variantId, newStock);
}

async function reloadVariants(productLocalId, productDbId) {
  const res = await apiFetch(`/products/${productDbId}/variants`);
  if (!res.ok) return;
  const variants = await res.json();
  const p = products.find(x => x.id === productLocalId);
  if (p) {
    p.variants = variants;
    p.inventory = variants.reduce((s, v) => s + v.variant_stock, 0);
  }

  if (activeVariantModalProductId === productLocalId) {
    const modalContent = document.getElementById('variant-modal-content');
    if (modalContent && p) modalContent.innerHTML = renderVariantEditor(p);
  }

  const rowEl = document.getElementById(`inv-row-${productLocalId}`);
  if (rowEl && p) {
    const qtyInput = rowEl.querySelector('.inv-qty-input');
    if (qtyInput) qtyInput.value = p.inventory;
    const badge = rowEl.querySelector('.inv-status-col');
    if (badge) badge.innerHTML = p.inventory === 0
      ? `<span class="badge badge-red">Out of stock</span>`
      : p.inventory <= 5
      ? `<span class="badge badge-amber">Low stock</span>`
      : `<span class="badge badge-green">In stock</span>`;
  }
  renderStats();
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
  const p = products.find(x => String(x.id) === String(id));
  if (!p) { toast('Product not found', true); return; }

  const res = await apiFetch(`/admin/products/${p.dbId}`, {
    method: 'PUT',
    body: JSON.stringify({ stockStatus: 'instock' })
  });
  if (!res.ok) { toast('Failed to add to inventory', true); return; }

  await loadProducts();
  renderStats();
  renderProducts();
  renderAddInvList();
  renderInventory();
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

// ── ADMIN: CREATE NEW ORDER ──────────────────────────────────────

let newOrderItems = [];
let newOrderCustomerMode = 'search'; // 'search' | 'guest'
let newOrderSelectedUser = null;

function openCreateOrderModal() {
  newOrderItems = [];
  newOrderCustomerMode = 'search';
  newOrderSelectedUser = null;

  document.getElementById('new-ord-customer-search').value = '';
  document.getElementById('new-ord-customer-results').innerHTML = '';
  document.getElementById('new-ord-guest-name').value = '';
  document.getElementById('new-ord-guest-email').value = '';
  document.getElementById('new-ord-phone1').value = '';
  document.getElementById('new-ord-phone2').value = '';
  document.getElementById('new-ord-addr-line1').value = '';
  document.getElementById('new-ord-addr-district').value = '';
  document.getElementById('new-ord-addr-city').value = '';
  document.getElementById('new-ord-addr-landmark').value = '';
  document.getElementById('new-ord-shipping-method').value = 'express';
  document.getElementById('new-ord-shipping-cost').value = '3.00';
  document.getElementById('new-ord-note').value = '';
  document.getElementById('new-ord-admin-note').value = '';

  setCustomerMode('search');
  renderNewOrderItems();
  document.getElementById('create-order-overlay').classList.add('open');
}

function closeCreateOrderModal() {
  document.getElementById('create-order-overlay').classList.remove('open');
}

function setCustomerMode(mode) {
  newOrderCustomerMode = mode;
  newOrderSelectedUser = null;
  document.getElementById('new-ord-mode-search').classList.toggle('selected', mode === 'search');
  document.getElementById('new-ord-mode-guest').classList.toggle('selected', mode === 'guest');
  document.getElementById('new-ord-search-panel').classList.toggle('hidden', mode !== 'search');
  document.getElementById('new-ord-guest-panel').classList.toggle('hidden', mode !== 'guest');
}

let customerSearchTimer;
function searchNewOrderCustomer() {
  clearTimeout(customerSearchTimer);
  const q = document.getElementById('new-ord-customer-search').value.trim();
  if (q.length < 2) {
    document.getElementById('new-ord-customer-results').innerHTML = '';
    return;
  }
  customerSearchTimer = setTimeout(async () => {
    const res = await apiFetch(`/admin/customers/search?q=${encodeURIComponent(q)}`);
    const users = res.ok ? await res.json() : [];

    document.getElementById('new-ord-customer-results').innerHTML = !users.length
      ? `<p style="font-size:12px;color:var(--muted);padding:8px 0">No customers found</p>`
      : users.map(u => `
        <div class="cust-search-row ${newOrderSelectedUser?.user_id === u.user_id ? 'selected' : ''}"
             onclick="selectNewOrderCustomer(${u.user_id}, '${u.first_name} ${u.last_name}', '${u.phone_number || ''}')">
          <div style="font-weight:700;font-size:13px">${u.first_name} ${u.last_name}</div>
          <div style="font-size:11px;color:var(--muted);font-family:var(--mono)">${u.email}${u.phone_number ? ' · ' + u.phone_number : ''}</div>
        </div>`).join('');
  }, 300);
}

function selectNewOrderCustomer(userId, name, phone) {
  newOrderSelectedUser = { user_id: userId, name };
  if (phone) document.getElementById('new-ord-phone1').value = phone;
  document.querySelectorAll('.cust-search-row').forEach(r => r.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  toast(`Selected ${name}`);
}

// ── ITEMS ──
function openNewOrderAddProductModal() {
  addProductCatFilter = 'All';
  document.getElementById('add-prod-search').value = '';
  const catSelect = document.getElementById('add-prod-cat-filter');
  catSelect.innerHTML = `<option value="All">All categories</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  // temporarily redirect the add-product modal's "add" action to the new-order flow
  window._addProductTarget = 'newOrder';
  renderAddProductListGeneric();
  document.getElementById('add-product-overlay').classList.add('open');
}

function renderAddProductListGeneric() {
  const q = document.getElementById('add-prod-search').value.toLowerCase();
  const cat = document.getElementById('add-prod-cat-filter').value;

  const filtered = products.filter(p => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    const matchCat = cat === 'All' || (p.categories || []).includes(cat);
    return matchQ && matchCat;
  });

  document.getElementById('add-product-list').innerHTML = !filtered.length
    ? `<div class="empty-state" style="padding:30px 20px"><div class="es-icon">🔍</div><p>No products match</p></div>`
    : filtered.map(p => {
        const thumb = p.images && p.images[0]
          ? `<img class="prod-thumb" src="${p.images[0]}" onerror="this.style.opacity=.3">`
          : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px">📦</div>`;
        const salePrice = calcSale(p.price, p.discount, p.discountFlat);
        const cats = (p.categories || []).join(', ');
        const handler = window._addProductTarget === 'newOrder'
          ? `addNewOrderItem('${p.id}')`
          : `addOrderItemFromModal('${p.id}')`;
        return `<div class="add-inv-row">
          ${thumb}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13px">${p.name}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:2px">#${p.id} · ${cats}</div>
          </div>
          <span style="font-family:var(--mono);font-weight:700;font-size:13px">$${salePrice}</span>
          <button class="add-btn" style="padding:7px 16px;font-size:12px;flex-shrink:0" onclick="${handler}">+ Add</button>
        </div>`;
      }).join('');
}

function addNewOrderItem(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const existing = newOrderItems.find(it => it.productId === p.dbId);
  if (existing) {
    existing.quantity += 1;
  } else {
    newOrderItems.push({
      productId:       p.dbId,
      productName:     p.name,
      image:           p.images?.[0] || null,
      selectedOption:  null,
      quantity:        1,
      priceAtPurchase: parseFloat(calcSale(p.price, p.discount, p.discountFlat)),
      itemNote:        ''
    });
  }
  toast(`"${p.name}" added`);
  closeAddProductModal();
  renderNewOrderItems();
}

function adjustNewOrderItemQty(i, delta) {
  newOrderItems[i].quantity = Math.max(1, newOrderItems[i].quantity + delta);
  renderNewOrderItems();
}

function removeNewOrderItem(i) {
  newOrderItems.splice(i, 1);
  renderNewOrderItems();
}

function calcNewOrderSubtotal() {
  return newOrderItems.reduce((sum, it) => sum + it.priceAtPurchase * it.quantity, 0);
}

function renderNewOrderItems() {
  const subtotal = calcNewOrderSubtotal();
  const shippingCost = parseFloat(document.getElementById('new-ord-shipping-cost')?.value) || 0;
  const total = subtotal + shippingCost;

  const itemsHtml = newOrderItems.map((it, i) => {
    const thumb = it.image
      ? `<img class="ord-item-thumb" src="${it.image}" onerror="this.style.opacity=.3">`
      : `<div class="ord-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
    return `<div class="ord-edit-item-row">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div class="ord-item-name">${it.productName}</div>
      </div>
      <div class="ord-item-qty-col">
        <button class="inv-adj-btn" onclick="adjustNewOrderItemQty(${i}, -1)">−</button>
        <span style="width:32px;text-align:center;font-family:var(--mono)">${it.quantity}</span>
        <button class="inv-adj-btn" onclick="adjustNewOrderItemQty(${i}, 1)">+</button>
      </div>
      <div class="ord-item-price">$${(it.priceAtPurchase * it.quantity).toFixed(2)}</div>
      <button class="action-btn del" onclick="removeNewOrderItem(${i})">Remove</button>
    </div>`;
  }).join('');

  document.getElementById('new-ord-items-list').innerHTML =
    itemsHtml || `<p style="font-size:12px;color:var(--muted)">No items added yet</p>`;
  document.getElementById('new-ord-totals').innerHTML = `
    <div class="ord-detail-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
    <div class="ord-detail-row"><span>Shipping</span><span>$${shippingCost.toFixed(2)}</span></div>
    <div class="receipt-divider"></div>
    <div class="ord-detail-row receipt-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>`;
}

// ── SUBMIT ──
async function submitNewOrder() {
  const phone1 = document.getElementById('new-ord-phone1').value.trim();
  const addrLine1 = document.getElementById('new-ord-addr-line1').value.trim();

  if (!phone1) { toast('Phone number is required', true); return; }
  if (!addrLine1) { toast('Address is required', true); return; }
  if (!newOrderItems.length) { toast('Add at least one item', true); return; }

  let customerPayload = {};
  if (newOrderCustomerMode === 'search') {
    if (!newOrderSelectedUser) { toast('Select a customer or switch to walk-in', true); return; }
    customerPayload = { userId: newOrderSelectedUser.user_id };
  } else {
    const guestName = document.getElementById('new-ord-guest-name').value.trim();
    if (!guestName) { toast('Guest name is required', true); return; }
    customerPayload = {
      guestName,
      guestEmail: document.getElementById('new-ord-guest-email').value.trim() || null
    };
  }

  const payload = {
    ...customerPayload,
    phone1,
    phone2: document.getElementById('new-ord-phone2').value.trim() || null,
    addrType: 'manual',
    addrLine1,
    addrDistrict: document.getElementById('new-ord-addr-district').value.trim(),
    addrCity: document.getElementById('new-ord-addr-city').value.trim(),
    addrLandmark: document.getElementById('new-ord-addr-landmark').value.trim(),
    shippingMethod: document.getElementById('new-ord-shipping-method').value,
    shippingCost: parseFloat(document.getElementById('new-ord-shipping-cost').value) || 0,
    orderNote: document.getElementById('new-ord-note').value.trim(),
    adminNote: document.getElementById('new-ord-admin-note').value.trim(),
    items: newOrderItems.map(it => ({
      productId: it.productId,
      selectedOption: it.selectedOption,
      quantity: it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemNote: it.itemNote
    }))
  };

  const res = await apiFetch('/admin/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    toast(err.error || 'Failed to create order', true);
    return;
  }

  toast('Order created ✓');
  closeCreateOrderModal();
  await loadOrders();
  renderOrders();
}

async function openVariantModal(productLocalId, productDbId) {
  const p = products.find(x => String(x.id) === String(productLocalId));
  if (!p) return;

  const varRes = await apiFetch(`/products/${productDbId}/variants`);
  if (varRes.ok) p.variants = await varRes.json();

  activeVariantModalProductId = productLocalId;
  document.getElementById('variant-modal-title').textContent = `Variants — ${p.name}`;
  document.getElementById('variant-modal-content').innerHTML = renderVariantEditor(p);
  document.getElementById('variant-modal-overlay').classList.add('open');
}

function closeVariantModal() {
  activeVariantModalProductId = null;
  document.getElementById('variant-modal-overlay').classList.remove('open');
  if (document.getElementById('sec-products').classList.contains('active')) renderProducts();
  if (document.getElementById('sec-inventory').classList.contains('active')) renderInventory();
}