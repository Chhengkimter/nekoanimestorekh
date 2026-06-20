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