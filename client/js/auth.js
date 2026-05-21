/* =======================================================================
   auth.js  –  Shared logic for login.html and signup.html
   
   ADMIN DETECTION (frontend-only placeholder):
     Email    : admin@neko.com
     Password : Admin@1234
   
   When you connect a real backend, replace the handleLogin() and
   handleSignup() functions with fetch() calls to your API endpoint.
   The redirect logic stays the same — just read the "role" field
   from the server response instead of comparing hardcoded values.
   ======================================================================= */

/* =====================
   FAKE USER "DATABASE"
   Replace with real DB / API later.
   ===================== */
const ADMIN_CREDENTIALS = {
    email: "admin@neko.com",
    password: "Admin@1234",
};

// Simulated registered users (stored in sessionStorage for demo)
function getUsers() {
    try { return JSON.parse(sessionStorage.getItem("neko_users") || "[]"); }
    catch { return []; }
}
function saveUsers(users) {
    sessionStorage.setItem("neko_users", JSON.stringify(users));
}

/* =====================
   REDIRECT TARGETS
   Change these paths to match your file structure.
   ===================== */
const REDIRECT = {
    admin:    "admin/admin.html",   // TODO: update to your actual admin page
    customer: "../customer/index.html",             // Customer lands on homepage
};

/* =====================
   HELPERS
   ===================== */
function showError(id, message) {
    const el = document.getElementById(id);
    if (el) { el.textContent = message; }
}

function clearError(id) {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; }
}

function setInputState(inputId, state) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.classList.remove("input-error", "input-ok");
    if (state) el.classList.add(state);
}

function showBanner(type, message) {
    const banner = document.getElementById("auth-error");
    const successBanner = document.getElementById("auth-success");
    const msgEl = document.getElementById(type === "error" ? "auth-error-msg" : "auth-success-msg");

    if (type === "error" && banner) {
        banner.style.display = "flex";
        if (successBanner) successBanner.style.display = "none";
        if (msgEl) msgEl.textContent = message;
    } else if (type === "success" && successBanner) {
        successBanner.style.display = "flex";
        if (banner) banner.style.display = "none";
        if (msgEl) msgEl.textContent = message;
    }
}

function hideBanners() {
    const b1 = document.getElementById("auth-error");
    const b2 = document.getElementById("auth-success");
    if (b1) b1.style.display = "none";
    if (b2) b2.style.display = "none";
}

function setLoading(btnId, textId, spinnerId, loading) {
    const btn  = document.getElementById(btnId);
    const text = document.getElementById(textId);
    const spin = document.getElementById(spinnerId);
    if (!btn) return;
    btn.disabled = loading;
    if (text) text.style.display = loading ? "none" : "inline";
    if (spin) spin.style.display = loading ? "inline-block" : "none";
}

function fakeDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* =====================
   PASSWORD VISIBILITY TOGGLE
   ===================== */
function initTogglePw(btnId, inputId, eyeId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    const eye   = document.getElementById(eyeId);
    if (!btn || !input) return;

    btn.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        if (eye) {
            eye.classList.toggle("fa-eye",      !isHidden);
            eye.classList.toggle("fa-eye-slash", isHidden);
        }
    });
}

/* =====================
   PASSWORD STRENGTH (sign-up only)
   ===================== */
function checkStrength(password) {
    let score = 0;
    if (password.length >= 8)               score++;
    if (/[A-Z]/.test(password))             score++;
    if (/[0-9]/.test(password))             score++;
    if (/[^A-Za-z0-9]/.test(password))      score++;

    const bar = document.getElementById("pw-bar");
    if (!bar) return score;

    const map = [
        { pct: "0%",   color: "#eee"     },
        { pct: "30%",  color: "#e05c5c"  },
        { pct: "55%",  color: "#f0a050"  },
        { pct: "80%",  color: "#f0c040"  },
        { pct: "100%", color: "#6dbf8b"  },
    ];
    bar.style.width      = map[score].pct;
    bar.style.background = map[score].color;
    return score;
}

/* =====================
   LOGIN HANDLER
   ===================== */
async function handleLogin(e) {
    e.preventDefault();
    hideBanners();

    const email    = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    // --- Validate ---
    let valid = true;

    clearError("email-error");
    clearError("password-error");
    setInputState("email",    null);
    setInputState("password", null);

    if (!email) {
        showError("email-error", "Email is required.");
        setInputState("email", "input-error");
        valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("email-error", "Please enter a valid email.");
        setInputState("email", "input-error");
        valid = false;
    } else {
        setInputState("email", "input-ok");
    }

    if (!password) {
        showError("password-error", "Password is required.");
        setInputState("password", "input-error");
        valid = false;
    } else {
        setInputState("password", "input-ok");
    }

    if (!valid) return;

    // --- Simulate network request ---
    setLoading("login-btn", "login-btn-text", "login-spinner", true);
    await fakeDelay(900);
    setLoading("login-btn", "login-btn-text", "login-spinner", false);

    // --- Check admin ---
    if (
        email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() &&
        password === ADMIN_CREDENTIALS.password
    ) {
        sessionStorage.setItem("neko_session", JSON.stringify({ role: "admin", email }));
        window.location.href = REDIRECT.admin;
        return;
    }

    // --- Check customer accounts ---
    const users = getUsers();
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        showBanner("error", "No account found with that email. Please sign up first.");
        setInputState("email", "input-error");
        return;
    }

    if (user.password !== password) {
        showBanner("error", "Incorrect password. Please try again.");
        setInputState("password", "input-error");
        return;
    }

    // --- Success ---
    sessionStorage.setItem("neko_session", JSON.stringify({ role: "customer", email, name: user.firstName }));
    window.location.href = REDIRECT.customer;
}

/* =====================
   SIGN-UP HANDLER
   ===================== */
async function handleSignup(e) {
    e.preventDefault();
    hideBanners();

    const firstName = document.getElementById("first-name")?.value.trim();
    const lastName  = document.getElementById("last-name")?.value.trim();
    const email     = document.getElementById("email")?.value.trim();
    const password  = document.getElementById("password")?.value;
    const confirm   = document.getElementById("confirm-password")?.value;
    const terms     = document.getElementById("terms-check")?.checked;

    // --- Validate ---
    let valid = true;

    ["first-name","last-name","email","password","confirm-password"].forEach(id => {
        clearError(id + "-error");
        setInputState(id, null);
    });
    clearError("terms-error");

    if (!firstName) {
        showError("first-name-error", "First name is required.");
        setInputState("first-name", "input-error"); valid = false;
    } else { setInputState("first-name", "input-ok"); }

    if (!lastName) {
        showError("last-name-error", "Last name is required.");
        setInputState("last-name", "input-error"); valid = false;
    } else { setInputState("last-name", "input-ok"); }

    if (!email) {
        showError("email-error", "Email is required.");
        setInputState("email", "input-error"); valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("email-error", "Please enter a valid email.");
        setInputState("email", "input-error"); valid = false;
    } else { setInputState("email", "input-ok"); }

    if (!password) {
        showError("password-error", "Password is required.");
        setInputState("password", "input-error"); valid = false;
    } else if (password.length < 8) {
        showError("password-error", "Password must be at least 8 characters.");
        setInputState("password", "input-error"); valid = false;
    } else { setInputState("password", "input-ok"); }

    if (!confirm) {
        showError("confirm-password-error", "Please confirm your password.");
        setInputState("confirm-password", "input-error"); valid = false;
    } else if (confirm !== password) {
        showError("confirm-password-error", "Passwords do not match.");
        setInputState("confirm-password", "input-error"); valid = false;
    } else { setInputState("confirm-password", "input-ok"); }

    if (!terms) {
        showError("terms-error", "You must accept the Terms & Conditions.");
        valid = false;
    }

    if (!valid) return;

    // --- Check if email already exists ---
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        showBanner("error", "An account with this email already exists. Please log in.");
        setInputState("email", "input-error");
        return;
    }

    // --- Simulate network request ---
    setLoading("signup-btn", "signup-btn-text", "signup-spinner", true);
    await fakeDelay(1000);
    setLoading("signup-btn", "signup-btn-text", "signup-spinner", false);

    // --- Save user (customer only — admins are never created via sign-up) ---
    users.push({ firstName, lastName, email, password, role: "customer", createdAt: new Date().toISOString() });
    saveUsers(users);

    // --- Auto-login and redirect ---
    sessionStorage.setItem("neko_session", JSON.stringify({ role: "customer", email, name: firstName }));

    showBanner("success", `Welcome, ${firstName}! Redirecting you now…`);

    await fakeDelay(1200);
    window.location.href = REDIRECT.customer;
}

/* =====================
   SOCIAL AUTH (placeholder)
   ===================== */
function initSocialAuth() {
    document.getElementById("google-btn")?.addEventListener("click", () => {
        alert("Google sign-in coming soon! Connect your OAuth provider.");
        // TODO: integrate Google OAuth
    });
    document.getElementById("fb-btn")?.addEventListener("click", () => {
        alert("Facebook sign-in coming soon! Connect your OAuth provider.");
        // TODO: integrate Facebook OAuth
    });
}

/* =====================
   INIT — detect which page we're on
   ===================== */
document.addEventListener("DOMContentLoaded", () => {
    const isLogin  = !!document.getElementById("login-form");
    const isSignup = !!document.getElementById("signup-form");

    /* If already logged in, skip the auth pages */
    const session = sessionStorage.getItem("neko_session");
    if (session) {
        try {
            const { role } = JSON.parse(session);
            window.location.href = role === "admin" ? REDIRECT.admin : REDIRECT.customer;
            return;
        } catch {}
    }

    if (isLogin) {
        document.getElementById("login-form").addEventListener("submit", handleLogin);
        initTogglePw("toggle-pw", "password", "pw-eye");
    }

    if (isSignup) {
        document.getElementById("signup-form").addEventListener("submit", handleSignup);
        initTogglePw("toggle-pw",         "password",         "pw-eye");
        initTogglePw("toggle-confirm-pw", "confirm-password", "confirm-pw-eye");

        // Live password strength meter
        document.getElementById("password")?.addEventListener("input", e => {
            checkStrength(e.target.value);
        });
    }

    initSocialAuth();
});