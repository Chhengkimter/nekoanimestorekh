/* =======================================================================
   auth.js  –  Shared logic for login.html, signup.html, admin/admin.html
   Connected to real backend API (Node.js/Express + Supabase)
   ======================================================================= */

const API = 'http://localhost:3000/api';

/* =====================
   REDIRECT TARGETS
   ===================== */
const REDIRECT = {
  admin:    '../admin/admin.html',
  customer: '../pages/index.html',
};

/* =====================
   SESSION HELPERS
   Store JWT in localStorage so it persists across pages
   ===================== */
function saveSession(token, user, isAdmin = false) {
  localStorage.setItem('neko_token', token);
  localStorage.setItem('neko_user',  JSON.stringify(user));
  localStorage.setItem('neko_role',  isAdmin ? 'admin' : 'customer');
}

function getToken() { return localStorage.getItem('neko_token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('neko_user')); } catch { return null; } }
function getRole()  { return localStorage.getItem('neko_role'); }

function clearSession() {
  localStorage.removeItem('neko_token');
  localStorage.removeItem('neko_user');
  localStorage.removeItem('neko_role');
}

function isLoggedIn() { return !!getToken(); }

/* =====================
   UI HELPERS
   ===================== */
function showError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}

function setInputState(inputId, state) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.remove('input-error', 'input-ok');
  if (state) el.classList.add(state);
}

function showBanner(type, message) {
  const errBanner  = document.getElementById('auth-error');
  const succBanner = document.getElementById('auth-success');
  const errMsg     = document.getElementById('auth-error-msg');
  const succMsg    = document.getElementById('auth-success-msg');

  if (type === 'error') {
    if (errBanner)  { errBanner.style.display  = 'flex'; if (errMsg)  errMsg.textContent  = message; }
    if (succBanner) succBanner.style.display = 'none';
  } else {
    if (succBanner) { succBanner.style.display = 'flex'; if (succMsg) succMsg.textContent = message; }
    if (errBanner)  errBanner.style.display  = 'none';
  }
}

function hideBanners() {
  const b1 = document.getElementById('auth-error');
  const b2 = document.getElementById('auth-success');
  if (b1) b1.style.display = 'none';
  if (b2) b2.style.display = 'none';
}

function setLoading(btnId, textId, spinnerId, loading) {
  const btn  = document.getElementById(btnId);
  const text = document.getElementById(textId);
  const spin = document.getElementById(spinnerId);
  if (!btn) return;
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : 'inline';
  if (spin) spin.style.display = loading ? 'inline-block' : 'none';
}

/* =====================
   PASSWORD VISIBILITY TOGGLE
   ===================== */
function initTogglePw(btnId, inputId, eyeId) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const eye   = document.getElementById(eyeId);
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    if (eye) {
      eye.classList.toggle('fa-eye',       !isHidden);
      eye.classList.toggle('fa-eye-slash',  isHidden);
    }
  });
}

/* =====================
   PASSWORD STRENGTH (signup only)
   ===================== */
function checkStrength(password) {
  let score = 0;
  if (password.length >= 8)          score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const bar = document.getElementById('pw-bar');
  if (!bar) return score;
  const map = [
    { pct: '0%',   color: '#eee'    },
    { pct: '30%',  color: '#e05c5c' },
    { pct: '55%',  color: '#f0a050' },
    { pct: '80%',  color: '#f0c040' },
    { pct: '100%', color: '#6dbf8b' },
  ];
  bar.style.width      = map[score].pct;
  bar.style.background = map[score].color;
  return score;
}

/* =====================
   CUSTOMER LOGIN
   login.html → POST /api/auth/login
   ===================== */
async function handleLogin(e) {
  e.preventDefault();
  hideBanners();

  const email    = document.getElementById('email')?.value.trim();
  const password = document.getElementById('password')?.value;

  let valid = true;
  clearError('email-error');    setInputState('email',    null);
  clearError('password-error'); setInputState('password', null);

  if (!email) {
    showError('email-error', 'Email is required.');
    setInputState('email', 'input-error'); valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('email-error', 'Please enter a valid email.');
    setInputState('email', 'input-error'); valid = false;
  } else { setInputState('email', 'input-ok'); }

  if (!password) {
    showError('password-error', 'Password is required.');
    setInputState('password', 'input-error'); valid = false;
  } else { setInputState('password', 'input-ok'); }

  if (!valid) return;

  setLoading('login-btn', 'login-btn-text', 'login-spinner', true);
  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      showBanner('error', data.error || 'Invalid email or password.');
      setInputState('email',    'input-error');
      setInputState('password', 'input-error');
      return;
    }

    saveSession(data.token, data.user, false);
    window.location.href = REDIRECT.customer;

  } catch (err) {
    showBanner('error', 'Network error — make sure the server is running.');
  } finally {
    setLoading('login-btn', 'login-btn-text', 'login-spinner', false);
  }
}

/* =====================
   CUSTOMER SIGNUP
   signup.html → POST /api/auth/register
   ===================== */
async function handleSignup(e) {
  e.preventDefault();
  hideBanners();

  const firstName = document.getElementById('first-name')?.value.trim();
  const lastName  = document.getElementById('last-name')?.value.trim();
  const email     = document.getElementById('email')?.value.trim();
  const phone     = document.getElementById('phone')?.value.trim();
  const password  = document.getElementById('password')?.value;
  const confirm   = document.getElementById('confirm-password')?.value;
  const terms     = document.getElementById('terms-check')?.checked;

  let valid = true;
  ['first-name','last-name','email','password','confirm-password']
    .forEach(id => { clearError(id + '-error'); setInputState(id, null); });
  clearError('terms-error');

  if (!firstName) { showError('first-name-error', 'First name is required.'); setInputState('first-name', 'input-error'); valid = false; }
  else { setInputState('first-name', 'input-ok'); }

  if (!lastName) { showError('last-name-error', 'Last name is required.'); setInputState('last-name', 'input-error'); valid = false; }
  else { setInputState('last-name', 'input-ok'); }

  if (!email) { showError('email-error', 'Email is required.'); setInputState('email', 'input-error'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('email-error', 'Please enter a valid email.'); setInputState('email', 'input-error'); valid = false; }
  else { setInputState('email', 'input-ok'); }

  if (!password) { showError('password-error', 'Password is required.'); setInputState('password', 'input-error'); valid = false; }
  else if (password.length < 8) { showError('password-error', 'Password must be at least 8 characters.'); setInputState('password', 'input-error'); valid = false; }
  else { setInputState('password', 'input-ok'); }

  if (!confirm) { showError('confirm-password-error', 'Please confirm your password.'); setInputState('confirm-password', 'input-error'); valid = false; }
  else if (confirm !== password) { showError('confirm-password-error', 'Passwords do not match.'); setInputState('confirm-password', 'input-error'); valid = false; }
  else { setInputState('confirm-password', 'input-ok'); }

  if (!terms) { showError('terms-error', 'You must accept the Terms & Conditions.'); valid = false; }
  if (!valid) return;

  setLoading('signup-btn', 'signup-btn-text', 'signup-spinner', true);
  try {
    const res  = await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ firstName, lastName, email, password, phoneNumber: phone || null }),
    });
    const data = await res.json();

    if (!res.ok) {
      showBanner('error', data.error || 'Registration failed. Please try again.');
      if (data.error?.toLowerCase().includes('email')) setInputState('email', 'input-error');
      return;
    }

    saveSession(data.token, data.user, false);
    showBanner('success', `Welcome, ${firstName}! Redirecting you now…`);
    setTimeout(() => { window.location.href = REDIRECT.customer; }, 1200);

  } catch (err) {
    showBanner('error', 'Network error — make sure the server is running.');
  } finally {
    setLoading('signup-btn', 'signup-btn-text', 'signup-spinner', false);
  }
}

/* =====================
   ADMIN LOGIN
   admin/admin.html → POST /api/auth/admin/login
   ===================== */
async function handleAdminLogin(e) {
  e.preventDefault();

  const email    = document.getElementById('login-user')?.value.trim();
  const password = document.getElementById('login-pass')?.value;
  const errEl    = document.getElementById('login-err');

  if (errEl) errEl.style.display = 'none';

  if (!email || !password) {
    if (errEl) { errEl.textContent = 'Email and password are required.'; errEl.style.display = 'block'; }
    return;
  }

  try {
    const res  = await fetch(`${API}/auth/admin/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (errEl) { errEl.textContent = data.error || 'Incorrect credentials.'; errEl.style.display = 'block'; }
      return;
    }

    // Save session (backend may return { user } or { admin })
    const adminUser = data.user || data.admin;
    saveSession(data.token, adminUser, true);

    // Show the admin app
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display          = 'flex';
    const loggedAs = document.getElementById('logged-as');
    if (loggedAs) loggedAs.textContent = `@${adminUser?.firstName || adminUser?.email || 'admin'}`;
    if (typeof initApp === 'function') initApp();

  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error — make sure the server is running.'; errEl.style.display = 'block'; }
  }
}

/* =====================
   LOGOUT
   ===================== */
function logout() {
  clearSession();
  const loginScreen = document.getElementById('login-screen');
  const app         = document.getElementById('app');
  if (loginScreen && app) {
    loginScreen.style.display = 'flex';
    app.style.display         = 'none';
  } else {
    window.location.href = '/pages/login.html';
  }
}

/* =====================
   API HELPER
   Use this in admin.js to make authenticated requests
   ===================== */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/client/admin/admin.html';
    return;
  }

  return res;
}

/* =====================
   SOCIAL AUTH (placeholder)
   ===================== */
function initSocialAuth() {
  document.getElementById('google-btn')?.addEventListener('click', () => alert('Google sign-in coming soon!'));
  document.getElementById('fb-btn')?.addEventListener('click',     () => alert('Facebook sign-in coming soon!'));
}

/* =====================
   INIT — detect which page we are on
   ===================== */
document.addEventListener('DOMContentLoaded', () => {
  // Uses data-page="admin" on <body> in admin.html for reliable detection.
  // Falls back to DOM checks for login.html and signup.html.
  const isAdminPage  = document.body.dataset.page === 'admin';
  const isSignupPage = !isAdminPage && !!document.getElementById('signup-form');
  const isLoginPage  = !isAdminPage && !isSignupPage && !!document.getElementById('login-form');

  // ── Admin page ──
  if (isAdminPage) {
    if (isLoggedIn() && getRole() === 'admin') {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display          = 'flex';
      const user     = getUser();
      const loggedAs = document.getElementById('logged-as');
      if (loggedAs && user) loggedAs.textContent = `@${user.firstName || user.email}`;
      if (typeof initApp === 'function') initApp();
      return;
    }
    document.getElementById('login-form').addEventListener('submit', handleAdminLogin);
    return;
  }

  // ── Customer login page ──
  if (isLoginPage) {
    if (isLoggedIn() && getRole() === 'customer') {
      window.location.href = REDIRECT.customer;
      return;
    }
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    initTogglePw('toggle-pw', 'password', 'pw-eye');
    initSocialAuth();
  }

  // ── Customer signup page ──
  if (isSignupPage) {
    if (isLoggedIn() && getRole() === 'customer') {
      window.location.href = REDIRECT.customer;
      return;
    }
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    initTogglePw('toggle-pw',         'password',         'pw-eye');
    initTogglePw('toggle-confirm-pw', 'confirm-password', 'confirm-pw-eye');
    document.getElementById('password')?.addEventListener('input', e => checkStrength(e.target.value));
    initSocialAuth();
  }
});