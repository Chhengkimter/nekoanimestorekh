// ── DATA ──
let products = JSON.parse(localStorage.getItem('neko_products') || '[]');
let categories = JSON.parse(localStorage.getItem('neko_cats') || '["Figures","Clothing","Accessories","Keychains","Posters","Stationery","Other"]');
let editingId = null;
let modalImages = [];
let modalOptions = [];
let pendingDeleteId = null;
let activeFilter = 'All';
let invFilter = 'All';

if (products.length === 0) {
  products = [
    { id:'PROD001', name:'Naruto Hokage Figure', categories:['Figures'], price:24.99, discount:0, discountFlat:false, inventory:12, stockStatus:'instock', description:'High-quality PVC figure of Naruto in Hokage outfit.', options:['Small','Large'], images:[] },
    { id:'PROD002', name:'Demon Slayer Hoodie', categories:['Clothing','Accessories'], price:34.99, discount:10, discountFlat:false, inventory:3, stockStatus:'instock', description:'Tanjiro-inspired unisex hoodie, soft fleece.', options:['S','M','L','XL'], images:[] },
    { id:'PROD003', name:'One Piece Keychain Set', categories:['Keychains','Accessories'], price:8.99, discount:0, discountFlat:false, inventory:45, stockStatus:'instock', description:'Set of 5 Straw Hat crew keychains.', options:[], images:[] },
    { id:'PROD004', name:'Attack on Titan Poster', categories:['Posters'], price:5.99, discount:2, discountFlat:true, inventory:0, stockStatus:'preorder', description:'A2 size glossy poster, Survey Corps design.', options:['A3','A2','A1'], images:[] },
  ];
  save();
}

function save() {
  localStorage.setItem('neko_products', JSON.stringify(products));
  localStorage.setItem('neko_cats', JSON.stringify(categories));
}
function genId() { return 'PROD' + String(Date.now()).slice(-6); }

// ── AUTH ──
const ADMINS = { admin: 'neko2024', rize: 'rize123' };

document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (ADMINS[u] && ADMINS[u] === p) {
    sessionStorage.setItem('neko_admin', u);
    document.getElementById('login-screen').classList.add('hide');
    setTimeout(() => {
      document.getElementById('app').classList.add('show');
      document.getElementById('logged-as').textContent = '@' + u;
      renderAll();
    }, 400);
  } else {
    const err = document.getElementById('login-err');
    err.style.display = 'block';
    setTimeout(() => err.style.display = 'none', 2500);
  }
});

function logout() {
  sessionStorage.removeItem('neko_admin');
  document.getElementById('app').classList.remove('show');
  document.getElementById('login-screen').classList.remove('hide');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

if (sessionStorage.getItem('neko_admin')) {
  document.getElementById('login-screen').classList.add('hide');
  document.getElementById('app').classList.add('show');
  document.getElementById('logged-as').textContent = '@' + sessionStorage.getItem('neko_admin');
  setTimeout(renderAll, 100);
}

// ── NAVIGATION ──
function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelector('[data-section="' + name + '"]').classList.add('active');
  if (name === 'inventory') renderInventory();
  if (name === 'categories') renderCategories();
}

// ── RENDER ALL ──
function renderAll() { renderStats(); renderProducts(); buildFilters(); }

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
    return `<tr>
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

function saveProduct() {
  const name = document.getElementById('f-name').value.trim();
  const price = parseFloat(document.getElementById('f-price').value);
  const stockStatus = getStockStatus();
  const inv = stockStatus === 'preorder' ? 0 : parseInt(document.getElementById('f-inv').value);
  const desc = document.getElementById('f-desc').value.trim();
  const discount = parseFloat(document.getElementById('f-discount').value) || 0;
  const discountFlat = document.getElementById('f-discount-type').checked;
  if (!name || isNaN(price)) { toast('Fill in name and price', true); return; }
  if (stockStatus !== 'preorder' && isNaN(inv)) { toast('Fill in inventory qty', true); return; }
  if (modalCats.length === 0) { toast('Select at least one category', true); return; }
  if (editingId) {
    const idx = products.findIndex(p => p.id === editingId);
    products[idx] = { ...products[idx], name, categories: modalCats, price, discount, discountFlat, inventory: inv, stockStatus, description: desc, options: modalOptions, images: modalImages };
    toast('Product updated ✓');
  } else {
    products.unshift({ id: genId(), name, categories: modalCats, price, discount, discountFlat, inventory: inv, stockStatus, description: desc, options: modalOptions, images: modalImages });
    toast('Product added ✓');
  }
  save(); renderAll(); buildFilters(); closeModal();
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
  document.getElementById('confirm-del-btn').onclick = () => {
    products = products.filter(p => p.id!==id);
    save(); renderAll(); buildFilters(); closeConfirm(); toast('Product deleted');
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
function removeFromInventory(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  p.stockStatus = 'preorder';
  save(); renderInventory(); renderStats(); renderProducts();
  toast(`"${p.name}" moved to pre-order`);
}

function openAddToInventoryModal() {
  categories.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('add-inv-overlay').classList.add('open');
  const sel = document.getElementById('add-inv-cat-filter');
  sel.innerHTML = '<option value="All">All categories</option>' +
  categories.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('add-inv-search').value = '';
  document.getElementById('add-inv-cat-filter').value = 'All';
  renderAddInvList();
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

function addToInventory(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  p.stockStatus = 'instock';
  if (!p.inventory) p.inventory = 0;
  save(); renderStats(); renderProducts();
  renderAddInvList();
  toast(`"${p.name}" added to inventory ✓`);
}

function closeAddInvModal() {
  document.getElementById('add-inv-overlay').classList.remove('open');
  renderInventory();
}
function setInvFilter(c) { invFilter=c; renderInventory(); }
function adjustInv(id, delta) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  p.inventory = Math.max(0, p.inventory + delta);
  save();
  // sync the input field value without full re-render
  const rows = document.querySelectorAll('.inv-row');
  rows.forEach(row => {
    const meta = row.querySelector('.inv-info-meta');
    if (meta && meta.textContent.includes(id)) {
      row.querySelector('.inv-qty-input').value = p.inventory;
      const badge = row.querySelector('.inv-status-col');
      badge.innerHTML = p.inventory===0
        ? `<span class="badge badge-red">Out of stock</span>`
        : p.inventory<=5
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
  save(); renderStats();
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
  renderCategoryDetail();
  document.getElementById('sec-categories').style.display = 'none';
  document.getElementById('sec-cat-detail').style.display = 'block';
}

function closeCategoryDetail() {
  catDetailName = null;
  catDetailPendingRemovals = [];
  document.getElementById('sec-cat-detail').style.display = 'none';
  document.getElementById('sec-categories').style.display = 'block';
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
        ? `<div class="empty-state"><div class="es-icon">🔍</div><p>No products in this category</p></div>`
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

function saveCategoryEdits() {
  if (!catDetailPendingRemovals.length) return;
  catDetailPendingRemovals.forEach(prodId => {
    const p = products.find(x => x.id === prodId);
    if (!p) return;
    if (p.categories) p.categories = p.categories.filter(c => c !== catDetailName);
    else if (p.category === catDetailName) p.category = null;
  });
  const count = catDetailPendingRemovals.length;
  catDetailPendingRemovals = [];
  save(); renderAll(); buildFilters();
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
function addCategory() {
  const name = prompt('New category name:');
  if (name && name.trim() && !categories.includes(name.trim())) {
    categories.push(name.trim()); save(); renderCategories(); buildFilters(); toast('Category added ✓');
  }
}
function editCategory(i) {
  const oldName = categories[i];
  const newName = prompt('Rename category:', oldName);
  if (!newName || !newName.trim()) return;
  const trimmed = newName.trim();
  if (trimmed === oldName) return;
  if (categories.includes(trimmed)) { toast(`"${trimmed}" already exists`, true); return; }

  // Update the category name everywhere it's used in products
  categories[i] = trimmed;
  products.forEach(p => {
    if (p.categories) {
      const idx = p.categories.indexOf(oldName);
      if (idx !== -1) p.categories[idx] = trimmed;
    } else if (p.category === oldName) {
      p.category = trimmed;
    }
  });

  save();
  renderCategories();
  buildFilters();
  renderAll();
  toast(`"${oldName}" renamed to "${trimmed}" ✓`);
}
function deleteCategory(i) {
  const name = categories[i];
  if (products.some(p=>(p.categories||[p.category]).includes(name))) { toast(`"${name}" is used by products`, true); return; }
  if (confirm(`Delete category "${name}"?`)) { categories.splice(i,1); save(); renderCategories(); buildFilters(); toast('Category deleted'); }
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
