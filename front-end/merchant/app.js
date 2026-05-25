/**
 * FoodMap Merchant Dashboard – app.js
 *
 * Security measures implemented:
 * - All user-facing data rendered via textContent (no innerHTML with user data) to prevent XSS.
 * - JWT access token stored only in memory (module-level variable), NOT in localStorage/sessionStorage.
 * - Refresh token retrieved and sent only via API calls; session_id stored in sessionStorage (non-sensitive ID).
 * - All fetch calls use HTTPS (relative paths in dev; ensure HTTPS in production).
 * - Input values are trimmed and length-checked before submission.
 * - Role check: redirects non-merchant users back to login after login.
 * - TODO(security): Implement CSRF double-submit cookie pattern when switching to cookie-based auth.
 * - TODO(security): Add OAuth2 provider login (Google/Apple) for stronger authentication.
 * - TODO(security): Add MFA (TOTP) for merchant accounts.
 * - TODO(security): Rate-limit login attempts on the client (exponential backoff UI).
 * - TODO(security): Replace localStorage-based session_id with a server-set HttpOnly cookie.
 */

'use strict';

/* ================================================================
   CONFIGURATION
   ================================================================ */
const API_BASE = 'http://localhost:8000/api';

/* ================================================================
   IN-MEMORY TOKEN STORE (never written to localStorage)
   ================================================================ */
let _accessToken = null;   // Bearer token – kept in JS memory only
let _currentUser = null;   // Cached user profile
let _sessionId  = null;    // Session UUID (non-sensitive, used for logout)

/* ================================================================
   UTILITY: Secure API fetch wrapper
   ================================================================ */
async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  // Do not log token or sensitive data – TODO(security): remove all console.log in prod
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin', // Send cookies if any
  });

  return response;
}

/* ================================================================
   UTILITY: Safe DOM helpers (XSS-safe, no innerHTML with user data)
   ================================================================ */
function safeSetText(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = value ?? '';
}

function safeSetVal(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.value = value ?? '';
}

function showEl(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.remove('hidden');
}
function hideEl(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('hidden');
}

function setError(elementId, msg) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = msg; // textContent prevents XSS
  el.classList.remove('hidden');
}
function clearMsg(elementId) {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}
function setSuccess(elementId, msg) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function maskEmail(email) {
  if (!email) return '–';
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const masked = user.length > 2 ? user[0] + '***' + user[user.length - 1] : '***';
  return `${masked}@${domain}`;
}

function formatPrice(val) {
  if (!val) return null;
  return Number(val).toLocaleString('vi-VN') + '₫';
}

function formatRating(val) {
  return val ? Number(val).toFixed(1) : '–';
}

function buildAvatarInitial(username) {
  return (username || '?')[0].toUpperCase();
}

/* ================================================================
   TOAST NOTIFICATIONS (no alert() used – per security guidelines)
   ================================================================ */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = document.createElement('span');
  icon.textContent = icons[type] || icons.info;

  const text = document.createElement('span');
  text.textContent = message; // textContent – XSS safe

  toast.appendChild(icon);
  toast.appendChild(text);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 320);
  }, 3500);
}

/* ================================================================
   NAVIGATION
   ================================================================ */
const PAGES = ['dashboard', 'my-places', 'add-place', 'profile'];

function navigateTo(pageId) {
  PAGES.forEach(id => {
    const page = document.getElementById(`page-${id}`);
    const nav  = document.getElementById(`nav-${id}`);
    if (!page || !nav) return;
    page.classList.toggle('active', id === pageId);
    nav.classList.toggle('active', id === pageId);
  });

  // Load data when navigating
  if (pageId === 'dashboard') loadDashboard();
  if (pageId === 'my-places') loadMyPlaces();
  if (pageId === 'profile') loadProfile();
  if (pageId === 'add-place') resetPlaceForm();

  closeSidebar();
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('visible');
  document.getElementById('sidebar-backdrop')?.classList.add('hidden');
}

/* ================================================================
   AUTH – Login
   ================================================================ */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('login-error');

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    setError('login-error', 'Vui lòng nhập tài khoản và mật khẩu.');
    return;
  }
  if (username.length > 150 || password.length > 128) {
    setError('login-error', 'Thông tin nhập vào không hợp lệ.');
    return;
  }

  // Show loading
  document.getElementById('login-btn-text').classList.add('hidden');
  showEl('login-spinner');
  document.getElementById('login-btn').disabled = true;

  try {
    const resp = await fetch(`${API_BASE}/users/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'same-origin',
    });

    const data = await resp.json();

    if (!resp.ok) {
      setError('login-error', data.error || 'Đăng nhập thất bại.');
      return;
    }

    // Role guard – only merchant may use this panel
    if (data.role !== 'merchant') {
      setError('login-error', 'Tài khoản này không phải Người bán hàng. Vui lòng sử dụng tài khoản Merchant.');
      return;
    }

    // Store token in memory only (not localStorage)
    _accessToken = data.access;
    _currentUser = data.user;
    _sessionId   = data.session_id;

    enterApp();
  } catch {
    setError('login-error', 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  } finally {
    document.getElementById('login-btn-text').classList.remove('hidden');
    hideEl('login-spinner');
    document.getElementById('login-btn').disabled = false;
  }
});

/* ================================================================
   AUTH – Register
   ================================================================ */
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('reg-error');
  clearMsg('reg-success');

  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const birthday = document.getElementById('reg-birthday').value;

  if (!username || !password) {
    setError('reg-error', 'Tài khoản và mật khẩu là bắt buộc.');
    return;
  }
  if (username.length > 150 || password.length > 128) {
    setError('reg-error', 'Thông tin nhập vào vượt quá giới hạn.');
    return;
  }

  document.getElementById('reg-btn-text').classList.add('hidden');
  showEl('reg-spinner');
  document.getElementById('register-btn').disabled = true;

  try {
    const body = { username, password, role: 'merchant' };
    if (email) body.email = email;
    if (birthday) body.birthday = birthday;

    const resp = await fetch(`${API_BASE}/users/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msgs = Object.values(data).flat().join(' ');
      setError('reg-error', msgs || 'Đăng ký thất bại.');
      return;
    }

    setSuccess('reg-success', '🎉 Đăng ký thành công! Hãy đăng nhập để tiếp tục.');
    document.getElementById('register-form').reset();
    setTimeout(() => switchToLogin(), 2000);
  } catch {
    setError('reg-error', 'Không thể kết nối đến máy chủ.');
  } finally {
    document.getElementById('reg-btn-text').classList.remove('hidden');
    hideEl('reg-spinner');
    document.getElementById('register-btn').disabled = false;
  }
});

/* ================================================================
   AUTH – Logout
   ================================================================ */
async function logout() {
  try {
    if (_sessionId) {
      await apiFetch('/users/logout/', {
        method: 'POST',
        body: JSON.stringify({ session_id: _sessionId }),
      });
    }
  } catch { /* swallow */ } finally {
    // Clear all client-side state
    _accessToken = null;
    _currentUser = null;
    _sessionId   = null;
    // Trigger full reload to clear any cached state (security: session lifecycle)
    window.location.href = window.location.pathname;
  }
}

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('logout-btn-mobile').addEventListener('click', logout);

/* ================================================================
   AUTH SCREEN SWITCHING
   ================================================================ */
function switchToRegister() {
  document.getElementById('login-view').classList.remove('active');
  document.getElementById('register-view').classList.add('active');
}
function switchToLogin() {
  document.getElementById('register-view').classList.remove('active');
  document.getElementById('login-view').classList.add('active');
}
document.getElementById('go-register').addEventListener('click', switchToRegister);
document.getElementById('go-login').addEventListener('click', switchToLogin);

/* Password visibility toggle */
document.getElementById('toggle-pw-btn').addEventListener('click', () => {
  const pw = document.getElementById('login-password');
  pw.type = pw.type === 'password' ? 'text' : 'password';
});

/* ================================================================
   ENTER APP
   ================================================================ */
function enterApp() {
  hideEl('auth-overlay');
  document.getElementById('app').classList.remove('hidden');

  updateSidebarUser();
  navigateTo('dashboard');
  loadCategories();
}

function updateSidebarUser() {
  const u = _currentUser;
  if (!u) return;
  safeSetText('sidebar-username', u.username);
  safeSetText('greeting-name', u.username);

  const avatarEl = document.getElementById('sidebar-avatar');
  if (u.avatar) {
    const img = document.createElement('img');
    img.alt = 'Avatar';
    img.src = u.avatar;
    avatarEl.replaceChildren(img);
  } else {
    avatarEl.textContent = buildAvatarInitial(u.username);
  }
}

/* ================================================================
   SIDEBAR MOBILE
   ================================================================ */
document.getElementById('hamburger-btn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  const backdrop = document.getElementById('sidebar-backdrop');
  backdrop.classList.remove('hidden');
  backdrop.classList.add('visible');
});
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

/* Nav items */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});
document.getElementById('btn-go-add').addEventListener('click', () => navigateTo('add-place'));
document.getElementById('btn-go-add-empty')?.addEventListener('click', () => navigateTo('add-place'));
document.getElementById('btn-cancel-form').addEventListener('click', () => navigateTo('my-places'));
document.getElementById('btn-cancel-form-2').addEventListener('click', () => navigateTo('my-places'));

/* ================================================================
   CATEGORIES (for place form select)
   ================================================================ */
let _categories = [];

async function loadCategories() {
  // Hiển thị trạng thái loading trong select
  const sel = document.getElementById('place-category');
  if (sel) {
    sel.replaceChildren();
    const loading = document.createElement('option');
    loading.value = '';
    loading.textContent = 'Đang tải danh mục...';
    sel.appendChild(loading);
    sel.disabled = true;
  }

  try {
    // Gọi API endpoint vừa tạo – không cần auth (AllowAny)
    const resp = await fetch(`${API_BASE}/storefronts/categories/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    _categories = await resp.json();

    if (!Array.isArray(_categories) || _categories.length === 0) {
      showToast('Chưa có danh mục nào trong cơ sở dữ liệu.', 'info');
    }

    populateCategorySelect('place-category');
  } catch (err) {
    // Fail gracefully – không crash app
    _categories = [];
    if (sel) {
      sel.replaceChildren();
      const errOpt = document.createElement('option');
      errOpt.value = '';
      errOpt.textContent = '⚠ Không tải được danh mục – thử lại';
      sel.appendChild(errOpt);
      sel.disabled = false;
    }
    showToast('Không thể tải danh mục từ server.', 'error');
  }
}


function populateCategorySelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  // Clear and rebuild safely
  sel.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Chọn danh mục --';
  sel.appendChild(placeholder);

  _categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = String(cat.id);
    opt.textContent = cat.name; // textContent – XSS safe
    sel.appendChild(opt);
  });

  // Luôn bật lại select sau khi điền xong (fix: bị disabled lúc loading)
  sel.disabled = false;
}


/* ================================================================
   DASHBOARD
   ================================================================ */
async function loadDashboard() {
  safeSetText('stat-places', '…');
  safeSetText('stat-rating', '…');
  safeSetText('stat-reviews', '…');
  safeSetText('stat-top', '…');

  try {
    const [myPlacesResp, topResp] = await Promise.all([
      apiFetch('/storefronts/foodplaces/?manage=true'),
      apiFetch('/storefronts/foodplaces/top_rated/'),
    ]);

    const myPlaces = myPlacesResp.ok ? await myPlacesResp.json() : [];
    const topRated = topResp.ok ? await topResp.json() : [];

    const totalReviews = myPlaces.reduce((s, p) => s + (p.total_reviews || 0), 0);
    const avgRating = myPlaces.length
      ? (myPlaces.reduce((s, p) => s + (p.avg_rating || 0), 0) / myPlaces.length).toFixed(1)
      : '–';

    // Count how many of my places are in top rated
    const myIds = new Set(myPlaces.map(p => p.id));
    const inTop = topRated.filter(p => myIds.has(p.id)).length;

    safeSetText('stat-places', myPlaces.length);
    safeSetText('stat-rating', avgRating);
    safeSetText('stat-reviews', totalReviews);
    safeSetText('stat-top', inTop);

    renderDashboardCards(myPlaces.slice(0, 6));
  } catch {
    safeSetText('stat-places', 'Lỗi');
    showToast('Không thể tải dữ liệu tổng quan.', 'error');
  }
}

function renderDashboardCards(places) {
  const grid = document.getElementById('dashboard-places-grid');
  grid.replaceChildren(); // XSS-safe clear

  if (!places.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Chưa có quán nào. Hãy thêm quán đầu tiên!';
    empty.style.color = 'var(--text-secondary)';
    grid.appendChild(empty);
    return;
  }

  places.forEach(place => {
    grid.appendChild(buildPlaceCard(place));
  });
}

/* ================================================================
   MY PLACES
   ================================================================ */
let _allMyPlaces = [];

async function loadMyPlaces() {
  const list = document.getElementById('my-places-list');
  list.replaceChildren();

  // Show skeletons
  for (let i = 0; i < 3; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton-row';
    list.appendChild(sk);
  }

  try {
    const resp = await apiFetch('/storefronts/foodplaces/?manage=true');
    if (!resp.ok) throw new Error();
    _allMyPlaces = await resp.json();
    renderMyPlaces(_allMyPlaces);
  } catch {
    list.replaceChildren();
    showToast('Không thể tải danh sách quán.', 'error');
  }
}

function renderMyPlaces(places) {
  const list = document.getElementById('my-places-list');
  const empty = document.getElementById('my-places-empty');
  list.replaceChildren();

  if (!places.length) {
    showEl('my-places-empty');
    return;
  }
  hideEl('my-places-empty');

  places.forEach(place => {
    list.appendChild(buildPlaceRow(place));
  });
}

/* Search */
document.getElementById('search-places').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderMyPlaces(_allMyPlaces); return; }
  const filtered = _allMyPlaces.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.address || '').toLowerCase().includes(q)
  );
  renderMyPlaces(filtered);
});

/* ================================================================
   DOM BUILDERS (all textContent – XSS safe)
   ================================================================ */
function buildPlaceCard(place) {
  const card = document.createElement('div');
  card.className = 'place-card';

  const body = document.createElement('div');
  body.className = 'place-card-body';

  // Header
  const header = document.createElement('div');
  header.className = 'place-card-header';

  const name = document.createElement('span');
  name.className = 'place-card-name';
  name.textContent = place.name || '(Không tên)';

  const cat = document.createElement('span');
  cat.className = 'place-card-category';
  cat.textContent = place.category_name || 'Khác';

  header.appendChild(name);
  header.appendChild(cat);

  // Address
  const addr = document.createElement('p');
  addr.className = 'place-card-addr';
  addr.textContent = place.address || '–';

  // Meta
  const meta = document.createElement('div');
  meta.className = 'place-card-meta';

  const rating = document.createElement('span');
  rating.className = 'rating-badge';
  rating.textContent = `⭐ ${formatRating(place.avg_rating)}`;

  const reviews = document.createElement('span');
  reviews.className = 'review-count';
  reviews.textContent = `(${place.total_reviews || 0} đánh giá)`;

  meta.appendChild(rating);
  meta.appendChild(reviews);

  if (place.min_price || place.max_price) {
    const price = document.createElement('span');
    price.className = 'price-range';
    const minP = place.min_price ? formatPrice(place.min_price) : '–';
    const maxP = place.max_price ? formatPrice(place.max_price) : '';
    price.textContent = maxP ? `${minP} – ${maxP}` : minP;
    meta.appendChild(price);
  }

  body.appendChild(header);
  body.appendChild(addr);
  body.appendChild(meta);
  card.appendChild(body);

  // Actions (only show for manage context)
  const actions = document.createElement('div');
  actions.className = 'place-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost';
  editBtn.textContent = '✏️ Sửa';
  editBtn.addEventListener('click', () => openEditModal(place));

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger';
  delBtn.textContent = '🗑 Xóa';
  delBtn.addEventListener('click', () => openDeleteModal(place));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  card.appendChild(actions);

  return card;
}

function buildPlaceRow(place) {
  const row = document.createElement('div');
  row.className = 'place-row';

  const icon = document.createElement('div');
  icon.className = 'place-row-icon';
  icon.textContent = '🏪';

  const info = document.createElement('div');
  info.className = 'place-row-info';

  const rowName = document.createElement('div');
  rowName.className = 'place-row-name';
  rowName.textContent = place.name || '(Không tên)';

  const rowAddr = document.createElement('div');
  rowAddr.className = 'place-row-addr';
  rowAddr.textContent = place.address || '–';

  info.appendChild(rowName);
  info.appendChild(rowAddr);

  const stats = document.createElement('div');
  stats.className = 'place-row-stats';

  const rowRating = document.createElement('span');
  rowRating.className = 'place-row-rating';
  rowRating.textContent = `⭐ ${formatRating(place.avg_rating)}`;

  const rowReviews = document.createElement('span');
  rowReviews.className = 'review-count';
  rowReviews.textContent = `${place.total_reviews || 0} đánh giá`;

  stats.appendChild(rowRating);
  stats.appendChild(rowReviews);

  const acts = document.createElement('div');
  acts.className = 'place-row-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn-icon';
  editBtn.textContent = '✏️';
  editBtn.setAttribute('aria-label', 'Chỉnh sửa quán');
  editBtn.addEventListener('click', () => openEditModal(place));

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon';
  delBtn.textContent = '🗑';
  delBtn.style.color = '#fca5a5';
  delBtn.setAttribute('aria-label', 'Xóa quán');
  delBtn.addEventListener('click', () => openDeleteModal(place));

  acts.appendChild(editBtn);
  acts.appendChild(delBtn);

  row.appendChild(icon);
  row.appendChild(info);
  row.appendChild(stats);
  row.appendChild(acts);

  return row;
}

/* ================================================================
   ADD PLACE (with Leaflet map picker)
   ================================================================ */
let _mapPicker = null;
let _mapMarker = null;
let _editingPlaceId = null;

function resetPlaceForm() {
  _editingPlaceId = null;
  safeSetText('form-page-title', 'Thêm quán mới');
  safeSetText('place-submit-text', 'Tạo quán');
  document.getElementById('place-form').reset();
  document.getElementById('place-id').value = '';
  clearMsg('place-form-error');
  clearMsg('place-form-success');
  hideEl('map-coords');

  // Init map
  setTimeout(initMapPicker, 100);
}
/* ================================================================
   CẦU GIẤY DISTRICT BOUNDS (from GeoServer WMS bbox)
   Source: dacn:cau_giay layer – EPSG:4326
   ================================================================ */
const CAU_GIAY_BOUNDS = {
  south: 21.01766586303711,
  west:  105.77861022949219,
  north: 21.04180145263672,
  east:  105.80133056640625,
};
const CAU_GIAY_LATLNG_BOUNDS = [
  [CAU_GIAY_BOUNDS.south, CAU_GIAY_BOUNDS.west],
  [CAU_GIAY_BOUNDS.north, CAU_GIAY_BOUNDS.east],
];
const CAU_GIAY_CENTER = [
  (CAU_GIAY_BOUNDS.south + CAU_GIAY_BOUNDS.north) / 2,
  (CAU_GIAY_BOUNDS.west  + CAU_GIAY_BOUNDS.east)  / 2,
];
const GEOSERVER_WMS_URL = 'http://localhost:8080/geoserver/dacn/wms';
const GEOSERVER_LAYER   = 'dacn:cau_giay';

function isInsideCauGiay(lat, lng) {
  return lat >= CAU_GIAY_BOUNDS.south && lat <= CAU_GIAY_BOUNDS.north
      && lng >= CAU_GIAY_BOUNDS.west  && lng <= CAU_GIAY_BOUNDS.east;
}


function initMapPicker() {
  const container = document.getElementById('map-picker');
  if (!container) return;

  // Guard: Leaflet may fail to load if CDN is unreachable
  if (typeof L === 'undefined') {
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.background = 'var(--bg-input)';
    container.style.color = 'var(--text-secondary)';
    container.style.fontSize = '14px';
    container.textContent = '⚠️ Không thể tải bản đồ – vui lòng kiểm tra kết nối mạng và tải lại trang.';
    return;
  }

  if (_mapPicker) {
    _mapPicker.remove();
    _mapPicker = null;
    _mapMarker = null;
  }

  // ── Bản đồ giới hạn trong ranh giới Cầu Giấy ──
  _mapPicker = L.map('map-picker', {
    maxBounds: CAU_GIAY_LATLNG_BOUNDS,  // Chặn pan ra ngoài ranh giới
    maxBoundsViscosity: 1.0,            // Cứng – không cho kéo qua biên
    minZoom: 13,
    maxZoom: 19,
  }).setView(CAU_GIAY_CENTER, 15);

  // ── Lớp nền OSM ──
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(_mapPicker);

  // ── Lớp ranh giới Cầu Giấy từ GeoServer WMS ──
  L.tileLayer.wms(GEOSERVER_WMS_URL, {
    layers: GEOSERVER_LAYER,
    format: 'image/png',
    transparent: true,
    version: '1.1.0',
    srs: 'EPSG:4326',
    attribution: 'Ranh giới: GeoServer DACN',
    opacity: 0.9,
  }).addTo(_mapPicker);

  // ── Banner thông báo giới hạn vùng ──
  const areaLabel = L.control({ position: 'bottomleft' });
  areaLabel.onAdd = function () {
    const div = L.DomUtil.create('div');
    div.style.cssText = [
      'background:rgba(249,115,22,0.88)',
      'color:#fff',
      'padding:6px 12px',
      'border-radius:8px',
      'font-size:12px',
      'font-weight:600',
      'font-family:Inter,sans-serif',
      'pointer-events:none',
      'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
    ].join(';');
    div.textContent = '📍 Chỉ chọn vị trí trong ranh giới Cầu Giấy';
    return div;
  };
  areaLabel.addTo(_mapPicker);

  // ── Fit về đúng vùng sau khi init ──
  _mapPicker.fitBounds(CAU_GIAY_LATLNG_BOUNDS, { padding: [20, 20] });

  // ── Xử lý click chọn vị trí ──
  _mapPicker.on('click', (e) => {
    const { lat, lng } = e.latlng;

    // Chỉ nhận điểm trong ranh giới Cầu Giấy
    if (!isInsideCauGiay(lat, lng)) {
      showToast('Vị trí nằm ngoài ranh giới quận Cầu Giấy. Vui lòng chọn lại.', 'error');
      return;
    }

    if (_mapMarker) {
      _mapMarker.setLatLng([lat, lng]);
    } else {
      _mapMarker = L.marker([lat, lng], { title: 'Vị trí quán' }).addTo(_mapPicker);
    }

    document.getElementById('place-lat').value = lat;
    document.getElementById('place-lng').value = lng;

    const coordsText = document.getElementById('coords-text');
    coordsText.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    showEl('map-coords');
  });
}

/* Place form submit */
document.getElementById('place-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('place-form-error');
  clearMsg('place-form-success');

  const name    = document.getElementById('place-name').value.trim();
  const address = document.getElementById('place-address').value.trim();
  const category = document.getElementById('place-category').value;
  const phone   = document.getElementById('place-phone').value.trim();
  const desc    = document.getElementById('place-desc').value.trim();
  const openT   = document.getElementById('place-open').value;
  const closeT  = document.getElementById('place-close').value;
  const minP    = document.getElementById('place-min-price').value;
  const maxP    = document.getElementById('place-max-price').value;
  const lat     = document.getElementById('place-lat').value;
  const lng     = document.getElementById('place-lng').value;

  // Validate
  if (!name)     { setError('place-form-error', 'Tên quán là bắt buộc.'); return; }
  if (!address)  { setError('place-form-error', 'Địa chỉ là bắt buộc.'); return; }
  if (!category) { setError('place-form-error', 'Vui lòng chọn danh mục.'); return; }
  if (!lat || !lng) { setError('place-form-error', 'Vui lòng chọn vị trí trên bản đồ.'); return; }

  if (name.length > 255 || address.length > 255) {
    setError('place-form-error', 'Tên hoặc địa chỉ quá dài.');
    return;
  }
  if (phone && (phone.length > 15 || !/^[\d\s+\-()]+$/.test(phone))) {
    setError('place-form-error', 'Số điện thoại không hợp lệ.');
    return;
  }

  const body = {
    name,
    address,
    category: Number(category),
    phone_number: phone || null,
    description: desc || null,
    opening_time: openT || null,
    closing_time: closeT || null,
    min_price: minP ? Number(minP) : null,
    max_price: maxP ? Number(maxP) : null,
    geom: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
  };

  showEl('place-submit-spinner');
  document.getElementById('place-submit-text').classList.add('hidden');
  document.getElementById('place-submit-btn').disabled = true;

  try {
    const resp = await apiFetch('/storefronts/foodplaces/', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
      setError('place-form-error', msgs || 'Tạo quán thất bại.');
      return;
    }

    setSuccess('place-form-success', '🎉 Quán đã được tạo thành công!');
    showToast('Tạo quán thành công!', 'success');
    document.getElementById('place-form').reset();
    hideEl('map-coords');
    if (_mapMarker) { _mapMarker.remove(); _mapMarker = null; }

    setTimeout(() => navigateTo('my-places'), 1200);
  } catch {
    setError('place-form-error', 'Không thể kết nối đến máy chủ.');
  } finally {
    hideEl('place-submit-spinner');
    document.getElementById('place-submit-text').classList.remove('hidden');
    document.getElementById('place-submit-btn').disabled = false;
  }
});

/* ================================================================
   EDIT MODAL
   ================================================================ */
let _editingPlace = null;

function openEditModal(place) {
  _editingPlace = place;
  clearMsg('edit-form-error');
  clearMsg('edit-form-success');

  safeSetVal('edit-place-id', place.id);
  safeSetVal('edit-place-name', place.name);
  safeSetVal('edit-place-phone', place.phone_number || '');
  safeSetVal('edit-place-open', place.opening_time || '');
  safeSetVal('edit-place-close', place.closing_time || '');
  safeSetVal('edit-place-min', place.min_price || '');
  safeSetVal('edit-place-max', place.max_price || '');
  safeSetVal('edit-place-address', place.address || '');
  safeSetVal('edit-place-desc', place.description || '');

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  _editingPlace = null;
  document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
document.getElementById('edit-modal-cancel').addEventListener('click', closeEditModal);
document.getElementById('edit-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('edit-modal')) closeEditModal();
});

document.getElementById('edit-place-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('edit-form-error');
  clearMsg('edit-form-success');

  const id      = document.getElementById('edit-place-id').value;
  const name    = document.getElementById('edit-place-name').value.trim();
  const phone   = document.getElementById('edit-place-phone').value.trim();
  const openT   = document.getElementById('edit-place-open').value;
  const closeT  = document.getElementById('edit-place-close').value;
  const minP    = document.getElementById('edit-place-min').value;
  const maxP    = document.getElementById('edit-place-max').value;
  const address = document.getElementById('edit-place-address').value.trim();
  const desc    = document.getElementById('edit-place-desc').value.trim();

  if (!name) { setError('edit-form-error', 'Tên quán là bắt buộc.'); return; }
  if (name.length > 255) { setError('edit-form-error', 'Tên quán quá dài.'); return; }
  if (phone && !/^[\d\s+\-()]+$/.test(phone)) {
    setError('edit-form-error', 'Số điện thoại không hợp lệ.');
    return;
  }

  const body = {
    name,
    address: address || undefined,
    phone_number: phone || null,
    opening_time: openT || null,
    closing_time: closeT || null,
    min_price: minP ? Number(minP) : null,
    max_price: maxP ? Number(maxP) : null,
    description: desc || null,
  };

  showEl('edit-submit-spinner');
  document.getElementById('edit-submit-text').classList.add('hidden');
  document.getElementById('edit-submit-btn').disabled = true;

  try {
    const resp = await apiFetch(`/storefronts/foodplaces/${encodeURIComponent(id)}/`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msgs = Object.values(data).flat().join(' ');
      setError('edit-form-error', msgs || 'Cập nhật thất bại.');
      return;
    }

    setSuccess('edit-form-success', 'Cập nhật thành công!');
    showToast('Thông tin quán đã được cập nhật!', 'success');

    setTimeout(() => {
      closeEditModal();
      loadMyPlaces();
      loadDashboard();
    }, 1000);
  } catch {
    setError('edit-form-error', 'Không thể kết nối đến máy chủ.');
  } finally {
    hideEl('edit-submit-spinner');
    document.getElementById('edit-submit-text').classList.remove('hidden');
    document.getElementById('edit-submit-btn').disabled = false;
  }
});

/* ================================================================
   DELETE MODAL
   ================================================================ */
let _deletePlace = null;

function openDeleteModal(place) {
  _deletePlace = place;
  const nameEl = document.getElementById('delete-place-name');
  nameEl.textContent = place.name || '(Không tên)'; // textContent – XSS safe
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  _deletePlace = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

document.getElementById('delete-modal-close').addEventListener('click', closeDeleteModal);
document.getElementById('delete-cancel-btn').addEventListener('click', closeDeleteModal);
document.getElementById('delete-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
});

document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
  if (!_deletePlace) return;

  showEl('delete-spinner');
  document.getElementById('delete-btn-text').classList.add('hidden');
  document.getElementById('delete-confirm-btn').disabled = true;

  try {
    const resp = await apiFetch(`/storefronts/foodplaces/${encodeURIComponent(_deletePlace.id)}/`, {
      method: 'DELETE',
    });

    if (resp.ok || resp.status === 204) {
      showToast('Đã xóa quán thành công!', 'success');
      closeDeleteModal();
      loadMyPlaces();
      loadDashboard();
    } else {
      showToast('Xóa quán thất bại. Vui lòng thử lại.', 'error');
    }
  } catch {
    showToast('Không thể kết nối đến máy chủ.', 'error');
  } finally {
    hideEl('delete-spinner');
    document.getElementById('delete-btn-text').classList.remove('hidden');
    document.getElementById('delete-confirm-btn').disabled = false;
  }
});

/* ================================================================
   PROFILE
   ================================================================ */
async function loadProfile() {
  if (!_currentUser) return;

  const u = _currentUser;
  safeSetVal('profile-username', u.username);
  safeSetVal('profile-email', u.email || '');
  safeSetVal('profile-birthday', u.birthday || '');

  safeSetText('profile-display-name', u.username);
  // Masked email display (PII protection)
  safeSetText('profile-email-masked', maskEmail(u.email));

  const avatarEl = document.getElementById('profile-avatar-preview');
  if (u.avatar) {
    const img = document.createElement('img');
    img.alt = 'Avatar';
    img.src = u.avatar;
    avatarEl.replaceChildren(img);
  } else {
    avatarEl.textContent = buildAvatarInitial(u.username);
  }
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('profile-error');
  clearMsg('profile-success');

  const email    = document.getElementById('profile-email').value.trim();
  const birthday = document.getElementById('profile-birthday').value;

  // Basic email validation
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('profile-error', 'Email không hợp lệ.');
    return;
  }
  if (email && email.length > 254) {
    setError('profile-error', 'Email quá dài.');
    return;
  }

  const body = {};
  if (email) body.email = email;
  if (birthday) body.birthday = birthday;

  showEl('profile-save-spinner');
  document.getElementById('profile-save-text').classList.add('hidden');
  document.getElementById('profile-save-btn').disabled = true;

  try {
    const resp = await apiFetch('/users/update_profile/', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const msgs = Object.values(data).flat().join(' ');
      setError('profile-error', msgs || 'Cập nhật thất bại.');
      return;
    }

    _currentUser = { ..._currentUser, ...data.data };
    setSuccess('profile-success', '✅ Cập nhật hồ sơ thành công!');
    showToast('Hồ sơ đã được cập nhật!', 'success');
    safeSetText('profile-email-masked', maskEmail(_currentUser.email));
  } catch {
    setError('profile-error', 'Không thể kết nối đến máy chủ.');
  } finally {
    hideEl('profile-save-spinner');
    document.getElementById('profile-save-text').classList.remove('hidden');
    document.getElementById('profile-save-btn').disabled = false;
  }
});

/* ================================================================
   SESSION RESTORE – check if we have a valid session on page load
   ================================================================ */
(async function restoreSession() {
  // We don't persist tokens to localStorage (security).
  // On page refresh, user must log in again.
  // The auth overlay is shown by default.
  // TODO(security): Implement silent token refresh via HttpOnly cookie if backend supports it.
})();

/* ================================================================
   KEYBOARD: close modals on Escape
   ================================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeDeleteModal();
  }
});
