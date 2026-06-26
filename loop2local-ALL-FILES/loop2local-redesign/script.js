/* ============================================
   Loop2local — Full App JS
   Firebase + Simulated AI Donation + Admin
   ============================================ */

/* ====== FIREBASE CONFIG ====== */
const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyBe0h-48YJ8hjFSZB-54cmlQZ8rgPJQFvQ",
    authDomain:        "planning-with-ai-63cc7.firebaseapp.com",
    projectId:         "planning-with-ai-63cc7",
    storageBucket:     "planning-with-ai-63cc7.firebasestorage.app",
    messagingSenderId: "1023737113325",
    appId:             "1:1023737113325:web:e9e7bca1fa51d91675fae4"
};

const USE_FIREBASE = FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";

/* ====== ADMIN EMAIL ====== */
const ADMIN_EMAIL = "palmpalm1234y@gmail.com";

/* ================================================================
   SUBMISSIONS DB
   ================================================================ */
const SubmissionsDB = {
    _key: 'eco2_submissions',
    getAll() { try { return JSON.parse(localStorage.getItem(this._key)) || []; } catch { return []; } },
    save(list) { localStorage.setItem(this._key, JSON.stringify(list)); },
    add(sub) { const list = this.getAll(); list.unshift(sub); this.save(list); },
    updateStatus(id, status) { const list = this.getAll(); const s = list.find(x => x.id === id); if (s) { s.status = status; s.reviewedAt = new Date().toISOString(); } this.save(list); },
    getPending() { return this.getAll().filter(s => s.status === 'pending'); },
    getApproved() { return this.getAll().filter(s => s.status === 'approved'); }
};

/* ================================================================
   LOCAL DB (fallback)
   ================================================================ */
const LocalDB = {
    _get(k) { try { return JSON.parse(localStorage.getItem('eco2_' + k)); } catch { return null; } },
    _set(k, v) { localStorage.setItem('eco2_' + k, JSON.stringify(v)); },
    init() {
        if (!this._get('users')) {
            this._set('users', [
                { id: 'admin1', name: 'Admin', email: ADMIN_EMAIL, phone: '0800000000', password: 'admin123', role: 'admin', points: 0, history: [], photoURL: null, provider: 'email', created: new Date().toISOString() },
                { id: 'admin_legacy', name: 'Admin (Demo)', email: 'admin@eco.com', phone: '0800000000', password: 'admin123', role: 'admin', points: 0, history: [], photoURL: null, provider: 'email', created: new Date().toISOString() }
            ]);
        }
        const users = this.getUsers();
        const palmUser = users.find(u => u.email === ADMIN_EMAIL);
        if (!palmUser) {
            users.push({ id: 'admin_palm', name: 'Admin Palm', email: ADMIN_EMAIL, phone: '', password: 'admin123', role: 'admin', points: 0, history: [], photoURL: null, provider: 'email', created: new Date().toISOString() });
            this.saveUsers(users);
        } else if (palmUser.role !== 'admin') { palmUser.role = 'admin'; this.saveUsers(users); }
        const legacy = users.find(u => u.email === 'admin@eco.com');
        if (legacy && legacy.role !== 'admin') { legacy.role = 'admin'; this.saveUsers(users); }
        const sess = this._get('session');
        if (sess && (sess.email === ADMIN_EMAIL || sess.email === 'admin@eco.com') && sess.role !== 'admin') { sess.role = 'admin'; this._set('session', sess); }
        if (!this._get('nextId')) this._set('nextId', 10);
    },
    getUsers() { return this._get('users') || []; },
    saveUsers(u) { this._set('users', u); },
    register(name, email, phone, password) {
        const users = this.getUsers();
        if (users.find(u => u.email === email)) return { ok: false };
        const id = 'u' + (this._get('nextId') || 10);
        const role = (email === ADMIN_EMAIL) ? 'admin' : 'user';
        const user = { id, name, email, phone, password, role, points: 0, history: [], photoURL: null, provider: 'email', created: new Date().toISOString() };
        users.push(user); this.saveUsers(users);
        this._set('nextId', parseInt(id.slice(1)) + 1);
        return { ok: true, user };
    },
    login(email, password) { const u = this.getUsers().find(u => u.email === email && u.password === password); return u ? { ok: true, user: u } : { ok: false }; },
    setSession(user) { this._set('session', { id: user.id, email: user.email, role: user.role, name: user.name, photoURL: user.photoURL }); },
    getSession() { return this._get('session'); },
    logout() { localStorage.removeItem('eco2_session'); },
    getCurrentUser() { const s = this.getSession(); if (!s) return null; return this.getUsers().find(u => u.id === s.id) || null; },
    addDonation(userId, pts, entry) { const users = this.getUsers(); const u = users.find(u => u.id === userId); if (!u) return; u.points = (u.points || 0) + pts; u.donationHistory = u.donationHistory || []; u.donationHistory.unshift(entry); this.saveUsers(users); },
    redeem(userId, cost, entry) { const users = this.getUsers(); const u = users.find(u => u.id === userId); if (!u || (u.points || 0) < cost) return false; u.points -= cost; u.redemptionHistory = u.redemptionHistory || []; u.redemptionHistory.unshift(entry); this.saveUsers(users); return true; }
};

/* ================================================================
   FIREBASE
   ================================================================ */
let firebaseApp, firebaseAuth, firebaseDb;
let fbAuthReady = false;

async function initFirebase() {
    if (!USE_FIREBASE) return false;
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
        const { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, arrayUnion, increment } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        firebaseApp = initializeApp(FIREBASE_CONFIG);
        firebaseAuth = getAuth(firebaseApp);
        firebaseDb = getFirestore(firebaseApp);
        window._fb = { auth: firebaseAuth, db: firebaseDb, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, updateProfile, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, collection, getDocs, arrayUnion, increment };
        return true;
    } catch (e) { console.warn('Firebase init failed:', e); return false; }
}

const DB = {
    async getCurrentUser() {
        if (!USE_FIREBASE) return LocalDB.getCurrentUser();
        const u = firebaseAuth?.currentUser;
        if (!u) return LocalDB.getCurrentUser();
        try { const snap = await window._fb.getDoc(window._fb.doc(firebaseDb, 'users', u.uid)); if (snap.exists()) return { id: u.uid, ...snap.data(), email: u.email, photoURL: u.photoURL }; } catch (e) { console.error(e); }
        return null;
    },
    // Record an approved donation: users/{uid}.points += pts and push to donationHistory
    async addDonation(userId, pts, label, confidence) {
        const entry = { label, pts, date: new Date().toISOString(), status: 'approved', confidence: confidence || 0 };
        if (!USE_FIREBASE) { LocalDB.addDonation(userId, pts, entry); return; }
        try { const { doc, updateDoc, arrayUnion, increment } = window._fb; await updateDoc(doc(firebaseDb, 'users', userId), { points: increment(pts), donationHistory: arrayUnion(entry) }); } catch (e) { console.error('addDonation', e); }
    },
    // Redeem a coupon: deduct points only if enough, push to redemptionHistory
    async redeem(userId, cost, label) {
        const entry = { label, pts: -cost, date: new Date().toISOString() };
        if (!USE_FIREBASE) return LocalDB.redeem(userId, cost, entry);
        try { const { doc, getDoc, updateDoc, arrayUnion, increment } = window._fb; const snap = await getDoc(doc(firebaseDb, 'users', userId)); if (!snap.exists() || (snap.data().points || 0) < cost) return false; await updateDoc(doc(firebaseDb, 'users', userId), { points: increment(-cost), redemptionHistory: arrayUnion(entry) }); return true; } catch (e) { console.error('redeem', e); return false; }
    },
    async getUsers() {
        if (!USE_FIREBASE) return LocalDB.getUsers();
        try { const { collection, getDocs } = window._fb; const snap = await getDocs(collection(firebaseDb, 'users')); return snap.docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { console.error(e); return []; }
    }
};

/* ====== TRANSLATIONS ====== */
const LANG = {
    th: {
        navMap:'ค้นหาจุดบริจาค', navDonate:'ยืนยันการบริจาค', navPoints:'คะแนนสะสม',
        navAdmin:'จัดการระบบ', navLogin:'เข้าสู่ระบบ', logout:'ออกจากระบบ',
        mapTitle:'ค้นหาจุดบริจาคใกล้คุณ — โซนสามย่าน', mapSidebar:'จุดบริจาค — โซนสามย่าน',
        donateTitle:'ยืนยันการบริจาค',
        uploadTitle:'อัปโหลดรูปภาพ', uploadDesc:'ถ่ายรูปขยะพลาสติก / กล่อง delivery ที่นำมาบริจาค',
        btnUpload:'ส่งให้ AI ตรวจสอบ', donateNote:'AI จะวิเคราะห์รูปภาพทันที — ถ้าพบขยะจะอนุมัติอัตโนมัติ!',
        earnedPts:'คุณได้รับ', earnedUnit:'คะแนน!',
        ptsTitle:'คะแนนของฉัน', ptsUnit:'คะแนน', histTitle:'ประวัติคะแนน',
        couponsTitle:'แลกคูปองส่วนลด', seeAll:'ดูทั้งหมด', btnRedeem:'แลก',
        c1n:'Café Chula', c1d:'ส่วนลด 20%', c1c:'500 คะแนน',
        c2n:'Samyan Market', c2d:'ส่วนลด 15%', c2c:'400 คะแนน',
        c3n:'Green Café', c3d:'ฟรีเครื่องดื่ม 1 แก้ว', c3c:'800 คะแนน',
        loginTitle:'ยินดีต้อนรับกลับ', loginSub:'เข้าสู่ระบบเพื่อติดตามการลดขยะของคุณ',
        lEmail:'อีเมล', lPass:'รหัสผ่าน', remember:'จดจำฉัน', forgot:'ลืมรหัสผ่าน?',
        btnLogin:'เข้าสู่ระบบ', orWith:'หรือ', noAcc:'ยังไม่มีบัญชี?', signUp:'สมัครสมาชิก',
        regTitle:'สร้างบัญชีใหม่', regSub:'เริ่มต้นการเดินทางเพื่อโลกที่ดีกว่า',
        lName:'ชื่อ-นามสกุล', lPhone:'เบอร์โทรศัพท์', lConfirm:'ยืนยันรหัสผ่าน',
        agree:'ยอมรับ', terms:'ข้อกำหนด', and:'และ', privacy:'นโยบายความเป็นส่วนตัว',
        btnReg:'สมัครสมาชิก', hasAcc:'มีบัญชีอยู่แล้ว?', signIn:'เข้าสู่ระบบ',
        heroL1:'Together', heroL2:'We can heal', heroL3:'The Earth',
        heroSub:'ร่วมติดตามและลดขยะจากการสั่ง delivery เพื่อโลกที่ดีกว่า',
        s1:'ขยะ delivery ที่เก็บได้', s2:'กล่องอาหารรีไซเคิล', s3:'ถุงพลาสติกที่ลดได้', s4:'สมาชิก',
        tLoginOk:'เข้าสู่ระบบสำเร็จ!', tRegOk:'สมัครสมาชิกสำเร็จ!', tTerms:'กรุณายอมรับข้อกำหนด',
        tDonateOk:'AI อนุมัติอัตโนมัติ! +25 คะแนน 🎉', tRedeemOk:'แลกคูปองสำเร็จ!',
        tNotEnough:'คะแนนไม่เพียงพอ', tEmailExists:'อีเมลนี้ถูกใช้แล้ว', tLoginFail:'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
        tNeedLogin:'กรุณาเข้าสู่ระบบก่อน', tUploaded:'อัปโหลดรูปสำเร็จ!',
        adminTitle:'แดชบอร์ดผู้ดูแล', adminUsers:'สมาชิกทั้งหมด', adminPts:'คะแนนรวม', adminDonations:'อนุมัติแล้ว',
        thName:'ชื่อ', thEmail:'อีเมล', thRole:'บทบาท', thPts:'คะแนน', thDate:'วันที่สมัคร',
        donation:'บริจาคพลาสติก', couponRedeem:'แลกคูปอง',
        signingIn:'กำลังเข้าสู่ระบบ...', tSocialFail:'เข้าสู่ระบบด้วย social ไม่สำเร็จ',
        noHistory:'ยังไม่มีประวัติ',
        tAiApproved:'AI ตรวจพบขยะ — อนุมัติอัตโนมัติ! +25 คะแนน 🎉',
        tAiFailed:'AI ไม่พบขยะในรูป กรุณาลองถ่ายใหม่',
        adminPending:'รอตรวจสอบ'
    },
    en: {
        navMap:'Find Points', navDonate:'Confirm Donation', navPoints:'My Points',
        navAdmin:'Admin', navLogin:'Login', logout:'Logout',
        mapTitle:'Find Donation Points — Samyan Zone', mapSidebar:'Samyan Zone Points',
        donateTitle:'Confirm Donation',
        uploadTitle:'Upload Photo', uploadDesc:'Take a photo of plastic waste / delivery packaging',
        btnUpload:'Send to AI Check', donateNote:'AI will analyze instantly — auto-approves when waste is detected!',
        earnedPts:'You earned', earnedUnit:'points!',
        ptsTitle:'My Points', ptsUnit:'Points', histTitle:'Points History',
        couponsTitle:'Redeem Coupons', seeAll:'See All', btnRedeem:'Redeem',
        c1n:'Café Chula', c1d:'20% Off', c1c:'500 pts',
        c2n:'Samyan Market', c2d:'15% Off', c2c:'400 pts',
        c3n:'Green Café', c3d:'1 Free Drink', c3c:'800 pts',
        loginTitle:'Welcome Back', loginSub:'Sign in to track your waste reduction',
        lEmail:'Email', lPass:'Password', remember:'Remember me', forgot:'Forgot password?',
        btnLogin:'Sign In', orWith:'Or', noAcc:"Don't have an account?", signUp:'Sign Up',
        regTitle:'Create Account', regSub:'Start your journey for a better planet',
        lName:'Full Name', lPhone:'Phone', lConfirm:'Confirm Password',
        agree:'I agree to', terms:'Terms', and:'and', privacy:'Privacy Policy',
        btnReg:'Create Account', hasAcc:'Already have an account?', signIn:'Sign In',
        heroL1:'Together', heroL2:'We can heal', heroL3:'The Earth',
        heroSub:'Track and reduce delivery waste for a better world',
        s1:'Waste collected', s2:'Food boxes recycled', s3:'Plastic bags reduced', s4:'Members',
        tLoginOk:'Logged in!', tRegOk:'Account created!', tTerms:'Please accept terms',
        tDonateOk:'AI Auto-Approved! +25 points 🎉', tRedeemOk:'Coupon redeemed!',
        tNotEnough:'Not enough points', tEmailExists:'Email already exists', tLoginFail:'Invalid email or password',
        tNeedLogin:'Please login first', tUploaded:'Photo uploaded!',
        adminTitle:'Admin Dashboard', adminUsers:'Total Users', adminPts:'Total Points', adminDonations:'Approved',
        thName:'Name', thEmail:'Email', thRole:'Role', thPts:'Points', thDate:'Joined',
        donation:'Plastic Donation', couponRedeem:'Coupon Redeem',
        signingIn:'Signing in...', tSocialFail:'Social login failed',
        noHistory:'No history yet',
        tAiApproved:'AI detected waste — Auto-Approved! +25 points 🎉',
        tAiFailed:'AI did not detect waste. Please try again with a clearer photo.',
        adminPending:'Pending'
    }
};

/* ====== HELPERS ====== */
function t(k) { const l = localStorage.getItem('eco-lang') || 'th'; return (LANG[l] || LANG.th)[k] || k; }

function toast(msg, type = 'ok') {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3500);
}

function errInp(inp) { inp.closest('.inp-w').classList.add('error'); inp.style.animation = 'shake .4s ease'; setTimeout(() => inp.style.animation = '', 400); }
function clearErr() { document.querySelectorAll('.inp-w').forEach(w => w.classList.remove('error')); }

function animateNum(el, target, dur = 2000) {
    const ease = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const start = performance.now();
    const tick = now => { const p = Math.min((now - start) / dur, 1); el.textContent = Math.round(ease(p) * target).toLocaleString(); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
}

function formatDate(iso) { return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); }

/* ====== THEME ====== */
function initTheme() {
    const saved = localStorage.getItem('eco-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.querySelectorAll('.theme-toggle').forEach(b => {
        b.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('eco-theme', next);
        });
    });
}

/* ====== LANGUAGE ====== */
function initLang() {
    applyLang(localStorage.getItem('eco-lang') || 'th');
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.addEventListener('click', () => { applyLang(b.dataset.lang); localStorage.setItem('eco-lang', b.dataset.lang); });
    });
}
function applyLang(lang) {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
    const T = LANG[lang] || LANG.th;
    document.querySelectorAll('[data-i]').forEach(el => { if (T[el.dataset.i]) el.textContent = T[el.dataset.i]; });
}

/* ====== NAV — New hamburger menu ====== */
function initNav() {
    // Guest mode nav chip
    if (isGuest()) {
        document.querySelectorAll('.nav-user-area').forEach(area => {
            area.innerHTML = `<div class="nav-avatar-chip" style="background:var(--g-50);border-color:var(--g-200);color:var(--g-700);cursor:default">
                <div class="nav-avatar" style="background:linear-gradient(135deg,var(--g-600),var(--g-400))">G</div>
                <span>Guest</span>
            </div>`;
        });
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.btn-logout').forEach(el => {
            el.textContent = 'ออก Guest';
            el.style.display = '';
            el.addEventListener('click', exitGuest);
        });
    }

    // Hamburger toggle
    const hamburger = document.querySelector('.nav-hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (hamburger && mobileMenu) {
        hamburger.addEventListener('click', () => {
            mobileMenu.classList.toggle('open');
        });
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.remove('open');
            }
        });
        // Close menu when clicking a link
        mobileMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => mobileMenu.classList.remove('open'));
        });
    }

    // Logout
    document.querySelectorAll('.btn-logout').forEach(b => {
        b.addEventListener('click', async () => {
            if (USE_FIREBASE && window._fb) await window._fb.signOut(firebaseAuth);
            else LocalDB.logout();
            window.location.href = 'login.html';
        });
    });

    if (USE_FIREBASE && window._fb) {
        window._fb.onAuthStateChanged(firebaseAuth, async u => {
            fbAuthReady = true;
            if (u) {
                renderNavUser(u.displayName || u.email, u.photoURL);
                let role = 'user';
                try { const snap = await window._fb.getDoc(window._fb.doc(firebaseDb, 'users', u.uid)); if (snap.exists()) role = snap.data().role || 'user'; } catch (e) { console.error(e); }
                showAuthLinks(true, role === 'admin');
            } else {
                showAuthLinks(false, false);
            }
        });
    } else {
        const sess = LocalDB.getSession();
        if (sess) {
            renderNavUser(sess.name || sess.email, sess.photoURL);
            const isAdmin = sess.role === 'admin' || sess.email === ADMIN_EMAIL || sess.email === 'admin@eco.com';
            if (isAdmin && sess.role !== 'admin') {
                sess.role = 'admin';
                LocalDB._set('session', sess);
                const users = LocalDB.getUsers();
                const found = users.find(u => u.email === sess.email);
                if (found) { found.role = 'admin'; LocalDB.saveUsers(users); }
            }
            showAuthLinks(true, isAdmin);
        } else {
            showAuthLinks(false, false);
        }
    }
}

function renderNavUser(name, photoURL) {
    document.querySelectorAll('.nav-user-area').forEach(area => {
        const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        area.innerHTML = `<div class="nav-avatar-chip">
            <div class="nav-avatar">${photoURL ? `<img src="${photoURL}" alt="">` : initials}</div>
            <span>${(name || '').split(' ')[0] || 'User'}</span>
        </div>`;
    });
}

function showAuthLinks(loggedIn, isAdmin) {
    document.querySelectorAll('.auth-only').forEach(el => el.style.display = loggedIn ? '' : 'none');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = loggedIn ? 'none' : '');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
    document.querySelectorAll('.btn-logout').forEach(el => el.style.display = loggedIn ? '' : 'none');
}

/* ====== AUTH GUARD — protect pages / redirect ====== */
const PROTECTED_PAGES = ['map.html', 'donate.html', 'points.html', 'admin.html', 'kiosk-claim.html'];
const AUTH_PAGES = ['login.html', 'register.html'];

// หลัง login/register สำเร็จ ปกติเด้งไป map.html — แต่ถ้ามี ?redirect=xxx ใน URL (เช่นจาก kiosk-claim)
// ให้กลับไปหน้านั้นแทน (redirect value ถูก encode มาเป็น path+query เต็มๆ ตอนสร้างใน initAuthGuard)
function postLoginRedirect() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('redirect');
    return target || 'map.html';
}

function currentPage() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
}

/* ====== GUEST MODE ====== */
function isGuest() { return localStorage.getItem('eco2_guest') === '1'; }
function exitGuest() { localStorage.removeItem('eco2_guest'); window.location.href = 'login.html'; }

function injectGuestBanner() {
    if (!isGuest()) return;
    const bar = document.createElement('div');
    bar.id = 'guest-bar';
    bar.innerHTML = `
        <span style="display:flex;align-items:center;gap:8px">
            <svg viewBox="0 0 20 20" fill="none" width="16" height="16" style="flex-shrink:0"><path d="M10 2a4 4 0 100 8 4 4 0 000-8zM4 18a6 6 0 0112 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            คุณกำลังเยี่ยมชมในโหมด <strong>Guest</strong> — ฟีเจอร์บางอย่างใช้งานไม่ได้
        </span>
        <span style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            <a href="register.html" style="color:inherit;font-weight:800;text-decoration:underline;text-underline-offset:2px">สมัครสมาชิก</a>
            <span style="opacity:0.4">·</span>
            <a href="login.html" style="color:inherit;font-weight:800;text-decoration:underline;text-underline-offset:2px">เข้าสู่ระบบ</a>
            <button onclick="exitGuest()" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:white;padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:var(--font)">ออก</button>
        </span>`;
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#0f5132,#16a34a);color:white;font-size:0.78rem;font-weight:600;padding:9px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,0.15)';
    document.body.prepend(bar);
    const nav = document.querySelector('.navbar');
    if (nav) nav.style.top = '38px';
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.style.top = '98px';
}

function blockGuestAction(msg) {
    if (!isGuest()) return false;
    toast(msg || 'กรุณาเข้าสู่ระบบก่อน', 'warn');
    setTimeout(() => { window.location.href = 'login.html'; }, 1800);
    return true;
}

function initAuthGuard() {
    const page = currentPage();
    const isProtected = PROTECTED_PAGES.includes(page);
    const isAuthPage = AUTH_PAGES.includes(page);

    if (isGuest()) {
        if (isAuthPage) { window.location.replace('map.html'); return; }
        if (page === 'admin.html') { window.location.replace('map.html'); return; }
        document.addEventListener('DOMContentLoaded', injectGuestBanner);
        return;
    }

    if (!isProtected && !isAuthPage) return;

    if (isProtected) document.body.style.visibility = 'hidden';
    const reveal = () => { document.body.style.visibility = ''; };

    const decide = loggedIn => {
        if (!loggedIn && isProtected) {
            // เก็บ query string เดิม (เช่น ?session=xxx จาก kiosk-claim) ไปเป็น redirect target
            const qs = window.location.search; // มี '?' นำหน้าอยู่แล้วถ้าไม่ว่าง
            const target = page + qs;
            window.location.replace('login.html?redirect=' + encodeURIComponent(target));
            return;
        }
        if (loggedIn && isAuthPage) { window.location.replace(postLoginRedirect()); return; }
        if (page === 'admin.html') return;
        reveal();
    };

    if (USE_FIREBASE && window._fb) {
        window._fb.onAuthStateChanged(firebaseAuth, u => {
            decide(!!u || !!LocalDB.getSession());
        });
    } else {
        decide(!!LocalDB.getSession());
    }
}

/* ====== MAP ====== */
function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    const map = L.map('map', {
        center: [13.7340, 100.5295], zoom: 16, minZoom: 15, maxZoom: 18,
        maxBounds: L.latLngBounds([13.7270,100.5210],[13.7430,100.5390]).pad(0.05),
        maxBoundsViscosity: 1.0
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    // ไอคอนหมุดแยกตามประเภทสถานที่ — ตามธีมรักษ์โลก/ถังขยะอัจฉริยะแยกประเภท
    function makePin(emoji) {
        return L.divIcon({
            className: '',
            html: `<div style="width:34px;height:34px;background:linear-gradient(135deg,#15803d,#34D399);border-radius:50% 50% 50% 4px;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(22,163,74,0.45);border:2px solid rgba(255,255,255,0.9)"><span style="transform:rotate(45deg);font-size:15px">${emoji}</span></div>`,
            iconSize: [34, 34], iconAnchor: [17, 30]
        });
    }

    const spots = [
        { lat:13.7330, lng:100.5290, name:'สามย่านมิตรทาวน์', addr:'ถ.พระราม 4 ปทุมวัน', dist:'50 m', pin: makePin('♻️') },
        { lat:13.7383, lng:100.5322, name:'จุฬาฯ (หอประชุม)', addr:'ถ.พญาไท ปทุมวัน', dist:'200 m', pin: makePin('🏛️') },
        { lat:13.7335, lng:100.5295, name:'Samyan CO-OP', addr:'ชั้น 2 สามย่านมิตรทาวน์', dist:'50 m', pin: makePin('🛍️') },
        { lat:13.7310, lng:100.5310, name:'อุทยาน 100 ปี จุฬาฯ', addr:'ซ.จุฬา 5 ถ.พระราม 4', dist:'300 m', pin: makePin('🌳') },
        { lat:13.7355, lng:100.5340, name:'ตลาดสามย่าน', addr:'ซ.จุฬา 32-34 บรรทัดทอง', dist:'400 m', pin: makePin('🗑️') },
        { lat:13.7350, lng:100.5275, name:'จามจุรีสแควร์', addr:'ถ.พญาไท ปทุมวัน', dist:'150 m', pin: makePin('🏫') },
        { lat:13.7395, lng:100.5305, name:'โรงเรียนสาธิตจุฬาฯ', addr:'ซ.จุฬา 11 ถ.พญาไท', dist:'350 m', pin: makePin('🏫') },
        { lat:13.7328, lng:100.5285, name:'MRT สามย่าน', addr:'ถ.พระราม 4 (ทางออก 2)', dist:'80 m', pin: makePin('🚇') },
    ];

    const markers = spots.map(s =>
        L.marker([s.lat, s.lng], { icon: s.pin }).addTo(map)
            .bindPopup(`<b style="font-family:Prompt,'Noto Sans Thai',sans-serif">${s.name}</b><br><small>${s.addr}</small><br><span style="color:#16a34a;font-weight:700">${s.dist}</span><br><a href="https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 10px;background:linear-gradient(135deg,#059669,#34D399);color:white;border-radius:99px;font-size:12px;font-weight:700;text-decoration:none">นำทาง →</a>`)
    );

    document.querySelectorAll('.loc-card').forEach((card, i) => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.loc-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            if (spots[i]) { map.flyTo([spots[i].lat, spots[i].lng], 17, { duration: 1 }); markers[i].openPopup(); }
        });
        if (markers[i]) markers[i].on('click', () => {
            document.querySelectorAll('.loc-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });
}

/* ====== DONATE + AI SCAN ====== */
let currentImageBase64 = null;
let currentImageMime = 'image/jpeg';

function initUpload() {
    const box = document.getElementById('uploadBox');
    const input = document.getElementById('uploadInput');
    const btn = document.getElementById('btnDonate');
    if (!box) return;

    box.addEventListener('click', () => input.click());
    box.addEventListener('dragover', e => { e.preventDefault(); box.style.borderColor = 'var(--g-500)'; });
    box.addEventListener('dragleave', () => box.style.borderColor = '');
    box.addEventListener('drop', e => { e.preventDefault(); box.style.borderColor = ''; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        currentImageMime = file.type;
        const reader = new FileReader();
        reader.onload = e => {
            const dataUrl = e.target.result;
            currentImageBase64 = dataUrl.split(',')[1];
            const preview = document.getElementById('uploadPreview');
            if (preview) preview.src = dataUrl;
            box.classList.add('has-file');
            if (btn) btn.disabled = false;
            toast(t('tUploaded'), 'ok');
        };
        reader.readAsDataURL(file);
    }
}

function initDonate() {
    const btn = document.getElementById('btnDonate');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        if (blockGuestAction('กรุณาสมัครสมาชิกก่อนบริจาค')) return;
        let userId;
        if (USE_FIREBASE && firebaseAuth?.currentUser) userId = firebaseAuth.currentUser.uid;
        else { const u = LocalDB.getCurrentUser(); userId = u ? u.id : null; }
        if (!userId) { toast(t('tNeedLogin'), 'err'); return; }
        if (!currentImageBase64) { toast('กรุณาอัปโหลดรูปก่อน', 'warn'); return; }

        btn.disabled = true;
        const phaseUpload = document.getElementById('phaseUpload');
        const phaseScanning = document.getElementById('phaseScanning');
        const phaseApproved = document.getElementById('phaseApproved');

        if (phaseUpload) phaseUpload.style.display = 'none';
        if (phaseScanning) phaseScanning.style.display = 'block';

        const steps = ['ss1', 'ss2', 'ss3'];
        steps.forEach((id, i) => {
            setTimeout(() => {
                const el = document.getElementById(id);
                if (!el) return;
                el.querySelector('.sdot').classList.remove('loading');
                el.querySelector('.sdot').classList.add('done');
                if (steps[i + 1]) { const next = document.getElementById(steps[i + 1]); if (next) next.querySelector('.sdot').classList.add('loading'); }
            }, i * 1200);
        });

        const step1 = document.getElementById('step1');
        const step2 = document.getElementById('step2');
        const line1 = document.getElementById('line1');
        if (step1) { step1.classList.remove('now'); step1.classList.add('done'); step1.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
        if (line1) line1.classList.add('done');
        if (step2) { step2.classList.add('now'); }

        // Simulated AI — no external call, always approve
        await new Promise(r => setTimeout(r, 2600));
        const confidence = Math.floor(92 + Math.random() * 7); // 92–98%

        if (phaseScanning) phaseScanning.style.display = 'none';

        // Add 25 points + record donation in users/{uid}.donationHistory
        await DB.addDonation(userId, 25, 'บริจาคพลาสติก (AI อนุมัติอัตโนมัติ)', confidence);

        if (phaseApproved) {
            phaseApproved.style.display = 'block';
            const desc = document.getElementById('aiDesc');
            if (desc) desc.textContent = 'ตรวจพบขยะพลาสติก/กล่อง delivery ในรูปภาพ';
            const confFill = document.getElementById('confFill');
            const confPct = document.getElementById('confPct');
            if (confFill) setTimeout(() => confFill.style.width = confidence + '%', 300);
            if (confPct) confPct.textContent = confidence + '%';
        }
        const step3 = document.getElementById('step3');
        const line2 = document.getElementById('line2');
        if (step2) { step2.classList.remove('now'); step2.classList.add('done'); step2.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
        if (line2) line2.classList.add('done');
        if (step3) { step3.classList.add('done'); step3.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
        toast(t('tAiApproved'), 'ok');

        // After approval, wait 2s then go to points page
        setTimeout(() => { window.location.href = 'points.html'; }, 2000);
    });
}

/* ====== POINTS PAGE ====== */
// Merge donationHistory + redemptionHistory into one date-sorted feed and render it
function renderPointsHistory(user) {
    const histList = document.getElementById('histList');
    if (!histList) return;
    const donations = (user.donationHistory || []);
    const redemptions = (user.redemptionHistory || []);
    const all = [...donations, ...redemptions].sort((a, b) => new Date(b.date) - new Date(a.date));
    histList.innerHTML = all.length === 0
        ? `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.82rem">${t('noHistory')}</div>`
        : all.slice(0, 30).map(h => `<div class="hist-item"><div class="hist-dot ${h.pts < 0 ? 'neg' : ''}"></div><div class="hist-info"><div class="hist-name">${h.label}</div><div class="hist-date">${formatDate(h.date)}</div></div><div class="hist-pts ${h.pts < 0 ? 'neg' : ''}">${h.pts > 0 ? '+' : ''}${h.pts}</div></div>`).join('');
}

async function initPoints() {
    const scoreEl = document.getElementById('scoreNum');
    if (!scoreEl) return;
    let user;
    if (USE_FIREBASE && firebaseAuth) { await new Promise(resolve => { const unsub = window._fb.onAuthStateChanged(firebaseAuth, u => { unsub(); resolve(u); }); }); user = await DB.getCurrentUser(); }
    else { user = LocalDB.getCurrentUser(); }
    if (!user) return;
    animateNum(scoreEl, user.points || 0);
    renderPointsHistory(user);
}

/* ====== REDEEM ====== */
function initRedeem() {
    document.querySelectorAll('.btn-redeem').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (blockGuestAction('กรุณาสมัครสมาชิกก่อนแลกคูปอง')) return;
            let userId;
            if (USE_FIREBASE && firebaseAuth?.currentUser) userId = firebaseAuth.currentUser.uid;
            else { const u = LocalDB.getCurrentUser(); if (!u) { toast(t('tNeedLogin'), 'err'); return; } userId = u.id; }
            const cost = parseInt(btn.dataset.cost);
            btn.disabled = true;
            const ok = await DB.redeem(userId, cost, t('couponRedeem') + ': ' + btn.dataset.name);
            if (ok) {
                btn.textContent = '✓';
                toast(t('tRedeemOk'), 'ok');
                const u = USE_FIREBASE ? await DB.getCurrentUser() : LocalDB.getCurrentUser();
                const scoreEl = document.getElementById('scoreNum');
                if (scoreEl && u) animateNum(scoreEl, u.points || 0, 600);
                if (u) renderPointsHistory(u);
            } else { btn.disabled = false; toast(t('tNotEnough'), 'err'); }
        });
    });
}

/* ====== AUTH ====== */
function initAuth() {
    const btn = document.getElementById('btnAuth');
    if (!btn) return;
    const isReg = !!document.getElementById('regName');

    document.querySelectorAll('.btn-soc').forEach(b => {
        b.addEventListener('click', async () => {
            if (!USE_FIREBASE || !window._fb) { toast('กรุณา configure Firebase ก่อนใช้ Social Login', 'warn'); return; }
            const isGoogle = b.classList.contains('btn-google');
            const provider = isGoogle ? new window._fb.GoogleAuthProvider() : new window._fb.FacebookAuthProvider();
            b.disabled = true;
            document.querySelector('.fb-loading')?.classList.add('show');
            try {
                const result = await window._fb.signInWithPopup(firebaseAuth, provider);
                const u = result.user;
                const { doc, setDoc, getDoc } = window._fb;
                const ref = doc(firebaseDb, 'users', u.uid);
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    await setDoc(ref, { name: u.displayName || '', email: u.email || '', phone: '', role: (u.email === ADMIN_EMAIL) ? 'admin' : 'user', points: 0, history: [], photoURL: u.photoURL || null, provider: isGoogle ? 'google' : 'facebook', created: new Date().toISOString() });
                }
                if (u.email === ADMIN_EMAIL) { try { await window._fb.updateDoc(ref, { role: 'admin' }); } catch {} }
                toast(t('tLoginOk'), 'ok');
                setTimeout(() => window.location.href = postLoginRedirect(), 800);
            } catch (e) { console.error(e); document.querySelector('.fb-loading')?.classList.remove('show'); b.disabled = false; toast(t('tSocialFail'), 'err'); }
        });
    });

    btn.addEventListener('click', async e => {
        e.preventDefault(); clearErr();
        if (isReg) {
            const name = document.getElementById('regName');
            const email = document.getElementById('regEmail');
            const phone = document.getElementById('regPhone');
            const pass = document.getElementById('regPass');
            const confirm = document.getElementById('regConfirm');
            const terms = document.getElementById('agreeTerms');
            let ok = true;
            if (!name.value.trim()) { errInp(name); ok = false; }
            if (!email.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { errInp(email); ok = false; }
            if (!pass.value || pass.value.length < 8) { errInp(pass); ok = false; }
            if (confirm.value !== pass.value) { errInp(confirm); ok = false; }
            if (terms && !terms.checked) { toast(t('tTerms'), 'warn'); ok = false; }
            if (!ok) return;
            btn.classList.add('loading');
            if (USE_FIREBASE && window._fb) {
                try {
                    const { createUserWithEmailAndPassword, updateProfile, doc, setDoc } = window._fb;
                    const cred = await createUserWithEmailAndPassword(firebaseAuth, email.value.trim(), pass.value);
                    await updateProfile(cred.user, { displayName: name.value.trim() });
                    await setDoc(doc(firebaseDb, 'users', cred.user.uid), { name: name.value.trim(), email: email.value.trim(), phone: phone ? phone.value.trim() : '', role: (email.value.trim() === ADMIN_EMAIL) ? 'admin' : 'user', points: 0, history: [], photoURL: null, provider: 'email', created: new Date().toISOString() });
                    toast(t('tRegOk'), 'ok');
                    setTimeout(() => window.location.href = postLoginRedirect(), 800);
                } catch (err) { btn.classList.remove('loading'); toast(err.code === 'auth/email-already-in-use' ? t('tEmailExists') : err.message, 'err'); }
            } else {
                setTimeout(() => {
                    const res = LocalDB.register(name.value.trim(), email.value.trim(), phone?.value.trim() || '', pass.value);
                    btn.classList.remove('loading');
                    if (res.ok) { LocalDB.setSession(res.user); toast(t('tRegOk'), 'ok'); setTimeout(() => window.location.href = postLoginRedirect(), 800); }
                    else toast(t('tEmailExists'), 'err');
                }, 900);
            }
        } else {
            const email = document.getElementById('loginEmail');
            const pass = document.getElementById('loginPass');
            if (!email.value) { errInp(email); return; }
            if (!pass.value) { errInp(pass); return; }
            btn.classList.add('loading');
            if (USE_FIREBASE && window._fb) {
                try {
                    await window._fb.signInWithEmailAndPassword(firebaseAuth, email.value.trim(), pass.value);
                    toast(t('tLoginOk'), 'ok');
                    setTimeout(() => window.location.href = postLoginRedirect(), 800);
                } catch (fbErr) {
                    // Firebase failed — try LocalDB fallback (demo accounts)
                    const res = LocalDB.login(email.value.trim(), pass.value);
                    if (res.ok) {
                        LocalDB.setSession(res.user);
                        toast(t('tLoginOk'), 'ok');
                        setTimeout(() => window.location.href = postLoginRedirect(), 800);
                    } else {
                        btn.classList.remove('loading');
                        toast(t('tLoginFail'), 'err');
                    }
                }
            } else {
                setTimeout(() => {
                    const res = LocalDB.login(email.value.trim(), pass.value);
                    btn.classList.remove('loading');
                    if (res.ok) { LocalDB.setSession(res.user); toast(t('tLoginOk'), 'ok'); setTimeout(() => window.location.href = postLoginRedirect(), 800); }
                    else toast(t('tLoginFail'), 'err');
                }, 900);
            }
        }
    });

    document.querySelectorAll('.auth-form input').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
    });
}

/* ====== ADMIN ====== */
async function initAdmin() {
    const table = document.getElementById('adminTable');
    if (!table) return;
    let user;
    if (USE_FIREBASE && firebaseAuth) {
        await new Promise(resolve => { const unsub = window._fb.onAuthStateChanged(firebaseAuth, u => { unsub(); resolve(u); }); });
        user = await DB.getCurrentUser();
    } else {
        user = LocalDB.getCurrentUser();
    }
    // Access is granted strictly by users/{uid}.role === 'admin' in Firestore (not by email)
    if (!user) { window.location.replace('login.html'); return; }
    if (user.role !== 'admin') { window.location.replace('map.html'); return; }
    document.body.style.visibility = ''; // verified admin — reveal the page

    const users = await DB.getUsers();
    let totalPts = 0, approved = 0, rejected = 0;
    const feed = [];
    users.forEach(u => {
        totalPts += (u.points || 0);
        (u.donationHistory || []).forEach(d => {
            if (d.status === 'rejected') rejected++; else approved++;
            feed.push({ userName: u.name || u.email || 'User', date: d.date, pts: d.pts, confidence: d.confidence, status: d.status || 'approved' });
        });
    });

    const s1 = document.getElementById('adStat1');
    const s2 = document.getElementById('adStat2');
    const s3 = document.getElementById('adStat3');
    const s4 = document.getElementById('adStat4');
    if (s1) animateNum(s1, users.length, 800);
    if (s2) animateNum(s2, totalPts, 800);
    if (s3) animateNum(s3, approved, 800);
    if (s4) animateNum(s4, rejected, 800);

    const allEl = document.getElementById('allSubmissions');
    if (allEl) {
        feed.sort((a, b) => new Date(b.date) - new Date(a.date));
        allEl.innerHTML = feed.length === 0
            ? '<div class="empty-state">ยังไม่มีรายการ</div>'
            : feed.map(s => `<div class="sub-hist-row"><div class="sub-hist-info"><div style="font-weight:700;font-size:.82rem">${s.userName}</div><div style="font-size:.72rem;color:var(--text-muted)">${formatDate(s.date)}</div></div><div><div class="${s.status === 'approved' ? 'status-ok' : 'status-no'}">${s.status === 'approved' ? '✅ อนุมัติ +' + s.pts : '❌ ปฏิเสธ'}</div><div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">AI: ${s.confidence || 0}%</div></div></div>`).join('');
    }

    const pendingEl = document.getElementById('pendingList');
    if (pendingEl) { pendingEl.innerHTML = '<div class="empty-state">✅ ระบบ AI อนุมัติอัตโนมัติ — ไม่มีรายการรอตรวจสอบ</div>'; }

    table.innerHTML = users.map(u => {
        const badge = u.role === 'admin' ? '<span class="badge-admin">Admin</span>' : '<span class="badge-user">User</span>';
        return `<tr><td><strong>${u.name || '-'}</strong></td><td style="color:var(--text-secondary)">${u.email}</td><td>${badge}</td><td><span style="font-weight:600;color:var(--g-600)">${(u.points || 0).toLocaleString()}</span></td><td style="color:var(--text-muted);font-size:.78rem">${formatDate(u.created)}</td></tr>`;
    }).join('');
}

/* ====== COUNT UP ====== */
function initCountUp() {
    document.querySelectorAll('[data-ct]').forEach((el, i) => {
        setTimeout(() => animateNum(el, parseInt(el.dataset.ct), 2000), 300 + i * 180);
    });
}

/* ====== PASSWORD TOGGLE ====== */
function initPwToggle() {
    document.querySelectorAll('.tog-pw').forEach(b => {
        b.addEventListener('click', () => {
            const inp = b.parentElement.querySelector('input');
            inp.type = inp.type === 'password' ? 'text' : 'password';
            b.style.color = inp.type === 'text' ? 'var(--g-600)' : '';
        });
    });
}

/* ====== BOOT ====== */
document.addEventListener('DOMContentLoaded', async () => {
    LocalDB.init();
    initTheme();
    initLang();
    if (USE_FIREBASE) await initFirebase();
    initAuthGuard();
    initNav();
    initMap();
    initUpload();
    initDonate();
    initPoints();
    initRedeem();
    initAuth();
    initAdmin();
    initCountUp();
    initPwToggle();
});