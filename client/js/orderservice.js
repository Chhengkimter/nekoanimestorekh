/* ── ORDER SERVICE JS LOGIC (PAGE VIEW & ADDRESS MATCH) ── */

const API_BASE = 'http://localhost:3000/api';

let activeTier = 'taobao';
let linkGroups = [];
let userProfile = null;
let activeLocTab = 'manual';

const TIER_META = {
    taobao: {
        label: '🇨🇳 Taobao & Xianyu Direct',
        feeDesc: '$2 fee per product under $20, 10% fee over $20',
        shortName: 'Taobao Direct',
        feeSummary: '$2.00 / 10%'
    },
    popular_sites: {
        label: '🇯🇵 🇺🇸 Popular Stores (Amazon, AmiAmi, Mercari)',
        feeDesc: '$3 extra base cost per order + 10% per product',
        shortName: 'Popular Stores',
        feeSummary: '$3.00 + 10%'
    },
    global_shipping: {
        label: '🌐 Any International Website',
        feeDesc: '$5 extra base cost per order + 10% per product',
        shortName: 'Global Store',
        feeSummary: '$5.00 + 10%'
    }
};

const SHIPPING_PRICES = {
    standard_pp:         1.50,
    fragile_box:         2.00,
    grab_express:        0.00,
    pickup:              0.00,
    standard_provincial: 2.00
};

document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();

    // Check if tier parameter is in URL (e.g. orderservice.html?tier=taobao)
    const params = new URLSearchParams(window.location.search);
    const tierParam = params.get('tier');
    if (tierParam && TIER_META[tierParam]) {
        openOrderPage(tierParam);
    }

    // Order Note character counter
    const noteEl = document.getElementById('order-note');
    if (noteEl) {
        noteEl.addEventListener('input', () => {
            const countEl = document.getElementById('note-char');
            if (countEl) countEl.textContent = `${noteEl.value.length} / 500`;
        });
    }

    renderShippingOptions();

    document.querySelectorAll('input[name="is_phnom_penh"]').forEach(radio => {
        radio.addEventListener('change', () => {
            renderShippingOptions();
        });
    });
});

async function loadUserProfile() {
    const token = localStorage.getItem('neko_token');
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        userProfile = await res.json();
    } catch (err) {
        console.error('Failed to load user profile:', err);
    }
}

function openOrderPage(tier) {
    activeTier = tier || 'taobao';
    const meta = TIER_META[activeTier] || TIER_META.taobao;

    document.getElementById('svc-selected-tier-label').textContent = meta.label;
    document.getElementById('svc-tier-fee-desc').textContent = meta.feeDesc;
    document.getElementById('mini-tier-name').textContent = meta.shortName;
    document.getElementById('mini-service-fee').textContent = meta.feeSummary;

    // Reset link groups
    linkGroups = [
        {
            url: '',
            items: [
                { name: '', image: '', note: '', qty: 1 }
            ]
        }
    ];

    renderLinkGroups();

    // Auto-fill delivery address if user profile is available
    if (userProfile) {
        if (userProfile.phone_number && document.getElementById('phone1')) {
            document.getElementById('phone1').value = userProfile.phone_number.replace('+855', '').trim();
        }
        if (userProfile.addr_line1 && document.getElementById('addr-line1')) {
            document.getElementById('addr-line1').value = userProfile.addr_line1;
        }
        if (userProfile.addr_district && document.getElementById('addr-district')) {
            document.getElementById('addr-district').value = userProfile.addr_district;
        }
        if (userProfile.addr_city && document.getElementById('addr-city')) {
            document.getElementById('addr-city').value = userProfile.addr_city;
        }
        if (userProfile.addr_landmark && document.getElementById('addr-landmark')) {
            document.getElementById('addr-landmark').value = userProfile.addr_landmark;
        }
    }

    // Switch views
    document.getElementById('svc-landing-view').style.display = 'none';
    document.getElementById('svc-page-view').style.display = 'block';
    document.getElementById('svc-success-view').style.display = 'none';

    renderShippingOptions();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderShippingOptions() {
    const isPP = document.querySelector('input[name="is_phnom_penh"]:checked')?.value === 'yes';
    const container = document.getElementById('svc-shipping-options');
    if (!container) return;

    const cardSub = document.getElementById('svc-shipping-card-sub');
    if (cardSub) {
        cardSub.textContent = isPP 
            ? 'Estimated delivery time: (1 day for in-stock, 2-3 weeks for pre-order)'
            : 'Estimated delivery time: (1-2 days for in-stock, 2-3 weeks for pre-order)';
    }

    let html = '';
    if (isPP) {
        html = `
            <label class="shipping-opt">
                <input type="radio" name="shipping" value="standard_pp" checked>
                <div class="ship-content">
                    <div class="ship-left">
                        <div class="ship-name">Standard Delivery</div>
                        <div class="ship-desc">Covers Phnom Penh & Ta Khmao</div>
                        <div class="ship-est"><i class="fas fa-clock"></i> 1 day (instock) • 2-3 weeks (pre order)</div>
                    </div>
                    <div class="ship-price">$1.50</div>
                </div>
            </label>

            <label class="shipping-opt">
                <input type="radio" name="shipping" value="fragile_box">
                <div class="ship-content">
                    <div class="ship-left">
                        <div class="ship-name">Standard Plus (Secure Box)</div>
                        <div class="ship-desc">Includes protective packaging box • Recommended for fragile items & figures</div>
                        <div class="ship-est"><i class="fas fa-box"></i> 1 day (instock) • 2-3 weeks (pre order)</div>
                    </div>
                    <div class="ship-price">$2.00</div>
                </div>
            </label>

            <label class="shipping-opt">
                <input type="radio" name="shipping" value="grab_express">
                <div class="ship-content">
                    <div class="ship-left">
                        <div class="ship-name">Grab Express</div>
                        <div class="ship-desc">Pay directly to driver on delivery ($3–$5 depending on location). Recommended for super urgent orders only. Same day delivery if placed before 8pm.</div>
                        <div class="ship-est"><i class="fas fa-bolt"></i> Same day delivery (placed before 8pm)</div>
                    </div>
                    <div class="ship-price free">Pay to Driver ($0)</div>
                </div>
            </label>

            <label class="shipping-opt">
                <input type="radio" name="shipping" value="pickup">
                <div class="ship-content">
                    <div class="ship-left">
                        <div class="ship-name">Store Pickup</div>
                        <div class="ship-desc">Borey Pihop Thmey Chamkadoung 2 (detailed info will be provided later)</div>
                        <div class="ship-est"><i class="fas fa-store"></i> Ready upon notification</div>
                    </div>
                    <div class="ship-price free">FREE ($0)</div>
                </div>
            </label>
        `;
    } else {
        html = `
            <label class="shipping-opt">
                <input type="radio" name="shipping" value="standard_provincial" checked>
                <div class="ship-content">
                    <div class="ship-left">
                        <div class="ship-name">Standard Delivery (Provincial)</div>
                        <div class="ship-desc">Covers all provinces outside Phnom Penh & Ta Khmao</div>
                        <div class="ship-est"><i class="fas fa-truck"></i> 1-2 days (instock) • 2-3 weeks (pre order)</div>
                    </div>
                    <div class="ship-price">$2.00</div>
                </div>
            </label>
        `;
    }

    html += `
        <div style="margin-top:12px; padding:10px 14px; background:#fffbe6; border:1px solid #ffe58f; border-radius:8px; font-size:12px; color:#873800; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-exclamation-triangle" style="color:#d48806; font-size:14px; flex-shrink:0;"></i>
            <span><strong>Oversized Item Note:</strong> For extra large items over 50cm, there may be a different shipping price. Further notice will be notified via email / chat.</span>
        </div>
    `;

    container.innerHTML = html;
}

function showTierSelection() {
    document.getElementById('svc-landing-view').style.display = 'block';
    document.getElementById('svc-page-view').style.display = 'none';
    document.getElementById('svc-success-view').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchLocTab(tab) {
    activeLocTab = tab;
    document.querySelectorAll('.loc-tab').forEach(b => {
        if (b.dataset.tab === tab) b.classList.add('active');
        else b.classList.remove('active');
    });

    const manualPanel = document.getElementById('tab-manual');
    const mapsPanel = document.getElementById('tab-maps');

    if (tab === 'manual') {
        if (manualPanel) manualPanel.classList.remove('hidden');
        if (mapsPanel) mapsPanel.classList.add('hidden');
    } else {
        if (manualPanel) manualPanel.classList.add('hidden');
        if (mapsPanel) mapsPanel.classList.remove('hidden');
    }
}

function verifyMapsLink() {
    const linkEl = document.getElementById('addr-maps-link');
    const url = linkEl ? linkEl.value.trim() : '';
    if (!url) {
        alert('Please paste a Google Maps URL first.');
        return;
    }
    window.open(url, '_blank');
}

function renderLinkGroups() {
    const container = document.getElementById('svc-links-container');
    if (!container) return;

    container.innerHTML = linkGroups.map((g, gIdx) => {
        const itemsHtml = g.items.map((it, iIdx) => `
            <div class="svc-prod-card" id="prod-card-${gIdx}-${iIdx}">
                <div class="svc-img-label-row" style="margin-bottom:6px;">
                    <label style="font-size:12px; font-weight:700; color:#333;">Product #${iIdx + 1} Variant Screenshot Image Link <span class="req">*</span></label>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <a href="#" class="see-example-link" onclick="openExampleModal(event)">See example</a>
                        ${iIdx > 0 ? `<button type="button" class="svc-del-btn" onclick="removeVariantItem(${gIdx}, ${iIdx})"><i class="fas fa-trash-alt"></i> Remove variant</button>` : ''}
                    </div>
                </div>
                <div class="svc-form-group">
                    <input type="url" class="field-input" value="${escapeAttr(it.image)}" placeholder="Paste screenshot image URL (https://...)" oninput="updateItemField(${gIdx}, ${iIdx}, 'image', this.value)">
                </div>

                <div class="svc-grid-2">
                    <div class="svc-form-group">
                        <label style="font-size:12px; font-weight:600; color:#555;">Quantity <span class="req">*</span></label>
                        <input type="number" class="field-input" min="1" value="${it.qty || 1}" onchange="updateItemField(${gIdx}, ${iIdx}, 'qty', this.value)">
                    </div>
                    <div class="svc-form-group">
                        <label style="font-size:12px; font-weight:600; color:#555;">Option / Character Note <span class="optional">(optional)</span></label>
                        <input type="text" class="field-input" value="${escapeAttr(it.note)}" placeholder="e.g. Type B, Blue Ver" oninput="updateItemField(${gIdx}, ${iIdx}, 'note', this.value)">
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <div class="svc-link-group" id="link-group-${gIdx}" style="background:#fff; border:1.5px solid #d9c4e8; border-radius:12px; padding:18px; margin-bottom:16px;">
                <div class="svc-link-group-header">
                    <span class="svc-link-group-title" style="font-size:14px; font-weight:700; color:#82659D;">
                        <i class="fas fa-link"></i> Website Link #${gIdx + 1}
                    </span>
                    ${linkGroups.length > 1 ? `<button type="button" class="svc-del-btn" onclick="removeLinkGroup(${gIdx})"><i class="fas fa-trash-alt"></i> Remove link group</button>` : ''}
                </div>

                <div class="svc-form-group">
                    <label style="font-size:13px; font-weight:600; color:#333;">Product Website URL <span class="req">*</span></label>
                    <div class="svc-input-with-btn">
                        <input type="url" class="field-input" id="svc-url-input-${gIdx}" value="${escapeAttr(g.url)}" placeholder="Paste product link (https://item.taobao.com/... or amazon.co.jp/...)" oninput="updateGroupUrl(${gIdx}, this.value)">
                        <button type="button" class="svc-paste-btn" onclick="pasteLink(${gIdx})">
                            <i class="fas fa-paste"></i> Paste
                        </button>
                    </div>
                </div>

                <div class="svc-items-list">
                    ${itemsHtml}
                </div>

                <div class="svc-add-variant-wrap" style="margin-top:12px; text-align:right;">
                    <button type="button" class="svc-btn-sub-variant" onclick="addVariantItem(${gIdx})">
                        <i class="fas fa-plus"></i> Add another product from this same link
                    </button>
                </div>
            </div>
        `;
    }).join('');

    updateMiniSummary();
}

function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;');
}

function updateGroupUrl(gIdx, val) {
    if (linkGroups[gIdx]) {
        linkGroups[gIdx].url = val;
        updateMiniSummary();
    }
}

function updateItemField(gIdx, iIdx, field, val) {
    if (linkGroups[gIdx] && linkGroups[gIdx].items[iIdx]) {
        linkGroups[gIdx].items[iIdx][field] = val;
        updateMiniSummary();
    }
}

async function pasteLink(gIdx) {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            const input = document.getElementById(`svc-url-input-${gIdx}`);
            if (input) {
                input.value = text;
                updateGroupUrl(gIdx, text);
            }
        }
    } catch (err) {
        alert('Could not read clipboard. Please paste manually.');
    }
}

function addLinkGroup() {
    linkGroups.push({
        url: '',
        items: [{ name: '', image: '', note: '', qty: 1 }]
    });
    renderLinkGroups();
}

function removeLinkGroup(gIdx) {
    if (linkGroups.length <= 1) return;
    linkGroups.splice(gIdx, 1);
    renderLinkGroups();
}

function addVariantItem(gIdx) {
    if (linkGroups[gIdx]) {
        linkGroups[gIdx].items.push({ name: '', image: '', note: '', qty: 1 });
        renderLinkGroups();
    }
}

function removeVariantItem(gIdx, iIdx) {
    if (linkGroups[gIdx] && linkGroups[gIdx].items.length > 1) {
        linkGroups[gIdx].items.splice(iIdx, 1);
        renderLinkGroups();
    }
}

function updateMiniSummary() {
    const summaryContainer = document.getElementById('order-service-mini-summary');
    const itemCountEl = document.getElementById('mini-item-count');
    if (!summaryContainer) return;

    let totalUnits = 0;
    let html = '';

    linkGroups.forEach((g, gIdx) => {
        g.items.forEach((it, iIdx) => {
            const qty = parseInt(it.qty) || 1;
            totalUnits += qty;
            const name = it.name?.trim() || `Item #${gIdx + 1}.${iIdx + 1}`;
            html += `
                <div class="order-mini-item">
                    <div class="mini-name">
                        <strong>${name}</strong>
                        <small>Qty ${qty} ${it.note ? '• ' + it.note : ''}</small>
                    </div>
                </div>
            `;
        });
    });

    summaryContainer.innerHTML = html || '<p style="font-size:12px; color:#aaa;">No products added yet.</p>';
    if (itemCountEl) itemCountEl.textContent = `${totalUnits} item${totalUnits === 1 ? '' : 's'}`;
}

function openExampleModal(e) {
    if (e) e.preventDefault();
    const modal = document.getElementById('example-modal-overlay');
    if (modal) modal.classList.add('open');
}

function closeExampleModal() {
    const modal = document.getElementById('example-modal-overlay');
    if (modal) modal.classList.remove('open');
}

async function submitOrderService() {
    // 1. Gather delivery details
    const phoneInput1 = document.getElementById('phone1');
    const phoneInput2 = document.getElementById('phone2');
    const phone1 = phoneInput1 ? phoneInput1.value.trim() : '';
    const phone2 = phoneInput2 ? phoneInput2.value.trim() : '';

    if (!phone1) {
        alert('Please enter your primary phone number.');
        if (phoneInput1) phoneInput1.focus();
        return;
    }

    let addrLine1 = '', addrDistrict = '', addrCity = '', addrLandmark = '', mapsLink = '', mapsDetail = '';

    if (activeLocTab === 'manual') {
        addrLine1 = document.getElementById('addr-line1')?.value.trim() || '';
        addrDistrict = document.getElementById('addr-district')?.value.trim() || '';
        addrCity = document.getElementById('addr-city')?.value.trim() || '';
        addrLandmark = document.getElementById('addr-landmark')?.value.trim() || '';

        if (!addrLine1) {
            alert('Please enter your full delivery address.');
            document.getElementById('addr-line1')?.focus();
            return;
        }
    } else {
        mapsLink = document.getElementById('addr-maps-link')?.value.trim() || '';
        mapsDetail = document.getElementById('addr-maps-detail')?.value.trim() || '';

        if (!mapsLink) {
            alert('Please paste your Google Maps link.');
            document.getElementById('addr-maps-link')?.focus();
            return;
        }
    }

    const selectedRadio = document.querySelector('input[name="svc-preferred-contact"]:checked');
    const preferredContact = selectedRadio ? selectedRadio.value : 'telegram';
    const contactHandle = document.getElementById('svc-contact-handle')?.value.trim() || '';
    const orderNote = document.getElementById('order-note')?.value.trim() || '';

    if (!contactHandle) {
        alert('Please enter your social username or profile link.');
        const handleEl = document.getElementById('svc-contact-handle');
        if (handleEl) handleEl.focus();
        return;
    }

    // 2. Flatten & validate items from all link groups
    const flatItems = [];
    for (let gIdx = 0; gIdx < linkGroups.length; gIdx++) {
        const g = linkGroups[gIdx];
        const url = g.url.trim();
        if (!url) {
            alert(`Please enter the product website URL for Link #${gIdx + 1}.`);
            document.getElementById(`svc-url-input-${gIdx}`)?.focus();
            return;
        }
        for (let iIdx = 0; iIdx < g.items.length; iIdx++) {
            const it = g.items[iIdx];
            const img = it.image ? it.image.trim() : '';
            if (!img) {
                alert(`Please paste the variant screenshot image link for Product #${iIdx + 1} under Link #${gIdx + 1}.`);
                return;
            }
            flatItems.push({
                productName: it.note?.trim() || `Proxy Product #${gIdx + 1}.${iIdx + 1}`,
                itemUrl: url,
                variationImage: img,
                selectedOption: it.note?.trim() || null,
                productQuantity: parseInt(it.qty) || 1,
                priceAtPurchase: 0,
                itemNote: it.note?.trim() || null
            });
        }
    }

    if (flatItems.length === 0) {
        alert('Please provide at least one product website link and screenshot image.');
        return;
    }

    const shippingRadio = document.querySelector('input[name="shipping"]:checked');
    const shippingMethod = shippingRadio ? shippingRadio.value : 'standard_pp';
    const shippingCost = SHIPPING_PRICES[shippingMethod] !== undefined ? SHIPPING_PRICES[shippingMethod] : 1.50;
    const isPhnomPenh = document.querySelector('input[name="is_phnom_penh"]:checked')?.value === 'yes';

    const fullNote = `Customer Handle: ${contactHandle}` + (orderNote ? ` | Note: ${orderNote}` : '');

    const submitBtn = document.getElementById('svc-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        const token = localStorage.getItem('neko_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/orders/service`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                serviceTier: activeTier,
                preferredContact,
                shippingMethod,
                shippingCost,
                isPhnomPenh,
                addrType: activeLocTab,
                addrLine1: activeLocTab === 'manual' ? addrLine1 : null,
                addrDistrict: activeLocTab === 'manual' ? addrDistrict : null,
                addrCity: activeLocTab === 'manual' ? addrCity : null,
                addrLandmark: activeLocTab === 'manual' ? addrLandmark : null,
                mapsLink: activeLocTab === 'maps' ? mapsLink : null,
                mapsDetail: activeLocTab === 'maps' ? mapsDetail : null,
                phone1: phone1.startsWith('+855') ? phone1 : `+855 ${phone1}`,
                phone2: phone2 ? (phone2.startsWith('+855') ? phone2 : `+855 ${phone2}`) : null,
                orderNote: fullNote,
                items: flatItems
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit order');

        // Render success page
        document.getElementById('svc-success-code').textContent = `#${data.orderCode}`;
        const redirectBtn = document.getElementById('svc-direct-redirect-link');
        if (data.redirectUrl) {
            redirectBtn.href = data.redirectUrl;
        } else {
            redirectBtn.href = 'https://t.me/rizeisok';
        }

        document.getElementById('svc-landing-view').style.display = 'none';
        document.getElementById('svc-page-view').style.display = 'none';
        document.getElementById('svc-success-view').style.display = 'block';

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
        alert(err.message || 'Submission error. Please try again.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Proxy Request';
        }
    }
}
