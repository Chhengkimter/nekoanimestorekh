/* =======================================================================
   chatbot.js — Floating Responsive Chatbot Widget for Neko Animestore
   ======================================================================= */

(function () {
    // Policy & response knowledge base summaries
    const BOT_RESPONSES = {
        process: `<strong>📋 Process of Order & Status Workflow</strong><br><br>
Here is how your order moves from checkout to your doorstep:<br><br>
• <strong>Pre-Orders:</strong><br>
  Pay 50% deposit (or 100% full) → Order Sent → Awaiting Confirmation → Confirmed → Shipped → Delivered<br><br>
• <strong>In-Stock Items:</strong><br>
  Fill address & region check → Choose Cash on Delivery (Phnom Penh / Ta Khmao only) or Full Payment → Order Sent → Awaiting Confirmation → Confirmed → Shipped → Delivered<br><br>
• <strong>Mixed Orders (Pre-Order + In-Stock):</strong><br>
  Follows the Pre-Order workflow (50% deposit option available).<br><br>
• <strong>Proxy Custom Orders:</strong><br>
  Submit request links → Receive price quote via direct chat → 100% Full Payment → Order Placed → Shipped → Delivered<br><br>
• <strong>What Each Order Status Means:</strong><br>
  - <strong>Awaiting Confirmation:</strong> Your order is submitted and queued for store admin review.<br>
  - <strong>Confirmed:</strong> Your product is ordered and waiting to arrive at our store / Cambodia.<br>
  - <strong>Shipped:</strong> Your package has arrived and has been sent out to you via delivery driver.<br>
  - <strong>Delivered:</strong> You have safely received your package!`,

        payment: `<strong>💳 Payment Options & Policy</strong><br><br>
• <strong>Accepted Payment Methods:</strong><br>
  We accept payments from <strong>ANY bank in Cambodia</strong> via <strong>ABA PayWay / ABA PAY QR</strong>.<br>
  <em>*Note: Credit / debit card payments (Visa/Mastercard) are not supported.</em><br><br>
• <strong>In-Stock Items:</strong><br>
  - <em>Phnom Penh / Ta Khmao:</em> Choice of <strong>Cash on Delivery (COD)</strong> or <strong>Full Payment</strong> on website.<br>
  - <em>Outside Phnom Penh (Provinces):</em> <strong>100% Full Payment</strong> required before shipping.<br><br>
• <strong>Pre-Orders & Mixed Orders:</strong><br>
  - Choice of <strong>50% Upfront Deposit</strong> (pay remaining 50% upon arrival) or <strong>100% Full Payment</strong>.<br><br>
• <strong>Proxy Custom Orders:</strong><br>
  - <strong>100% Full Payment</strong> required upon quote approval (no 50% deposit for proxy orders).`,

        shipping: `<strong>🚚 Shipping Rates & Packaging Care</strong><br><br>
• <strong>Our Packaging Promise:</strong><br>
  Every package is packed with love and care! Our <strong>Standard $1.50</strong> package is fully safe and secure. For extra fragile figures & items, you can choose <strong>Standard Plus ($2.00)</strong> where we add an extra box layer on top for ultimate protection!<br><br>
• <strong>Phnom Penh / Ta Khmao:</strong><br>
  - <strong>Standard Delivery: $1.50</strong> (1 day instock, 2-3 weeks pre-order)<br>
  - <strong>Standard Plus (Secure Box): $2.00</strong> (Includes extra protective outer box • Recommended for fragile items)<br>
  - <strong>Grab Express: Pay to Driver ($0)</strong> (Urgent orders, same day if placed before 8 PM)<br>
  - <strong>Store Pickup: FREE ($0)</strong> (Borey Pihop Thmey Chamkadoung 2)<br><br>
• <strong>Outside Phnom Penh and Ta Khmao (Provinces):</strong><br>
  - <strong>Standard Delivery: $2.00</strong> (1-2 days instock, 2-3 weeks pre-order)<br><br>
<em>*Extra large items over 50cm may have adjusted shipping fees notified via phone call / telegram.</em>`,

        refund: `<strong>🔄 Return & Refund Policy</strong><br><br>
We offer dedicated after-sales support to solve any delivery issues:<br><br>
• <strong>Valid Reasons for Refund / Exchange:</strong><br>
  - <strong>Wrong Order Sent:</strong> We delivered the wrong product.<br>
  - <strong>Damaged Goods:</strong> Product damaged upon arrival.<br>
  - <strong>Missing Item:</strong> Full after-sale service available — we will track & follow up for you.<br>
  - <strong>Wrong Phone/IPad Case Model:</strong> Full refund if we sent the wrong model, or free exchange to the correct model with no additional fees.<br><br>
• <strong>Important Terms:</strong><br>
  - Please contact us within <strong>2 days upon parcel arrival</strong>.<br>
  - We highly recommend recording an <strong>unboxing video</strong> when opening your parcel.<br>
  - We <strong>do not accept returns without valid reasons</strong> (e.g. change-of-mind reasons such as <em>"I don't want it anymore"</em> will not be refunded once the order status is confirmed).`,

        products: `<strong>🔍 Finding & Searching Products</strong><br><br>
• <strong>Search Bar:</strong> Use the top search bar to look up specific anime titles, characters, or figure names.<br>
• <strong>Collections Menu:</strong> Filter products by genre, series, or product type.<br>
• <strong>Item Not Listed in Store?</strong><br>
If a product is not listed, you can request us to import it for you through our direct customer service options below:`,

        orderservice: `<strong>🌐 Proxy Custom Order Service</strong><br><br>
Can't find your item in Cambodia? We buy directly from overseas platforms for you!<br><br>
• 🇨🇳 <strong>Taobao & Xianyu Direct</strong> ($2 fee under $20, 10% over $20)<br>
• 🇯🇵 🇺🇸 <strong>Popular Stores</strong> (Amazon, AmiAmi, Mercari, Animate, Surugaya) ($3 base + 10%)<br>
• 🌐 <strong>Any International Website</strong> ($5 base + 10%)<br>
• <em>Proxy orders require 100% full payment upon quote confirmation.</em><br><br>
<a href="orderservice.html" style="display:inline-block; margin-top:6px; padding:6px 14px; background:#82659D; color:#fff; border-radius:12px; font-weight:600; text-decoration:none; font-size:12px;">Open Order Service Page →</a>`
    };

    const MAIN_CHIPS = [
        { label: '📋 Process of Order', key: 'process' },
        { label: '💳 Payment', key: 'payment' },
        { label: '🚚 Shipping', key: 'shipping' },
        { label: '🔄 Return & Refund', key: 'refund' },
        { label: '🔍 Finding Products', key: 'products' },
        { label: '🌐 Help Order Service (taobao, Amiami, Amazon...)', key: 'orderservice' },
        { label: '👤 Talk to Human', key: 'human' }
    ];

    let isChatOpen = false;

    function buildChatDOM() {
        if (document.getElementById('neko-chat-launcher')) return;

        // 1. Create Floating Launcher Button
        const launcher = document.createElement('button');
        launcher.id = 'neko-chat-launcher';
        launcher.className = 'chat-launcher-btn';
        launcher.setAttribute('aria-label', 'Open Customer Support Chat');
        launcher.innerHTML = `
            <i class="fas fa-comments"></i>
            <span class="chat-launcher-badge"></span>
        `;
        document.body.appendChild(launcher);

        // 2. Create Chat Window Container
        const windowEl = document.createElement('div');
        windowEl.id = 'neko-chat-window';
        windowEl.className = 'chat-window';
        windowEl.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="chat-avatar"><i class="fas fa-robot"></i></div>
                    <div class="chat-title-group">
                        <h4>Neko Animestore</h4>
                        <div class="chat-status"><span class="status-dot"></span> Active 24/7 Support</div>
                    </div>
                </div>
                <button class="chat-close-btn" id="neko-chat-close">&times;</button>
            </div>
            <div class="chat-body" id="neko-chat-body"></div>
        `;
        document.body.appendChild(windowEl);

        // Event Listeners
        launcher.addEventListener('click', toggleChat);
        document.getElementById('neko-chat-close').addEventListener('click', closeChat);

        // Render Welcome Message
        renderWelcomeState();
    }

    function toggleChat() {
        isChatOpen ? closeChat() : openChat();
    }

    function openChat() {
        isChatOpen = true;
        const windowEl = document.getElementById('neko-chat-window');
        const launcher = document.getElementById('neko-chat-launcher');
        if (windowEl) windowEl.classList.add('open');
        if (launcher) launcher.innerHTML = `<i class="fas fa-times"></i>`;
        scrollToBottom();
    }

    function closeChat() {
        isChatOpen = false;
        const windowEl = document.getElementById('neko-chat-window');
        const launcher = document.getElementById('neko-chat-launcher');
        if (windowEl) windowEl.classList.remove('open');
        if (launcher) launcher.innerHTML = `<i class="fas fa-comments"><span class="chat-launcher-badge"></span></i>`;
    }

    function getTimeString() {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function scrollToBottom() {
        const body = document.getElementById('neko-chat-body');
        if (body) {
            setTimeout(() => {
                body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
            }, 50);
        }
    }

    function renderWelcomeState() {
        const body = document.getElementById('neko-chat-body');
        if (!body) return;
        body.innerHTML = '';

        appendBotMessage('Welcome to Neko_Animestore. How can we help you today?');
        appendChips(MAIN_CHIPS);
    }

    function appendBotMessage(htmlContent) {
        const body = document.getElementById('neko-chat-body');
        if (!body) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg bot';
        msgDiv.innerHTML = `
            <div class="msg-bubble">${htmlContent}</div>
            <span class="msg-time">${getTimeString()}</span>
        `;
        body.appendChild(msgDiv);
        scrollToBottom();
    }

    function appendUserMessage(text) {
        const body = document.getElementById('neko-chat-body');
        if (!body) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg user';
        msgDiv.innerHTML = `
            <div class="msg-bubble">${escapeHtml(text)}</div>
            <span class="msg-time">${getTimeString()}</span>
        `;
        body.appendChild(msgDiv);
        scrollToBottom();
    }

    function appendChips(chipsArray, showBack = false) {
        const body = document.getElementById('neko-chat-body');
        if (!body) return;

        const container = document.createElement('div');
        container.className = 'chat-chips-container';

        chipsArray.forEach(c => {
            const chipBtn = document.createElement('button');
            chipBtn.className = 'chat-chip';
            chipBtn.innerHTML = c.label;
            chipBtn.onclick = () => handleChipClick(c.key, c.label);
            container.appendChild(chipBtn);
        });

        if (showBack) {
            const backBtn = document.createElement('button');
            backBtn.className = 'chat-chip btn-back';
            backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back to Menu';
            backBtn.onclick = () => handleChipClick('back', '← Back to Menu');
            container.appendChild(backBtn);
        }

        body.appendChild(container);
        scrollToBottom();
    }

    function handleChipClick(key, label) {
        // Render user message bubble
        appendUserMessage(label);

        if (key === 'back') {
            appendBotMessage('How else can we assist you today?');
            appendChips(MAIN_CHIPS);
            return;
        }

        if (key === 'human') {
            renderTalkToHumanCard();
            return;
        }

        if (key === 'products') {
            appendBotMessage(BOT_RESPONSES.products);
            renderSocialChannelsCard('Request Product Sourcing', 'fa-box-open');
            appendChips([], true);
            return;
        }

        if (BOT_RESPONSES[key]) {
            appendBotMessage(BOT_RESPONSES[key]);
            appendChips([], true); // Render only Back to Menu button
        }
    }

    function renderSocialChannelsCard(titleText = 'Store Customer Support', iconClass = 'fa-headset') {
        const body = document.getElementById('neko-chat-body');
        if (!body) return;

        const card = document.createElement('div');
        card.className = 'chat-contact-card';
        card.innerHTML = `
            <div class="contact-card-title">
                <i class="fas ${iconClass}" style="color:#82659D;"></i> ${titleText}
            </div>
            <div class="contact-hours">
                <i class="far fa-clock"></i> Business Hours: <strong>11:00 AM – 11:30 AM (Daily)</strong>
            </div>
            <div class="contact-channels-grid">
                <a href="https://t.me/rizeisok" target="_blank" class="contact-channel-item" onclick="openChannelPop('https://t.me/rizeisok', '@rizeisok')">
                    <div class="channel-icon-name">
                        <i class="fab fa-telegram-plane" style="color:#0088cc; font-size:16px;"></i> Telegram
                    </div>
                    <span class="channel-handle">@rizeisok</span>
                </a>
                <a href="https://m.me/Nekoanimestore.kh" target="_blank" class="contact-channel-item" onclick="openChannelPop('https://m.me/Nekoanimestore.kh', 'Nekoanimestore.kh')">
                    <div class="channel-icon-name">
                        <i class="fab fa-facebook-messenger" style="color:#0084ff; font-size:16px;"></i> Facebook
                    </div>
                    <span class="channel-handle">Nekoanimestore.kh</span>
                </a>
                <a href="https://ig.me/m/nekoanimestore.kh" target="_blank" class="contact-channel-item" onclick="openChannelPop('https://ig.me/m/nekoanimestore.kh', '@nekoanimestore.kh')">
                    <div class="channel-icon-name">
                        <i class="fab fa-instagram" style="color:#e1306c; font-size:16px;"></i> Instagram
                    </div>
                    <span class="channel-handle">@nekoanimestore.kh</span>
                </a>
            </div>
        `;
        body.appendChild(card);
    }

    function renderTalkToHumanCard() {
        const body = document.getElementById('neko-chat-body');
        if (!body) return;

        appendBotMessage('Connecting you to our support team! Please choose your preferred channel to contact a human representative directly:');
        renderSocialChannelsCard('Store Customer Support', 'fa-headset');

        // Append back button under card
        appendChips([], true);
    }

    window.openChannelPop = function (url, handle) {
        try {
            window.open(url, '_blank');
        } catch (e) {
            console.log('Pop up blocked, handle provided:', handle);
        }
    };

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // Auto init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildChatDOM);
    } else {
        buildChatDOM();
    }
})();
