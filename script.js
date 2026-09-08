/* ============================================================
   Deal Spot — Local Marketplace
   Vanilla JavaScript (ES6+) — LocalStorage data layer
   ============================================================ */

/* ---------- Constants ---------- */
const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: '🏠' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'property', label: 'Property', icon: '🏠' },
  { id: 'furniture', label: 'Furniture & Decor', icon: '🛋️' },
  { id: 'fashion', label: 'Fashion & Beauty', icon: '👕' },
  { id: 'sports', label: 'Sports & Fitness', icon: '⚽' },
  { id: 'books', label: 'Books & Hobbies', icon: '📚' },
  { id: 'jobs', label: 'Jobs', icon: '💼' },
  { id: 'services', label: 'Services', icon: '🔧' },
  { id: 'animals', label: 'Animals & Pets', icon: '🐾' },
  { id: 'other', label: 'Other', icon: '📦' },
];

const CITIES = [
  'Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta',
  'Hyderabad','Sialkot','Gujranwala','Bahawalpur','Sukkur','Sargodha','Mardan','Mingora',
  'Gujrat','Kasur','Sheikhupura','Rahim Yar Khan','Jhang','Dera Ghazi Khan','Other'
];

const KEYS = {
  users: 'ds_users',
  session: 'ds_session',
  listings: 'ds_listings',
  bids: 'ds_bids',
  messages: 'ds_messages',
  favorites: 'ds_favorites',
  notifications: 'ds_notifications',
  reviews: 'ds_reviews',
  conversations: 'ds_conversations',
};

/* ---------- Storage Helpers ---------- */
const Store = {
  get(key, fallback = []) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  uid(prefix = 'id') { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
};

/* ---------- App State ---------- */
let currentUser = null;
let currentRoute = { name: 'home', params: {} };
let pendingImages = [];

/* ---------- DOM Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const el = (tag, props = {}, children = []) => {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else if (k === 'innerHTML') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.entries(v).forEach(([dk, dv]) => e.dataset[dk] = dv);
    else e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
};

/* ---------- Toast ---------- */
function toast(msg, type = '') {
  const t = el('div', { className: 'toast ' + type }, msg);
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ---------- Modal ---------- */
function openModal(html, large = false) {
  const root = $('#modal-root');
  root.innerHTML = '';
  const backdrop = el('div', { className: 'modal-backdrop', onclick: closeModal });
  const modal = el('div', { className: 'modal' + (large ? ' modal-lg' : '') });
  modal.innerHTML = html;
  root.appendChild(backdrop);
  root.appendChild(modal);
  root.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  const root = $('#modal-root');
  root.classList.remove('active');
  root.innerHTML = '';
  document.body.style.overflow = '';
}

/* ---------- Auth ---------- */
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return 'h' + h; }

function register(name, email, password, city) {
  const users = Store.get(KEYS.users);
  if (users.find(u => u.email === email)) return { error: 'An account with this email already exists.' };
  const user = {
    id: Store.uid('usr'), name, email, password: hashStr(password), city,
    joined: Date.now(), isAdmin: false, banned: false, avatar: name.charAt(0).toUpperCase(),
  };
  users.push(user);
  Store.set(KEYS.users, users);
  setSession(user);
  return { user };
}

function login(email, password) {
  const users = Store.get(KEYS.users);
  const user = users.find(u => u.email === email && u.password === hashStr(password));
  if (!user) return { error: 'Invalid email or password.' };
  if (user.banned) return { error: 'Your account has been banned. Contact admin.' };
  setSession(user);
  return { user };
}

function setSession(user) {
  currentUser = user;
  Store.set(KEYS.session, { userId: user.id, ts: Date.now() });
}

function logout() {
  currentUser = null;
  localStorage.removeItem(KEYS.session);
  navigate('home');
  renderHeader();
}

function restoreSession() {
  const sess = Store.get(KEYS.session, null);
  if (!sess) return;
  const users = Store.get(KEYS.users);
  const user = users.find(u => u.id === sess.userId);
  if (user && !user.banned) currentUser = user;
}

function requireAuth() {
  if (!currentUser) {
    toast('Please sign in to continue.', 'error');
    openAuthModal();
    return false;
  }
  return true;
}

/* ---------- Auth Modal ---------- */
function openAuthModal(mode = 'login') {
  const isLogin = mode === 'login';
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2>${isLogin ? 'Sign In' : 'Create Account'}</h2>
    <div id="auth-form-wrap">
      <form id="auth-form">
        ${!isLogin ? `
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" name="name" required placeholder="Your name" />
          </div>
        ` : ''}
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" required placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" required placeholder="••••••••" minlength="4" />
        </div>
        ${!isLogin ? `
          <div class="form-group">
            <label>City</label>
            <select name="city" required>
              ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div id="auth-error" class="form-error"></div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;margin-top:8px">
          ${isLogin ? 'Sign In' : 'Register'}
        </button>
      </form>
      <p style="text-align:center;margin-top:16px;font-size:.88rem;color:var(--neutral-600)">
        ${isLogin ? "Don't have an account? " : 'Already have an account? '}
        <a href="#" onclick="event.preventDefault();openAuthModal('${isLogin ? 'register' : 'login'}')">
          ${isLogin ? 'Register' : 'Sign In'}
        </a>
      </p>
    </div>
  `);

  $('#auth-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const result = isLogin
      ? login(fd.get('email'), fd.get('password'))
      : register(fd.get('name'), fd.get('email'), fd.get('password'), fd.get('city'));
    if (result.error) { $('#auth-error').textContent = result.error; return; }
    closeModal();
    toast(isLogin ? 'Welcome back!' : 'Account created!', 'success');
    renderHeader();
    navigate(currentRoute.name, currentRoute.params);
  });
}

/* ---------- Header ---------- */
function renderHeader() {
  const header = $('#header');
  header.innerHTML = '';

  const inner = el('div', { className: 'header-inner' });

  const logo = el('div', { className: 'logo', onclick: () => navigate('home') }, [
    '🛍️ Deal', el('span', {}, 'Spot'),
  ]);
  inner.appendChild(logo);

  const search = el('div', { className: 'search-bar' });
  search.innerHTML = `
    <input type="text" id="search-input" placeholder="Search listings..." />
    <select id="search-city"><option value="">All Cities</option>${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
    <button id="search-btn">Search</button>
  `;
  inner.appendChild(search);

  const actions = el('div', { className: 'header-actions' });

  if (currentUser) {
    const favCount = getFavorites(currentUser.id).length;
    const unread = getUnreadNotifCount(currentUser.id);
    actions.innerHTML = `
      <button class="btn btn-accent" onclick="navigate('create')" title="Sell"><span>＋</span> <span class="btn-text">Sell</span></button>
      <button class="icon-btn" onclick="navigate('favorites')" title="Favorites">❤️${favCount ? `<span class="badge">${favCount}</span>` : ''}</button>
      <button class="icon-btn" onclick="navigate('notifications')" title="Notifications">🔔${unread ? `<span class="badge">${unread}</span>` : ''}</button>
      <button class="icon-btn" onclick="navigate('messages')" title="Messages">💬</button>
      <button class="btn btn-outline" onclick="navigate('dashboard')">Dashboard</button>
      <button class="btn btn-ghost" onclick="logout()">Logout</button>
    `;
  } else {
    actions.innerHTML = `
      <button class="btn btn-accent" onclick="openAuthModal('register')">Register</button>
      <button class="btn btn-outline" onclick="openAuthModal('login')">Sign In</button>
    `;
  }
  inner.appendChild(actions);
  header.appendChild(inner);

  $('#search-btn').addEventListener('click', doSearch);
  $('#search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

function doSearch() {
  const q = $('#search-input').value.trim();
  const city = $('#search-city').value;
  navigate('home', { q, city });
}

/* ---------- Category Bar ---------- */
function renderCategoryBar() {
  const bar = $('#category-bar');
  bar.innerHTML = '';
  const inner = el('div', { className: 'cat-inner' });
  CATEGORIES.forEach(cat => {
    const item = el('button', {
      className: 'cat-item' + (currentRoute.params.cat === cat.id || (cat.id === 'all' && !currentRoute.params.cat) ? ' active' : ''),
      onclick: () => navigate('home', { cat: cat.id }),
    }, `${cat.icon} ${cat.label}`);
    inner.appendChild(item);
  });
  bar.appendChild(inner);
}

/* ---------- Footer ---------- */
function renderFooter() {
  $('#footer').innerHTML = `
    <p>Deal Spot — Local Marketplace for Pakistan 🇵🇰</p>
    <p style="margin-top:6px;opacity:.6">Buy & sell in your city. Prices in Pakistani Rupees (Rs.).</p>
    <button id="dl-btn" style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:10px 20px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-weight:600;font-size:.88rem;cursor:pointer">
      ⬇ Download Project (ZIP)
    </button>
  `;
  const btn = $('#dl-btn');
  if (btn) btn.addEventListener('click', downloadProjectZip);
}

/* ---------- Browser-side ZIP builder (store-only, no compression) ---------- */
function makeZipFile(files) {
  // files: [{ name, content (string) }]
  const enc = new TextEncoder();
  const fileRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const dataBytes = enc.encode(f.content);
    const crc = crc32(dataBytes);

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(localHeader.buffer);
    dv.setUint32(0, 0x04034b50, true);   // signature
    dv.setUint16(4, 20, true);           // version needed
    dv.setUint16(6, 0, true);            // flags
    dv.setUint16(8, 0, true);            // compression: store
    dv.setUint16(10, 0, true);           // mod time
    dv.setUint16(12, 0, true);           // mod date
    dv.setUint32(14, crc, true);         // crc32
    dv.setUint32(18, dataBytes.length, true); // compressed size
    dv.setUint32(22, dataBytes.length, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);           // extra field length
    localHeader.set(nameBytes, 30);

    fileRecords.push(localHeader, dataBytes);

    // Central directory record (46 bytes + name)
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);   // signature
    cv.setUint16(4, 20, true);           // version made by
    cv.setUint16(6, 20, true);           // version needed
    cv.setUint16(8, 0, true);            // flags
    cv.setUint16(10, 0, true);           // compression: store
    cv.setUint16(12, 0, true);           // mod time
    cv.setUint16(14, 0, true);           // mod date
    cv.setUint32(16, crc, true);         // crc32
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);           // extra field length
    cv.setUint16(32, 0, true);           // file comment length
    cv.setUint16(34, 0, true);           // disk number start
    cv.setUint16(36, 0, true);           // internal attrs
    cv.setUint32(38, 0, true);           // external attrs
    cv.setUint32(42, offset, true);       // offset of local header
    central.set(nameBytes, 46);
    centralRecords.push(central);

    offset += localHeader.length + dataBytes.length;
  }

  // End of central directory record
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  const centralSize = centralRecords.reduce((s, r) => s + r.length, 0);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...fileRecords, ...centralRecords, eocd], { type: 'application/zip' });
}

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function downloadProjectZip() {
  const btn = $('#dl-btn');
  if (btn) { btn.textContent = 'Building ZIP...'; btn.disabled = true; }
  try {
    const files = [
      { name: 'index.html', url: '/index.html' },
      { name: 'style.css', url: '/style.css' },
      { name: 'script.js', url: '/script.js' },
      { name: 'package.json', url: '/package.json' },
      { name: 'package-lock.json', url: '/package-lock.json' },
      { name: '.gitignore', url: '/.gitignore' },
    ];
    const contents = [];
    for (const f of files) {
      const resp = await fetch(f.url);
      if (!resp.ok) throw new Error('Failed to fetch ' + f.name);
      const text = await resp.text();
      contents.push({ name: f.name, content: text });
    }
    // Add vite.svg from public
    const svgResp = await fetch('/vite.svg');
    if (svgResp.ok) {
      const svgText = await svgResp.text();
      contents.push({ name: 'public/vite.svg', content: svgText });
    }
    // Add a README
    contents.push({
      name: 'README.txt',
      content: 'Deal Spot — Local Marketplace\n\nBuilt with HTML5, CSS3, and Vanilla JavaScript (ES6+).\nUses LocalStorage for all data.\n\nTo run:\n1. npm install\n2. npm run dev\n\nDemo accounts:\n  ahmed@demo.pk / demo123\n  fatima@demo.pk / demo123\n  bilal@demo.pk / demo123\n',
    });
    const blob = makeZipFile(contents);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deal-spot.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('ZIP downloaded!', 'success');
  } catch (err) {
    toast('Download failed: ' + err.message, 'error');
  }
  if (btn) { btn.textContent = '⬇ Download Project (ZIP)'; btn.disabled = false; }
}

/* ---------- Router ---------- */
function navigate(route, params = {}) {
  currentRoute = { name: route, params };
  closeModal();
  render();
  window.scrollTo(0, 0);
}

function render() {
  renderHeader();
  renderCategoryBar();
  renderFooter();
  const content = $('#content');
  content.innerHTML = '';
  switch (currentRoute.name) {
    case 'home': renderHome(content); break;
    case 'detail': renderDetail(content, currentRoute.params.id); break;
    case 'create': renderCreateEdit(content, null); break;
    case 'edit': renderCreateEdit(content, currentRoute.params.id); break;
    case 'favorites': renderFavorites(content); break;
    case 'seller': renderSellerProfile(content, currentRoute.params.id); break;
    case 'messages': renderMessages(content); break;
    case 'my-listings': renderMyListings(content); break;
    case 'my-bids': renderMyBids(content); break;
    case 'notifications': renderNotifications(content); break;
    case 'dashboard': renderDashboard(content); break;
    case 'admin': renderAdmin(content); break;
    default: renderHome(content);
  }
}

/* ---------- Listings Helpers ---------- */
function getListings() { return Store.get(KEYS.listings); }
function getListing(id) { return getListings().find(l => l.id === id); }
function saveListings(list) { Store.set(KEYS.listings, list); }

function getFavorites(userId) {
  const favs = Store.get(KEYS.favorites);
  return favs.filter(f => f.userId === userId);
}
function isFavorite(userId, listingId) {
  return getFavorites(userId).some(f => f.listingId === listingId);
}
function toggleFavorite(listingId) {
  if (!requireAuth()) return;
  const favs = Store.get(KEYS.favorites);
  const idx = favs.findIndex(f => f.userId === currentUser.id && f.listingId === listingId);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push({ userId: currentUser.id, listingId, ts: Date.now() });
  Store.set(KEYS.favorites, favs);
  renderHeader();
  // Re-render current view if applicable
  if (currentRoute.name === 'favorites') render();
  else render();
}

function getBidsForListing(listingId) { return Store.get(KEYS.bids).filter(b => b.listingId === listingId); }
function getBidsByUser(userId) { return Store.get(KEYS.bids).filter(b => b.buyerId === userId); }

function getUser(userId) { return Store.get(KEYS.users).find(u => u.id === userId); }

function getReviewsForUser(userId) { return Store.get(KEYS.reviews).filter(r => r.sellerId === userId); }

/* ---------- Notifications ---------- */
function addNotification(userId, text, link) {
  const notifs = Store.get(KEYS.notifications);
  notifs.push({ id: Store.uid('ntf'), userId, text, link, read: false, ts: Date.now() });
  Store.set(KEYS.notifications, notifs);
}
function getNotifications(userId) {
  return Store.get(KEYS.notifications).filter(n => n.userId === userId).sort((a, b) => b.ts - a.ts);
}
function getUnreadNotifCount(userId) {
  return Store.get(KEYS.notifications).filter(n => n.userId === userId && !n.read).length;
}
function markAllNotifsRead(userId) {
  const notifs = Store.get(KEYS.notifications);
  notifs.forEach(n => { if (n.userId === userId) n.read = true; });
  Store.set(KEYS.notifications, notifs);
}

/* ---------- Home ---------- */
function renderHome(content) {
  const { q, city, cat } = currentRoute.params;
  let listings = getListings().filter(l => l.status === 'active');

  if (cat && cat !== 'all') listings = listings.filter(l => l.category === cat);
  if (q) {
    const ql = q.toLowerCase();
    listings = listings.filter(l => l.title.toLowerCase().includes(ql) || (l.description && l.description.toLowerCase().includes(ql)));
  }
  if (city) listings = listings.filter(l => l.city === city);

  // Populate search bar if navigated with params
  setTimeout(() => {
    if (q && $('#search-input')) $('#search-input').value = q;
    if (city && $('#search-city')) $('#search-city').value = city;
  }, 0);

  // Hero section
  const hero = el('div', { className: 'hero', style: 'background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;border-radius:var(--radius-xl);padding:40px 28px;margin-bottom:28px;text-align:center' });
  hero.innerHTML = `
    <h1 style="font-size:2rem;margin-bottom:8px">Buy & Sell Locally in Pakistan</h1>
    <p style="opacity:.9;margin-bottom:16px">Find great deals or sell your items — from electronics to property, all in your city.</p>
    <button class="btn btn-lg" style="background:#fff;color:var(--primary)" onclick="navigate('create')">＋ Post a Free Ad</button>
  `;
  content.appendChild(hero);

  // Section title
  const titleText = cat && cat !== 'all'
    ? CATEGORIES.find(c => c.id === cat)?.label || 'Listings'
    : q || city ? 'Search Results' : 'Fresh Arrivals';
  const title = el('h2', { className: 'section-title' }, `${titleText} (${listings.length})`);
  content.appendChild(title);

  if (listings.length === 0) {
    content.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'es-icon' }, '📭'),
      el('div', { className: 'es-text' }, 'No listings found. Try a different search or be the first to post!'),
      el('button', { className: 'btn btn-primary', onclick: () => navigate('create') }, 'Post an Ad'),
    ]));
    return;
  }

  const grid = el('div', { className: 'grid' });
  listings.sort((a, b) => b.createdAt - a.createdAt).forEach(l => grid.appendChild(productCard(l)));
  content.appendChild(grid);
}

/* ---------- Product Card ---------- */
function productCard(l) {
  const seller = getUser(l.sellerId);
  const fav = currentUser && isFavorite(currentUser.id, l.id);
  const card = el('div', { className: 'product-card', onclick: () => navigate('detail', { id: l.id }) });
  card.innerHTML = `
    <div class="img-wrap">
      ${l.images && l.images[0] ? `<img src="${l.images[0]}" alt="${escapeHtml(l.title)}" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--neutral-400)">No Image</div>'}
      ${l.status === 'sold' ? '<div class="sold-badge">SOLD</div>' : ''}
      ${currentUser ? `<button class="fav-btn ${fav ? 'active' : ''}" onclick="event.stopPropagation();toggleFavorite('${l.id}')">${fav ? '❤️' : '🤍'}</button>` : ''}
    </div>
    <div class="info">
      <div class="price">Rs. ${formatNum(l.price)}</div>
      <div class="title">${escapeHtml(l.title)}</div>
      <div class="meta"><span>📍 ${escapeHtml(l.city)}</span><span>${timeAgo(l.createdAt)}</span></div>
    </div>
  `;
  return card;
}

/* ---------- Product Detail ---------- */
function renderDetail(content, id) {
  const l = getListing(id);
  if (!l) {
    content.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'es-icon' }, '🔍'),
      el('div', { className: 'es-text' }, 'This listing no longer exists.'),
      el('button', { className: 'btn btn-primary', onclick: () => navigate('home') }, 'Back to Home'),
    ]));
    return;
  }

  const seller = getUser(l.sellerId);
  const isOwner = currentUser && currentUser.id === l.sellerId;
  const fav = currentUser && isFavorite(currentUser.id, l.id);
  const bids = getBidsForListing(l.id).sort((a, b) => b.amount - a.amount);
  const reviews = getReviewsForUser(l.sellerId);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  let currentImageIdx = 0;
  const images = l.images || [];

  const wrap = el('div', {});
  wrap.innerHTML = `
    <div style="margin-bottom:16px">
      <button class="btn btn-ghost" onclick="navigate('home')">← Back</button>
    </div>
    <div class="detail-grid">
      <div class="detail-gallery">
        <div class="detail-main-img" id="main-img">
          ${images[0] ? `<img src="${images[0]}" alt="" id="main-img-tag" />` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--neutral-400)">No Image</div>'}
        </div>
        ${images.length > 1 ? `<div class="detail-thumbs" id="thumbs">
          ${images.map((img, i) => `<div class="detail-thumb ${i === 0 ? 'active' : ''}" onclick="swapMainImg(${i})"><img src="${img}" alt="" /></div>`).join('')}
        </div>` : ''}
      </div>
      <div class="detail-info">
        <h1>${escapeHtml(l.title)}</h1>
        <div class="detail-price">Rs. ${formatNum(l.price)}</div>
        <div class="detail-meta">
          <span>📍 ${escapeHtml(l.city)}</span>
          <span>📂 ${CATEGORIES.find(c => c.id === l.category)?.label || l.category}</span>
          <span>🕒 ${timeAgo(l.createdAt)}</span>
          ${l.status === 'sold' ? '<span style="color:var(--error);font-weight:700">● SOLD</span>' : ''}
        </div>
        <div class="detail-desc">${escapeHtml(l.description || 'No description provided.')}</div>
        <div class="detail-actions">
          ${!isOwner && currentUser && l.status === 'active' ? `
            <button class="btn btn-primary btn-lg" onclick="openOfferModal('${l.id}')">💬 Make Offer</button>
            <button class="btn btn-outline btn-lg" onclick="startConversation('${l.id}')">✉️ Message Seller</button>
            <button class="btn ${fav ? 'btn-danger' : 'btn-outline'} btn-lg" onclick="toggleFavorite('${l.id}')">${fav ? '❤️ Favorited' : '🤍 Favorite'}</button>
          ` : ''}
          ${!currentUser && l.status === 'active' ? `
            <button class="btn btn-primary btn-lg" onclick="openAuthModal('login')">Sign in to contact seller</button>
          ` : ''}
          ${isOwner && l.status === 'active' ? `
            <button class="btn btn-primary" onclick="navigate('edit',{id:'${l.id}'})">✏️ Edit</button>
            <button class="btn btn-success" style="background:var(--success);color:#fff" onclick="markSold('${l.id}')">✅ Mark as Sold</button>
            <button class="btn btn-danger" onclick="deleteListing('${l.id}')">🗑️ Delete</button>
          ` : ''}
          ${isOwner && l.status === 'sold' ? `
            <button class="btn btn-outline" onclick="markActive('${l.id}')">↩️ Mark as Active</button>
            <button class="btn btn-danger" onclick="deleteListing('${l.id}')">🗑️ Delete</button>
          ` : ''}
        </div>
        ${seller ? `
          <div class="seller-card" onclick="navigate('seller',{id:'${seller.id}'})" style="cursor:pointer">
            <div class="seller-avatar">${seller.avatar || seller.name.charAt(0).toUpperCase()}</div>
            <div>
              <div class="seller-name">${escapeHtml(seller.name)}</div>
              <div class="seller-meta">📍 ${escapeHtml(seller.city)} ${avgRating ? `· ⭐ ${avgRating} (${reviews.length})` : ''}</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
    ${isOwner && bids.length > 0 ? `
      <div style="margin-top:32px">
        <h3 class="section-title">Offers on this item (${bids.length})</h3>
        <div id="bids-container">
          ${bids.map(b => renderBidCard(b, l, true)).join('')}
        </div>
      </div>
    ` : ''}
    ${!isOwner && currentUser ? `
      <div style="margin-top:32px">
        <h3 class="section-title">Your offer on this item</h3>
        <div id="my-bid-section">
          ${renderMyBidSection(l, bids)}
        </div>
      </div>
    ` : ''}
    ${reviews.length > 0 ? `
      <div style="margin-top:32px">
        <h3 class="section-title">Seller Reviews (${reviews.length})</h3>
        ${reviews.map(r => renderReviewCard(r)).join('')}
      </div>
    ` : ''}
    ${!isOwner && currentUser ? `
      <div style="margin-top:32px">
        <h3 class="section-title">Leave a Review for Seller</h3>
        <form id="review-form">
          <div class="form-group">
            <label>Rating</label>
            <div class="stars" id="star-input">
              ${[5,4,3,2,1].map(n => `<input type="radio" name="rating" id="star${n}" value="${n}" /><label class="star-label" for="star${n}" data-val="${n}">★</label>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label>Comment</label>
            <textarea name="comment" placeholder="Share your experience..." required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Submit Review</button>
        </form>
      </div>
    ` : ''}
  `;
  content.appendChild(wrap);

  // Wire up review form
  const reviewForm = $('#review-form');
  if (reviewForm) {
    let selectedRating = 0;
    $$('.star-label', reviewForm).forEach(lbl => {
      lbl.addEventListener('click', () => {
        selectedRating = parseInt(lbl.dataset.val);
        $$('.star-label', reviewForm).forEach(l2 => {
          l2.classList.toggle('selected', parseInt(l2.dataset.val) <= selectedRating);
        });
      });
    });
    reviewForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!selectedRating) { toast('Please select a rating.', 'error'); return; }
      const fd = new FormData(e.target);
      submitReview(l.sellerId, selectedRating, fd.get('comment'));
    });
  }
}

window.swapMainImg = function(idx) {
  const l = getListing(currentRoute.params.id);
  if (!l) return;
  const img = $('#main-img-tag');
  if (img) img.src = l.images[idx];
  $$('#thumbs .detail-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
};

/* ---------- Offer Modal ---------- */
window.openOfferModal = function(listingId) {
  if (!requireAuth()) return;
  const l = getListing(listingId);
  if (!l) return;
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2>Make an Offer</h2>
    <p style="margin-bottom:16px;color:var(--neutral-600)">Listing: <strong>${escapeHtml(l.title)}</strong></p>
    <p style="margin-bottom:16px">Asking price: <strong>Rs. ${formatNum(l.price)}</strong></p>
    <form id="offer-form">
      <div class="form-group">
        <label>Your Offer (Rs.)</label>
        <input type="number" name="amount" min="1" required placeholder="e.g. ${Math.floor(l.price * 0.8)}" />
        <div class="form-hint">Make a fair offer — sellers can accept, reject, or counter.</div>
      </div>
      <div class="form-group">
        <label>Message (optional)</label>
        <textarea name="message" placeholder="Add a note to the seller..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Submit Offer</button>
    </form>
  `);
  $('#offer-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    submitOffer(listingId, parseInt(fd.get('amount')), fd.get('message'));
  });
};

function submitOffer(listingId, amount, message) {
  const l = getListing(listingId);
  if (!l) return;
  if (amount <= 0) { toast('Offer must be greater than 0.', 'error'); return; }
  const bids = Store.get(KEYS.bids);
  const existing = bids.find(b => b.listingId === listingId && b.buyerId === currentUser.id && b.status === 'pending');
  if (existing) {
    existing.amount = amount;
    existing.message = message || '';
    existing.ts = Date.now();
    Store.set(KEYS.bids, bids);
  } else {
    bids.push({
      id: Store.uid('bid'), listingId, buyerId: currentUser.id, sellerId: l.sellerId,
      amount, message: message || '', status: 'pending', counterAmount: 0, ts: Date.now(),
    });
    Store.set(KEYS.bids, bids);
  }
  addNotification(l.sellerId, `New offer of Rs. ${formatNum(amount)} on "${l.title}"`, { name: 'detail', params: { id: listingId } });
  closeModal();
  toast('Offer submitted! The seller will respond soon.', 'success');
  navigate('detail', { id: listingId });
}

/* ---------- Bid Card Render ---------- */
function renderBidCard(b, listing, isOwnerView) {
  const buyer = getUser(b.buyerId);
  const buyerName = buyer ? escapeHtml(buyer.name) : 'Unknown';
  let actions = '';
  if (isOwnerView && b.status === 'pending') {
    actions = `
      <div class="offer-actions">
        <button class="btn btn-sm btn-primary" onclick="respondToOffer('${b.id}','accepted')">Accept</button>
        <button class="btn btn-sm btn-outline" onclick="openCounterModal('${b.id}')">Counter</button>
        <button class="btn btn-sm btn-danger" onclick="respondToOffer('${b.id}','rejected')">Reject</button>
      </div>
    `;
  }
  return `
    <div class="offer-card">
      <div>
        <div class="offer-amount">Rs. ${formatNum(b.amount)}</div>
        <div class="offer-info">From <a onclick="navigate('seller',{id:'${b.buyerId}'})" style="cursor:pointer;font-weight:600">${buyerName}</a> · ${timeAgo(b.ts)}</div>
        ${b.message ? `<div class="offer-info" style="margin-top:4px">"${escapeHtml(b.message)}"</div>` : ''}
        ${b.status === 'counter' && b.counterAmount ? `<div class="offer-info" style="margin-top:4px;color:var(--info)">Seller countered: Rs. ${formatNum(b.counterAmount)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="offer-status ${b.status}">${b.status.toUpperCase()}</span>
        ${actions}
      </div>
    </div>
  `;
}

function renderMyBidSection(l, bids) {
  const myBid = bids.find(b => b.buyerId === currentUser.id);
  if (!myBid) return '<p style="color:var(--neutral-500)">You have not made an offer on this item yet.</p>';
  let extraActions = '';
  if (myBid.status === 'counter' && myBid.counterAmount) {
    extraActions = `
      <div class="offer-actions" style="margin-top:8px">
        <button class="btn btn-sm btn-primary" onclick="acceptCounter('${myBid.id}')">Accept Counter (Rs. ${formatNum(myBid.counterAmount)})</button>
        <button class="btn btn-sm btn-outline" onclick="openOfferModal('${l.id}')">New Offer</button>
      </div>
    `;
  }
  return `
    <div class="offer-card">
      <div>
        <div class="offer-amount">Rs. ${formatNum(myBid.amount)}</div>
        <div class="offer-info">Submitted ${timeAgo(myBid.ts)}</div>
        ${myBid.message ? `<div class="offer-info" style="margin-top:4px">"${escapeHtml(myBid.message)}"</div>` : ''}
      </div>
      <span class="offer-status ${myBid.status}">${myBid.status.toUpperCase()}</span>
    </div>
    ${extraActions}
  `;
}

window.respondToOffer = function(bidId, status) {
  const bids = Store.get(KEYS.bids);
  const b = bids.find(x => x.id === bidId);
  if (!b) return;
  b.status = status;
  Store.set(KEYS.bids, bids);
  const l = getListing(b.listingId);
  const verb = status === 'accepted' ? 'accepted' : 'rejected';
  addNotification(b.buyerId, `Your offer on "${l?.title || 'listing'}" was ${verb}.`, { name: 'detail', params: { id: b.listingId } });
  if (status === 'accepted' && l) {
    // Auto-mark as sold when offer accepted
    l.status = 'sold';
    const listings = getListings();
    const idx = listings.findIndex(x => x.id === l.id);
    if (idx >= 0) { listings[idx] = l; saveListings(listings); }
  }
  toast(`Offer ${verb}.`, status === 'accepted' ? 'success' : 'info');
  navigate('detail', { id: b.listingId });
};

window.openCounterModal = function(bidId) {
  const bids = Store.get(KEYS.bids);
  const b = bids.find(x => x.id === bidId);
  if (!b) return;
  const l = getListing(b.listingId);
  openModal(`
    <button class="modal-close" onclick="closeModal()">✕</button>
    <h2>Counter Offer</h2>
    <p style="margin-bottom:16px">Buyer offered <strong>Rs. ${formatNum(b.amount)}</strong>. Your asking price is <strong>Rs. ${formatNum(l.price)}</strong>.</p>
    <form id="counter-form">
      <div class="form-group">
        <label>Your Counter Amount (Rs.)</label>
        <input type="number" name="counterAmount" min="1" required value="${l.price}" />
      </div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%">Send Counter Offer</button>
    </form>
  `);
  $('#counter-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const ca = parseInt(fd.get('counterAmount'));
    if (ca <= 0) { toast('Counter must be greater than 0.', 'error'); return; }
    b.status = 'counter';
    b.counterAmount = ca;
    Store.set(KEYS.bids, bids);
    addNotification(b.buyerId, `Seller countered your offer on "${l.title}" with Rs. ${formatNum(ca)}.`, { name: 'detail', params: { id: l.id } });
    closeModal();
    toast('Counter offer sent.', 'success');
    navigate('detail', { id: l.id });
  });
};

window.acceptCounter = function(bidId) {
  const bids = Store.get(KEYS.bids);
  const b = bids.find(x => x.id === bidId);
  if (!b) return;
  b.status = 'accepted';
  b.amount = b.counterAmount;
  Store.set(KEYS.bids, bids);
  const l = getListing(b.listingId);
  if (l) {
    l.status = 'sold';
    const listings = getListings();
    const idx = listings.findIndex(x => x.id === l.id);
    if (idx >= 0) { listings[idx] = l; saveListings(listings); }
  }
  addNotification(b.sellerId, `Buyer accepted your counter offer of Rs. ${formatNum(b.counterAmount)} on "${l?.title}".`, { name: 'detail', params: { id: b.listingId } });
  toast('Counter offer accepted! Item marked as sold.', 'success');
  navigate('detail', { id: b.listingId });
};

/* ---------- Start Conversation ---------- */
window.startConversation = function(listingId) {
  if (!requireAuth()) return;
  const l = getListing(listingId);
  if (!l) return;
  if (l.sellerId === currentUser.id) { toast('This is your own listing.', 'info'); return; }
  const convos = Store.get(KEYS.conversations);
  let convo = convos.find(c => c.listingId === listingId && c.buyerId === currentUser.id);
  if (!convo) {
    convo = { id: Store.uid('cnv'), listingId, buyerId: currentUser.id, sellerId: l.sellerId, ts: Date.now() };
    convos.push(convo);
    Store.set(KEYS.conversations, convos);
  }
  navigate('messages', { convoId: convo.id });
};

/* ---------- Mark Sold / Active / Delete ---------- */
window.markSold = function(listingId) {
  const listings = getListings();
  const idx = listings.findIndex(l => l.id === listingId);
  if (idx < 0) return;
  listings[idx].status = 'sold';
  saveListings(listings);
  toast('Item marked as sold.', 'success');
  navigate('detail', { id: listingId });
};

window.markActive = function(listingId) {
  const listings = getListings();
  const idx = listings.findIndex(l => l.id === listingId);
  if (idx < 0) return;
  listings[idx].status = 'active';
  saveListings(listings);
  toast('Item marked as active.', 'success');
  navigate('detail', { id: listingId });
};

window.deleteListing = function(listingId) {
  if (!confirm('Are you sure you want to delete this listing? This cannot be undone.')) return;
  let listings = getListings().filter(l => l.id !== listingId);
  saveListings(listings);
  // Clean up related data
  Store.set(KEYS.bids, Store.get(KEYS.bids).filter(b => b.listingId !== listingId));
  Store.set(KEYS.favorites, Store.get(KEYS.favorites).filter(f => f.listingId !== listingId));
  Store.set(KEYS.conversations, Store.get(KEYS.conversations).filter(c => c.listingId !== listingId));
  toast('Listing deleted.', 'info');
  navigate('my-listings');
};

/* ---------- Create / Edit ---------- */
function renderCreateEdit(content, editId) {
  if (!requireAuth()) return;
  const editing = editId ? getListing(editId) : null;
  if (editing && editing.sellerId !== currentUser.id) {
    toast('You can only edit your own listings.', 'error');
    navigate('home');
    return;
  }
  pendingImages = editing ? [...(editing.images || [])] : [];

  const wrap = el('div', {});
  wrap.innerHTML = `
    <h2 class="section-title">${editing ? 'Edit Listing' : 'Post a New Listing'}</h2>
    <form id="listing-form" style="max-width:640px">
      <div class="form-group">
        <label>Title *</label>
        <input type="text" name="title" required maxlength="120" value="${editing ? escapeHtml(editing.title) : ''}" placeholder="e.g. iPhone 13 Pro Max 256GB" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price (Rs.) *</label>
          <input type="number" name="price" min="1" required value="${editing ? editing.price : ''}" placeholder="e.g. 250000" />
        </div>
        <div class="form-group">
          <label>City *</label>
          <select name="city" required>
            ${CITIES.map(c => `<option value="${c}" ${editing && editing.city === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Category *</label>
        <select name="category" required>
          ${CATEGORIES.filter(c => c.id !== 'all').map(c => `<option value="${c.id}" ${editing && editing.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Description *</label>
        <textarea name="description" required minlength="10" placeholder="Describe your item — condition, features, reason for selling...">${editing ? escapeHtml(editing.description || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Images (up to 5)</label>
        <div class="image-upload" id="img-upload">
          <div style="font-size:2rem">📷</div>
          <div>Click to add images</div>
          <input type="file" id="img-input" accept="image/*" multiple style="display:none" />
        </div>
        <div class="image-preview-grid" id="img-previews">
          ${pendingImages.map((img, i) => `
            <div class="image-preview">
              <img src="${img}" alt="" />
              <button type="button" class="remove-img" onclick="removePendingImage(${i})">✕</button>
            </div>
          `).join('')}
        </div>
        <div class="form-hint">First image will be the cover photo. Max 5 images.</div>
      </div>
      <div style="display:flex;gap:10px">
        <button type="submit" class="btn btn-primary btn-lg">${editing ? 'Update Listing' : 'Post Listing'}</button>
        <button type="button" class="btn btn-outline btn-lg" onclick="navigate('home')">Cancel</button>
      </div>
    </form>
  `;
  content.appendChild(wrap);

  const imgInput = $('#img-input');
  const imgUpload = $('#img-upload');
  imgUpload.addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', e => handleImageUpload(e.target.files));

  $('#listing-form').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = fd.get('title').trim();
    const price = parseInt(fd.get('price'));
    const city = fd.get('city');
    const category = fd.get('category');
    const description = fd.get('description').trim();
    if (!title || !price || !city || !category || !description) { toast('Please fill all fields.', 'error'); return; }
    if (pendingImages.length === 0) { toast('Please add at least one image.', 'error'); return; }

    if (editing) {
      const listings = getListings();
      const idx = listings.findIndex(l => l.id === editing.id);
      if (idx >= 0) {
        listings[idx] = { ...listings[idx], title, price, city, category, description, images: [...pendingImages], updatedAt: Date.now() };
        saveListings(listings);
      }
      toast('Listing updated!', 'success');
      navigate('detail', { id: editing.id });
    } else {
      const listing = {
        id: Store.uid('lst'), title, price, city, category, description,
        images: [...pendingImages], sellerId: currentUser.id,
        status: 'active', createdAt: Date.now(), updatedAt: Date.now(),
      };
      const listings = getListings();
      listings.push(listing);
      saveListings(listings);
      toast('Listing posted!', 'success');
      navigate('detail', { id: listing.id });
    }
  });
}

function handleImageUpload(files) {
  if (!files || files.length === 0) return;
  const remaining = 5 - pendingImages.length;
  if (files.length > remaining) toast(`You can add up to ${remaining} more image(s).`, 'info');
  const toRead = Array.from(files).slice(0, remaining);
  let loaded = 0;
  toRead.forEach(f => {
    if (!f.type.startsWith('image/')) { toast('Only image files allowed.', 'error'); return; }
    if (f.size > 3 * 1024 * 1024) { toast(`${f.name} is too large (max 3MB).`, 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      pendingImages.push(e.target.result);
      loaded++;
      if (loaded === toRead.length) refreshImagePreviews();
    };
    reader.readAsDataURL(f);
  });
}

function refreshImagePreviews() {
  const grid = $('#img-previews');
  if (!grid) return;
  grid.innerHTML = pendingImages.map((img, i) => `
    <div class="image-preview">
      <img src="${img}" alt="" />
      <button type="button" class="remove-img" onclick="removePendingImage(${i})">✕</button>
    </div>
  `).join('');
}

window.removePendingImage = function(idx) {
  pendingImages.splice(idx, 1);
  refreshImagePreviews();
};

/* ---------- Favorites ---------- */
function renderFavorites(content) {
  if (!requireAuth()) return;
  const favs = getFavorites(currentUser.id);
  const listings = favs.map(f => getListing(f.listingId)).filter(Boolean);
  content.appendChild(el('h2', { className: 'section-title' }, `My Favorites (${listings.length})`));
  if (listings.length === 0) {
    content.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'es-icon' }, '❤️'),
      el('div', { className: 'es-text' }, 'You have no favorites yet. Tap the heart on any listing to save it here.'),
      el('button', { className: 'btn btn-primary', onclick: () => navigate('home') }, 'Browse Listings'),
    ]));
    return;
  }
  const grid = el('div', { className: 'grid' });
  listings.forEach(l => grid.appendChild(productCard(l)));
  content.appendChild(grid);
}

/* ---------- Seller Profile ---------- */
function renderSellerProfile(content, userId) {
  const seller = getUser(userId);
  if (!seller) {
    content.appendChild(el('div', { className: 'empty-state' }, [
      el('div', { className: 'es-icon' }, '👤'),
      el('div', { className: 'es-text' }, 'User not found.'),
    ]));
    return;
  }
  const listings = getListings().filter(l => l.sellerId === userId);
  const reviews = getReviewsForUser(userId);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  const wrap = el('div', {});
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px;background:var(--neutral-0);padding:24px;border-radius:var(--radius-lg);box-shadow:var(--shadow-sm)">
      <div class="seller-avatar" style="width:72px;height:72px;font-size:2rem">${seller.avatar || seller.name.charAt(0).toUpperCase()}</div>
      <div>
        <h1 style="font-size:1.4rem">${escapeHtml(seller.name)}</h1>
        <div style="color:var(--neutral-500);font-size:.9rem;margin-top:4px">📍 ${escapeHtml(seller.city)} · Joined ${new Date(seller.joined).toLocaleDateString()}</div>
        <div style="margin-top:6px">${avgRating ? `⭐ <strong>${avgRating}</strong> (${reviews.length} reviews)` : 'No reviews yet'}</div>
        <div style="margin-top:4px;font-size:.9rem;color:var(--neutral-600)">${listings.length} listings · ${listings.filter(l => l.status === 'sold').length} sold</div>
      </div>
    </div>
    ${currentUser && currentUser.id !== userId ? `<button class="btn btn-outline" style="margin-bottom:20px" onclick="startDirectMessage('${userId}')">✉️ Message</button>` : ''}
    <h3 class="section-title">Active Listings (${listings.filter(l => l.status === 'active').length})</h3>
    <div class="grid" id="seller-listings"></div>
    ${reviews.length > 0 ? `
      <h3 class="section-title" style="margin-top:32px">Reviews (${reviews.length})</h3>
      <div id="seller-reviews">${reviews.map(r => renderReviewCard(r)).join('')}</div>
    ` : ''}
  `;
  content.appendChild(wrap);
  const grid = $('#seller-listings');
  const active = listings.filter(l => l.status === 'active');
  if (active.length === 0) {
    grid.innerHTML = '<p style="color:var(--neutral-500)">No active listings.</p>';
  } else {
    active.forEach(l => grid.appendChild(productCard(l)));
  }
}

window.startDirectMessage = function(userId) {
  if (!requireAuth()) return;
  const convos = Store.get(KEYS.conversations);
  let convo = convos.find(c => c.buyerId === currentUser.id && c.sellerId === userId);
  if (!convo) {
    convo = { id: Store.uid('cnv'), listingId: null, buyerId: currentUser.id, sellerId: userId, ts: Date.now() };
    convos.push(convo);
    Store.set(KEYS.conversations, convos);
  }
  navigate('messages', { convoId: convo.id });
};

/* ---------- Reviews ---------- */
function renderReviewCard(r) {
  const reviewer = getUser(r.reviewerId);
  const name = reviewer ? escapeHtml(reviewer.name) : 'Anonymous';
  const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
  return `
    <div class="review-card">
      <div class="review-header">
        <span class="review-author">${name}</span>
        <span class="review-rating">${stars}</span>
      </div>
      <div style="font-size:.88rem;color:var(--neutral-700)">${escapeHtml(r.comment)}</div>
      <div style="font-size:.76rem;color:var(--neutral-500);margin-top:4px">${timeAgo(r.ts)}</div>
    </div>
  `;
}

function submitReview(sellerId, rating, comment) {
  const reviews = Store.get(KEYS.reviews);
  const existing = reviews.find(r => r.reviewerId === currentUser.id && r.sellerId === sellerId);
  if (existing) {
    existing.rating = rating;
    existing.comment = comment;
    existing.ts = Date.now();
    toast('Review updated!', 'success');
  } else {
    reviews.push({ id: Store.uid('rvw'), sellerId, reviewerId: currentUser.id, rating, comment, ts: Date.now() });
    toast('Review submitted!', 'success');
  }
  Store.set(KEYS.reviews, reviews);
  navigate('detail', { id: currentRoute.params.id });
}

/* ---------- Messaging ---------- */
function renderMessages(content) {
  if (!requireAuth()) return;
  const convos = Store.get(KEYS.conversations).filter(c => c.buyerId === currentUser.id || c.sellerId === currentUser.id);
  const messages = Store.get(KEYS.messages);
  const activeConvoId = currentRoute.params.convoId || (convos[0] && convos[0].id);

  const wrap = el('div', {});
  wrap.innerHTML = `
    <h2 class="section-title">Messages</h2>
    ${convos.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">💬</div>
        <div class="es-text">No conversations yet. Start chatting with a seller from any listing.</div>
        <button class="btn btn-primary" onclick="navigate('home')">Browse Listings</button>
      </div>
    ` : `
      <div class="msg-layout">
        <div class="msg-list" id="msg-list"></div>
        <div class="msg-chat" id="msg-chat"></div>
      </div>
    `}
  `;
  content.appendChild(wrap);
  if (convos.length === 0) return;

  const listEl = $('#msg-list');
  convos.forEach(c => {
    const otherId = c.buyerId === currentUser.id ? c.sellerId : c.buyerId;
    const other = getUser(otherId);
    const convoMsgs = messages.filter(m => m.convoId === c.id).sort((a, b) => a.ts - b.ts);
    const last = convoMsgs[convoMsgs.length - 1];
    const l = c.listingId ? getListing(c.listingId) : null;
    const item = el('div', {
      className: 'msg-list-item' + (c.id === activeConvoId ? ' active' : ''),
      onclick: () => navigate('messages', { convoId: c.id }),
    });
    item.innerHTML = `
      <div class="ml-name">${other ? escapeHtml(other.name) : 'Unknown'}${l ? ` <span style="font-weight:400;font-size:.8rem;color:var(--neutral-500)">· ${escapeHtml(l.title)}</span>` : ''}</div>
      <div class="ml-preview">${last ? escapeHtml(last.text.slice(0, 50)) : 'No messages yet'}</div>
    `;
    listEl.appendChild(item);
  });

  renderChatPanel(activeConvoId);
}

function renderChatPanel(convoId) {
  const chatEl = $('#msg-chat');
  if (!chatEl) return;
  const convos = Store.get(KEYS.conversations);
  const convo = convos.find(c => c.id === convoId);
  if (!convo) { chatEl.innerHTML = '<div style="padding:20px;color:var(--neutral-500)">Select a conversation</div>'; return; }
  const otherId = convo.buyerId === currentUser.id ? convo.sellerId : convo.buyerId;
  const other = getUser(otherId);
  const l = convo.listingId ? getListing(convo.listingId) : null;
  const messages = Store.get(KEYS.messages).filter(m => m.convoId === convoId).sort((a, b) => a.ts - b.ts);

  chatEl.innerHTML = `
    <div class="msg-header">
      ${other ? escapeHtml(other.name) : 'Unknown'}
      ${l ? `· <span style="font-weight:400;font-size:.85rem">${escapeHtml(l.title)}</span>` : ''}
    </div>
    <div class="msg-body" id="msg-body">
      ${messages.length === 0 ? '<div style="text-align:center;color:var(--neutral-500);padding:20px">No messages yet. Say hello!</div>' : messages.map(m => `
        <div class="msg-bubble ${m.senderId === currentUser.id ? 'sent' : 'received'}">
          ${escapeHtml(m.text)}
          <div class="msg-time">${new Date(m.ts).toLocaleString()}</div>
        </div>
      `).join('')}
    </div>
    <div class="msg-input">
      <input type="text" id="msg-text" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendMsg('${convoId}')" />
      <button onclick="sendMsg('${convoId}')">Send</button>
    </div>
  `;
  const body = $('#msg-body');
  if (body) body.scrollTop = body.scrollHeight;
}

window.sendMsg = function(convoId) {
  const input = $('#msg-text');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  const messages = Store.get(KEYS.messages);
  messages.push({ id: Store.uid('msg'), convoId, senderId: currentUser.id, text, ts: Date.now() });
  Store.set(KEYS.messages, messages);
  const convo = Store.get(KEYS.conversations).find(c => c.id === convoId);
  if (convo) {
    const otherId = convo.buyerId === currentUser.id ? convo.sellerId : convo.buyerId;
    const l = convo.listingId ? getListing(convo.listingId) : null;
    addNotification(otherId, `New message from ${currentUser.name}${l ? ` about "${l.title}"` : ''}`, { name: 'messages', params: { convoId } });
  }
  renderChatPanel(convoId);
};

/* ---------- My Listings ---------- */
function renderMyListings(content) {
  if (!requireAuth()) return;
  const listings = getListings().filter(l => l.sellerId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt);
  const wrap = el('div', {});
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 class="section-title" style="margin:0">My Listings (${listings.length})</h2>
      <button class="btn btn-primary" onclick="navigate('create')">＋ Post New</button>
    </div>
    ${listings.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">📦</div>
        <div class="es-text">You have no listings yet. Post your first ad — it's free!</div>
        <button class="btn btn-primary" onclick="navigate('create')">Post a Listing</button>
      </div>
    ` : `<div class="grid" id="my-listings-grid"></div>`}
  `;
  content.appendChild(wrap);
  if (listings.length === 0) return;
  const grid = $('#my-listings-grid');
  listings.forEach(l => grid.appendChild(productCard(l)));
}

/* ---------- My Bids ---------- */
function renderMyBids(content) {
  if (!requireAuth()) return;
  const bids = getBidsByUser(currentUser.id).sort((a, b) => b.ts - a.ts);
  const wrap = el('div', {});
  wrap.innerHTML = `
    <h2 class="section-title">My Offers / Bids (${bids.length})</h2>
    ${bids.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">💰</div>
        <div class="es-text">You haven't made any offers yet. Browse listings and make an offer!</div>
        <button class="btn btn-primary" onclick="navigate('home')">Browse Listings</button>
      </div>
    ` : bids.map(b => {
      const l = getListing(b.listingId);
      if (!l) return '';
      return `
        <div class="offer-card">
          <div style="cursor:pointer" onclick="navigate('detail',{id:'${l.id}'})">
            <div style="display:flex;gap:12px;align-items:center">
              ${l.images && l.images[0] ? `<img src="${l.images[0]}" style="width:60px;height:45px;object-fit:cover;border-radius:6px" />` : ''}
              <div>
                <div style="font-weight:700">${escapeHtml(l.title)}</div>
                <div class="offer-info">Asking: Rs. ${formatNum(l.price)} · ${escapeHtml(l.city)}</div>
                <div class="offer-amount" style="font-size:1rem;margin-top:2px">Your offer: Rs. ${formatNum(b.amount)}</div>
                ${b.status === 'counter' && b.counterAmount ? `<div class="offer-info" style="color:var(--info)">Seller countered: Rs. ${formatNum(b.counterAmount)}</div>` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <span class="offer-status ${b.status}">${b.status.toUpperCase()}</span>
            ${b.status === 'counter' && b.counterAmount ? `<button class="btn btn-sm btn-primary" onclick="acceptCounter('${b.id}')">Accept Counter</button>` : ''}
            ${b.status === 'pending' || b.status === 'counter' ? `<button class="btn btn-sm btn-outline" onclick="openOfferModal('${l.id}')">Update Offer</button>` : ''}
          </div>
        </div>
      `;
    }).join('')}
  `;
  content.appendChild(wrap);
}

/* ---------- Notifications ---------- */
function renderNotifications(content) {
  if (!requireAuth()) return;
  const notifs = getNotifications(currentUser.id);
  markAllNotifsRead(currentUser.id);
  renderHeader();
  const wrap = el('div', {});
  wrap.innerHTML = `
    <h2 class="section-title">Notifications (${notifs.length})</h2>
    ${notifs.length === 0 ? `
      <div class="empty-state">
        <div class="es-icon">🔔</div>
        <div class="es-text">No notifications yet. You'll be notified about offers, messages, and reviews.</div>
      </div>
    ` : notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" ${n.link ? `onclick="navigate('${n.link.name}',${JSON.stringify(n.link.params).replace(/"/g,'&quot;')})"` : ''}>
        <div class="notif-icon">${n.text.includes('offer') ? '💰' : n.text.includes('message') ? '💬' : n.text.includes('review') ? '⭐' : '🔔'}</div>
        <div class="notif-text">
          <div class="nt">${escapeHtml(n.text)}</div>
          <div class="nt-time">${timeAgo(n.ts)}</div>
        </div>
      </div>
    `).join('')}
  `;
  content.appendChild(wrap);
}

/* ---------- Dashboard ---------- */
function renderDashboard(content) {
  if (!requireAuth()) return;
  const myListings = getListings().filter(l => l.sellerId === currentUser.id);
  const myBids = getBidsByUser(currentUser.id);
  const favCount = getFavorites(currentUser.id).length;
  const msgs = Store.get(KEYS.messages).filter(m => {
    const c = Store.get(KEYS.conversations).find(c => c.id === m.convoId);
    return c && (c.buyerId === currentUser.id || c.sellerId === currentUser.id) && m.senderId !== currentUser.id;
  });
  const soldCount = myListings.filter(l => l.status === 'sold').length;
  const activeCount = myListings.filter(l => l.status === 'active').length;
  const totalViews = myListings.reduce((s, l) => s + (l.views || 0), 0);
  const acceptedBids = myBids.filter(b => b.status === 'accepted').length;
  const reviews = getReviewsForUser(currentUser.id);
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';

  const wrap = el('div', {});
  wrap.innerHTML = `
    <h2 class="section-title">Dashboard</h2>
    <div class="dash-grid">
      <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-val">${activeCount}</div><div class="stat-label">Active Listings</div></div>
      <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-val">${soldCount}</div><div class="stat-label">Items Sold</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-val">${myBids.length}</div><div class="stat-label">Offers Made</div></div>
      <div class="stat-card"><div class="stat-icon">🤝</div><div class="stat-val">${acceptedBids}</div><div class="stat-label">Offers Accepted</div></div>
      <div class="stat-card"><div class="stat-icon">❤️</div><div class="stat-val">${favCount}</div><div class="stat-label">Favorites</div></div>
      <div class="stat-card"><div class="stat-icon">💬</div><div class="stat-val">${msgs.length}</div><div class="stat-label">Messages Received</div></div>
      <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-val">${avgRating}</div><div class="stat-label">Avg Rating (${reviews.length})</div></div>
      <div class="stat-card"><div class="stat-icon">📅</div><div class="stat-val">${new Date(currentUser.joined).toLocaleDateString()}</div><div class="stat-label">Member Since</div></div>
    </div>
    <div class="tabs">
      <div class="tab active" onclick="switchDashTab(this,'listings')">My Listings</div>
      <div class="tab" onclick="switchDashTab(this,'bids')">My Offers</div>
      <div class="tab" onclick="switchDashTab(this,'favorites')">Favorites</div>
    </div>
    <div id="dash-tab-content"></div>
  `;
  content.appendChild(wrap);
  renderDashTab('listings');
}

window.switchDashTab = function(tabEl, tab) {
  $$('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  renderDashTab(tab);
};

function renderDashTab(tab) {
  const c = $('#dash-tab-content');
  if (!c) return;
  if (tab === 'listings') {
    const listings = getListings().filter(l => l.sellerId === currentUser.id).sort((a, b) => b.createdAt - a.createdAt);
    if (listings.length === 0) { c.innerHTML = '<p style="color:var(--neutral-500)">No listings yet. <a onclick="navigate(\'create\')" style="cursor:pointer">Post one</a>.</p>'; return; }
    c.innerHTML = '<div class="grid" id="dash-grid"></div>';
    listings.forEach(l => $('#dash-grid').appendChild(productCard(l)));
  } else if (tab === 'bids') {
    const bids = getBidsByUser(currentUser.id).sort((a, b) => b.ts - a.ts);
    if (bids.length === 0) { c.innerHTML = '<p style="color:var(--neutral-500)">No offers yet.</p>'; return; }
    c.innerHTML = bids.map(b => {
      const l = getListing(b.listingId);
      if (!l) return '';
      return `
        <div class="offer-card">
          <div style="cursor:pointer" onclick="navigate('detail',{id:'${l.id}'})">
            <div style="font-weight:700">${escapeHtml(l.title)}</div>
            <div class="offer-info">Your offer: Rs. ${formatNum(b.amount)} · ${timeAgo(b.ts)}</div>
          </div>
          <span class="offer-status ${b.status}">${b.status.toUpperCase()}</span>
        </div>
      `;
    }).join('');
  } else if (tab === 'favorites') {
    const favs = getFavorites(currentUser.id);
    const listings = favs.map(f => getListing(f.listingId)).filter(Boolean);
    if (listings.length === 0) { c.innerHTML = '<p style="color:var(--neutral-500)">No favorites yet.</p>'; return; }
    c.innerHTML = '<div class="grid" id="dash-fav-grid"></div>';
    listings.forEach(l => $('#dash-fav-grid').appendChild(productCard(l)));
  }
}

/* ---------- Admin ---------- */
function renderAdmin(content) {
  if (!requireAuth()) return;
  if (!currentUser.isAdmin) {
    // Check if any admin exists; if not, allow first user to become admin
    const users = Store.get(KEYS.users);
    if (users.length > 0 && users[0].id === currentUser.id && !users.some(u => u.isAdmin)) {
      currentUser.isAdmin = true;
      const idx = users.findIndex(u => u.id === currentUser.id);
      if (idx >= 0) { users[idx].isAdmin = true; Store.set(KEYS.users, users); }
    } else {
      content.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'es-icon' }, '🔒'),
        el('div', { className: 'es-text' }, 'Admin access only. The first registered user becomes the admin.'),
        el('button', { className: 'btn btn-primary', onclick: () => navigate('home') }, 'Back to Home'),
      ]));
      return;
    }
  }

  const users = Store.get(KEYS.users);
  const listings = getListings();
  const bids = Store.get(KEYS.bids);
  const reviews = Store.get(KEYS.reviews);

  const wrap = el('div', {});
  wrap.innerHTML = `
    <h2 class="section-title">Admin Moderation Panel</h2>
    <div class="dash-grid">
      <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-val">${users.length}</div><div class="stat-label">Users</div></div>
      <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-val">${listings.length}</div><div class="stat-label">Total Listings</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-val">${bids.length}</div><div class="stat-label">Total Offers</div></div>
      <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-val">${reviews.length}</div><div class="stat-label">Reviews</div></div>
    </div>
    <div class="tabs">
      <div class="tab active" onclick="switchAdminTab(this,'users')">Users</div>
      <div class="tab" onclick="switchAdminTab(this,'listings')">Listings</div>
      <div class="tab" onclick="switchAdminTab(this,'bids')">Offers</div>
    </div>
    <div id="admin-tab-content"></div>
  `;
  content.appendChild(wrap);
  renderAdminTab('users');
}

window.switchAdminTab = function(tabEl, tab) {
  $$('.tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  renderAdminTab(tab);
};

function renderAdminTab(tab) {
  const c = $('#admin-tab-content');
  if (!c) return;
  if (tab === 'users') {
    const users = Store.get(KEYS.users);
    c.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Name</th><th>Email</th><th>City</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.city)}</td>
              <td>${u.isAdmin ? 'Admin' : 'User'}</td>
              <td><span class="status-chip ${u.banned ? 'banned' : 'active'}">${u.banned ? 'BANNED' : 'ACTIVE'}</span></td>
              <td>
                ${u.id !== currentUser.id ? `
                  ${u.banned
                    ? `<button class="btn btn-sm btn-outline" onclick="adminUnbanUser('${u.id}')">Unban</button>`
                    : `<button class="btn btn-sm btn-danger" onclick="adminBanUser('${u.id}')">Ban</button>`
                  }
                  ${!u.isAdmin ? `<button class="btn btn-sm btn-outline" onclick="adminMakeAdmin('${u.id}')">Make Admin</button>` : ''}
                ` : '<span style="color:var(--neutral-500)">You</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else if (tab === 'listings') {
    const listings = getListings().sort((a, b) => b.createdAt - a.createdAt);
    c.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Image</th><th>Title</th><th>Price</th><th>Seller</th><th>City</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${listings.map(l => {
            const s = getUser(l.sellerId);
            return `
              <tr>
                <td>${l.images && l.images[0] ? `<img src="${l.images[0]}" style="width:40px;height:30px;object-fit:cover;border-radius:4px" />` : '—'}</td>
                <td style="cursor:pointer" onclick="navigate('detail',{id:'${l.id}'})">${escapeHtml(l.title)}</td>
                <td>Rs. ${formatNum(l.price)}</td>
                <td>${s ? escapeHtml(s.name) : '—'}</td>
                <td>${escapeHtml(l.city)}</td>
                <td><span class="status-chip ${l.status === 'sold' ? 'banned' : 'active'}">${l.status.toUpperCase()}</span></td>
                <td><button class="btn btn-sm btn-danger" onclick="adminDeleteListing('${l.id}')">Delete</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } else if (tab === 'bids') {
    const bids = Store.get(KEYS.bids).sort((a, b) => b.ts - a.ts);
    c.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Listing</th><th>Buyer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${bids.map(b => {
            const l = getListing(b.listingId);
            const buyer = getUser(b.buyerId);
            return `
              <tr>
                <td>${l ? escapeHtml(l.title) : '—'}</td>
                <td>${buyer ? escapeHtml(buyer.name) : '—'}</td>
                <td>Rs. ${formatNum(b.amount)}</td>
                <td><span class="offer-status ${b.status}">${b.status.toUpperCase()}</span></td>
                <td>${new Date(b.ts).toLocaleDateString()}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }
}

window.adminBanUser = function(userId) {
  const users = Store.get(KEYS.users);
  const u = users.find(x => x.id === userId);
  if (!u) return;
  u.banned = true;
  Store.set(KEYS.users, users);
  toast(`${u.name} has been banned.`, 'info');
  renderAdminTab('users');
};

window.adminUnbanUser = function(userId) {
  const users = Store.get(KEYS.users);
  const u = users.find(x => x.id === userId);
  if (!u) return;
  u.banned = false;
  Store.set(KEYS.users, users);
  toast(`${u.name} has been unbanned.`, 'success');
  renderAdminTab('users');
};

window.adminMakeAdmin = function(userId) {
  const users = Store.get(KEYS.users);
  const u = users.find(x => x.id === userId);
  if (!u) return;
  u.isAdmin = true;
  Store.set(KEYS.users, users);
  toast(`${u.name} is now an admin.`, 'success');
  renderAdminTab('users');
};

window.adminDeleteListing = function(listingId) {
  if (!confirm('Delete this listing permanently?')) return;
  let listings = getListings().filter(l => l.id !== listingId);
  saveListings(listings);
  Store.set(KEYS.bids, Store.get(KEYS.bids).filter(b => b.listingId !== listingId));
  toast('Listing deleted by admin.', 'info');
  renderAdminTab('listings');
};

/* ---------- Utilities ---------- */
function formatNum(n) { return Number(n || 0).toLocaleString('en-PK'); }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000), w = Math.floor(d / 7), mo = Math.floor(d / 30);
  if (mo > 0) return mo + 'mo ago';
  if (w > 0) return w + 'w ago';
  if (d > 0) return d + 'd ago';
  if (h > 0) return h + 'h ago';
  if (m > 0) return m + 'm ago';
  return 'just now';
}

/* ---------- Seed Demo Data ---------- */
function seedData() {
  if (Store.get(KEYS.users, []).length > 0) return;

  const demoUsers = [
    { id: 'usr_demo1', name: 'Ahmed Khan', email: 'ahmed@demo.pk', password: hashStr('demo123'), city: 'Karachi', joined: Date.now() - 86400000 * 30, isAdmin: true, banned: false, avatar: 'A' },
    { id: 'usr_demo2', name: 'Fatima Ali', email: 'fatima@demo.pk', password: hashStr('demo123'), city: 'Lahore', joined: Date.now() - 86400000 * 20, isAdmin: false, banned: false, avatar: 'F' },
    { id: 'usr_demo3', name: 'Bilal Ahmed', email: 'bilal@demo.pk', password: hashStr('demo123'), city: 'Islamabad', joined: Date.now() - 86400000 * 10, isAdmin: false, banned: false, avatar: 'B' },
  ];
  Store.set(KEYS.users, demoUsers);

  const demoListings = [
    {
      id: 'lst_demo1', title: 'iPhone 13 Pro Max 256GB', price: 185000, city: 'Karachi',
      category: 'electronics', description: 'Excellent condition, used for 8 months. Comes with original box, charger and earpods. No scratches. Battery health 92%.',
      images: ['https://images.pexels.com/photos/3945672/pexels-photo-3945672.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'],
      sellerId: 'usr_demo1', status: 'active', createdAt: Date.now() - 3600000 * 5, updatedAt: Date.now() - 3600000 * 5,
    },
    {
      id: 'lst_demo2', title: 'Honda Civic 2018 Oriel', price: 3850000, city: 'Lahore',
      category: 'vehicles', description: '1.5L Turbo, driven 45,000 km. Full service history. Original file, no major accidents. White color, sunroof, navigation.',
      images: ['https://images.pexels.com/photos/25637367/pexels-photo-25637367.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'],
      sellerId: 'usr_demo2', status: 'active', createdAt: Date.now() - 3600000 * 12, updatedAt: Date.now() - 3600000 * 12,
    },
    {
      id: 'lst_demo3', title: '3 Bed Apartment for Rent - DHA Phase 5', price: 65000, city: 'Islamabad',
      category: 'property', description: 'Spacious 3 bedroom apartment in DHA Phase 5. 2 bathrooms, drawing room, kitchen, balcony with view. Parking available. Family preferred.',
      images: ['https://images.pexels.com/photos/7587828/pexels-photo-7587828.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'],
      sellerId: 'usr_demo3', status: 'active', createdAt: Date.now() - 86400000 * 2, updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'lst_demo4', title: 'Gaming PC - RTX 3060, Ryzen 5', price: 145000, city: 'Karachi',
      category: 'electronics', description: 'Ryzen 5 5600X, RTX 3060 12GB, 16GB RAM, 512GB SSD + 1TB HDD. Perfect for gaming and editing. Used for 6 months only.',
      images: ['https://images.pexels.com/photos/30469973/pexels-photo-30469973.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'],
      sellerId: 'usr_demo1', status: 'active', createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000,
    },
    {
      id: 'lst_demo5', title: 'Wooden Dining Table with 6 Chairs', price: 25000, city: 'Lahore',
      category: 'furniture', description: 'Solid wood dining table with 6 cushioned chairs. Excellent condition, barely used. Moving abroad so selling urgently.',
      images: ['https://images.pexels.com/photos/8113029/pexels-photo-8113029.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'],
      sellerId: 'usr_demo2', status: 'active', createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'lst_demo6', title: 'Mountain Bike - Trek Marlin 7', price: 42000, city: 'Islamabad',
      category: 'sports', description: 'Trek Marlin 7, size large. Used for trail riding, well maintained. Recently serviced, new brake pads installed.',
      images: ['https://images.pexels.com/photos/36450314/pexels-photo-36450314.jpeg?auto=compress&cs=tinysrgb&h=650&w=940'],
      sellerId: 'usr_demo3', status: 'active', createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 86400000 * 4,
    },
  ];
  Store.set(KEYS.listings, demoListings);
}

/* ---------- Init ---------- */
function init() {
  seedData();
  restoreSession();
  navigate('home');
}

document.addEventListener('DOMContentLoaded', init);

// Expose globally for inline onclick handlers
window.navigate = navigate;
window.openAuthModal = openAuthModal;
window.closeModal = closeModal;
window.toggleFavorite = toggleFavorite;
window.openOfferModal = openOfferModal;
window.logout = logout;
