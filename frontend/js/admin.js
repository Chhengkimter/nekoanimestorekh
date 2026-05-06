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
    { id:'PROD001', name:'Naruto Hokage Figure', categories:['Figures'], price:24.99, discount:0, discountFlat:false, inventory:12, description:'High-quality PVC figure of Naruto in Hokage outfit.', options:['Small','Large'], images:[] },
    { id:'PROD002', name:'Demon Slayer Hoodie', categories:['Clothing','Accessories'], price:34.99, discount:10, discountFlat:false, inventory:3, description:'Tanjiro-inspired unisex hoodie, soft fleece.', options:['S','M','L','XL'], images:[] },
    { id:'PROD003', name:'One Piece Keychain Set', categories:['Keychains','Accessories'], price:8.99, discount:0, discountFlat:false, inventory:45, description:'Set of 5 Straw Hat crew keychains.', options:[], images:[] },
    { id:'PROD004', name:'Attack on Titan Poster', categories:['Posters'], price:5.99, discount:2, discountFlat:true, inventory:0, description:'A2 size glossy poster, Survey Corps design.', options:['A3','A2','A1'], images:[] },
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
      : `<div class="prod-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
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
    const p = products.find(x => x.id===id);
    document.getElementById('modal-title').textContent = 'Edit product';
    document.getElementById('f-name').value = p.name;
    document.getElementById('f-price').value = p.price;
    document.getElementById('f-inv').value = p.inventory;
    document.getElementById('f-desc').value = p.description;
    document.getElementById('f-discount').value = p.discount || 0;
    document.getElementById('f-discount-type').checked = p.discountFlat || false;
    modalOptions = [...(p.options||[])];
    modalImages = [...(p.images||[])];
    modalCats = [...(p.categories || (p.category ? [p.category] : []))];
  } else {
    document.getElementById('modal-title').textContent = 'Add product';
    ['f-name','f-price','f-inv','f-desc','f-discount'].forEach(i => document.getElementById(i).value = '');
    document.getElementById('f-discount-type').checked = false;
  }
  renderCatPicker(); renderOptions(); renderImagePreviews(); updateSalePreview();
  document.getElementById('modal-overlay').classList.add('open');
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
  const inv = parseInt(document.getElementById('f-inv').value);
  const desc = document.getElementById('f-desc').value.trim();
  const discount = parseFloat(document.getElementById('f-discount').value)||0;
  const discountFlat = document.getElementById('f-discount-type').checked;
  if (!name || isNaN(price) || isNaN(inv)) { toast('Fill in name, price and qty', true); return; }
  if (modalCats.length === 0) { toast('Select at least one category', true); return; }
  if (editingId) {
    const idx = products.findIndex(p => p.id===editingId);
    products[idx] = { ...products[idx], name, categories:modalCats, price, discount, discountFlat, inventory:inv, description:desc, options:modalOptions, images:modalImages };
    toast('Product updated ✓');
  } else {
    products.unshift({ id:genId(), name, categories:modalCats, price, discount, discountFlat, inventory:inv, description:desc, options:modalOptions, images:modalImages });
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
    `<div class="cat-chip ${c===invFilter?'active':''}" onclick="setInvFilter('${c}')">${c}</div>`
  ).join('');
  const maxInv = Math.max(...products.map(p=>p.inventory), 1);
  const filtered = invFilter==='All' ? products : products.filter(p=>(p.categories||[p.category]).includes(invFilter));
  document.getElementById('inv-grid').innerHTML = !filtered.length
    ? `<div class="empty-state"><div class="es-icon">📦</div><p>No products here</p></div>`
    : filtered.map(p => {
        const pct = Math.min(100, (p.inventory/maxInv)*100);
        const col = p.inventory===0 ? '#f87171' : p.inventory<=5 ? '#fbbf24' : '#4ade80';
        const cats = (p.categories||[p.category]).filter(Boolean).join(', ');
        const salePrice = calcSale(p.price, p.discount, p.discountFlat);
        const priceDisplay = p.discount > 0
          ? `<span style="text-decoration:line-through;color:var(--muted);font-size:10px">$${Number(p.price).toFixed(2)}</span> <span style="color:var(--green);font-size:11px;font-weight:700">$${salePrice}</span>`
          : `<span style="font-size:11px;color:var(--muted)">$${Number(p.price).toFixed(2)}</span>`;
        return `<div class="inv-card">
          <div class="inv-card-name">${p.name}</div>
          <div class="inv-card-cat">#${p.id} · ${cats}</div>
          <div style="font-family:var(--mono);margin-bottom:8px">${priceDisplay}</div>
          <div class="inv-bar-wrap"><div class="inv-bar" style="width:${pct}%;background:${col}"></div></div>
          <div class="inv-count-row">
            <div class="inv-count" style="color:${col}">${p.inventory}</div>
            <div class="inv-adj">
              <button onclick="adjustInv('${p.id}',-1)">−</button>
              <button onclick="adjustInv('${p.id}',1)">+</button>
            </div>
          </div>
        </div>`;
      }).join('');
}
function setInvFilter(c) { invFilter=c; renderInventory(); }
function adjustInv(id, delta) {
  const p = products.find(x=>x.id===id);
  if (!p) return;
  p.inventory = Math.max(0, p.inventory+delta);
  save(); renderInventory(); renderStats();
}

// ── CATEGORIES ──
function renderCategories() {
  document.getElementById('cat-table-body').innerHTML = `<table>
    <thead><tr><th>Category name</th><th>Products</th><th>Actions</th></tr></thead>
    <tbody>${categories.map((c,i) => {
      const count = products.filter(p=>(p.categories||[p.category]).includes(c)).length;
      return `<tr>
        <td style="font-weight:600">${c}</td>
        <td><span class="badge badge-purple">${count}</span></td>
        <td><button class="action-btn del" onclick="deleteCategory(${i})">Delete</button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}
function addCategory() {
  const name = prompt('New category name:');
  if (name && name.trim() && !categories.includes(name.trim())) {
    categories.push(name.trim()); save(); renderCategories(); buildFilters(); toast('Category added ✓');
  }
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
