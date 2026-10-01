try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {}
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { data, save } = require('./db');

const app = express();
app.use(express.json({ limit: '200kb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

const hits = new Map();
function limiter(name, max, windowMs, countGet) {
  return (req, res, next) => {
    if (!countGet && (req.method === 'GET' || req.method === 'HEAD')) return next();
    const ip = (process.env.TRUST_CF === '1' && req.headers['cf-connecting-ip']) || req.socket.remoteAddress;
    const k = name + ':' + ip;
    const now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(k, h); }
    h.n++;
    if (h.n > max) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi nanti' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (h.reset < now) hits.delete(k); }, 60000).unref();
app.use('/api/login', limiter('login', 10, 15 * 60000));
app.use('/api/register', limiter('register', 5, 60 * 60000));
app.use('/api/password', limiter('password', 10, 60 * 60000));
app.use('/api/reset', limiter('reset', 10, 60 * 60000));
app.use('/api/withdraw', limiter('withdraw', 10, 60 * 60000));
app.use('/api/creator', limiter('support', 30, 10 * 60000));
app.use('/api/admin', limiter('admin', 30, 15 * 60000, true));

app.use('/api/creator/:username/support', (req, res, next) => {
  const u = data.users.find(x => x.username === String(req.params.username).toLowerCase());
  if (req.method !== 'POST' || !u || !u.mod) return next();
  const nm = String(req.body.name || '').toLowerCase().trim();
  if (nm && (u.mod.names || []).some(x => nm.includes(x))) return res.status(400).json({ error: 'Nama ini tidak diperbolehkan' });
  const clean = s => (u.mod.words || []).reduce((t, w) => t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => '*'.repeat(m.length)), String(s || ''));
  req.body.name = clean(req.body.name);
  req.body.message = clean(req.body.message);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const RESERVED = ['api', 'dashboard', 'login', 'admin', 'static', 'index', 'creator', 'overlay', 'reset', 'avatar', 'uploads', 'explore', 'faq', 'status', 'changelog', 'banner'];
const rid = () => crypto.randomBytes(8).toString('hex');

function hash(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verify(pw, stored) {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newSession(userId) {
  const t = crypto.randomBytes(24).toString('hex');
  data.sessions[t] = userId;
  data.sessionExp = data.sessionExp || {};
  data.sessionExp[t] = Date.now() + 30 * 86400000;
  save();
  return t;
}
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (data.sessionExp && data.sessionExp[t] && data.sessionExp[t] < Date.now()) { delete data.sessions[t]; delete data.sessionExp[t]; }
  const user = data.users.find(u => u.id === data.sessions[t]);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  req.user = user;
  req.token = t;
  next();
}
const pub = u => ({ username: u.username, displayName: u.displayName, bio: u.bio || '', category: u.category || '', quick: u.quick || [5000, 10000, 25000, 50000], avatar: u.avatarV ? '/avatar/' + u.username + '?v=' + u.avatarV : '', banner: u.bannerV ? '/banner/' + u.username + '?v=' + u.bannerV : '', nsfw: !!u.nsfw, links: u.links || [] });

app.get('/api/ping', (req, res) => res.json({ ok: true, app: 'Dukung.in' }));

app.post('/api/register', (req, res) => {
  const username = String(req.body.username || '').toLowerCase();
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || '').trim().slice(0, 40);
  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: 'Username 3-20 karakter: huruf kecil, angka, _' });
  if (RESERVED.includes(username) || data.users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username tidak tersedia' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  const user = { id: rid(), username, displayName: displayName || username, bio: '', password: hash(password), createdAt: Date.now() };
  data.users.push(user);
  res.json({ token: newSession(user.id) });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').toLowerCase();
  const user = data.users.find(u => u.username === username);
  if (!user || !verify(String(req.body.password || ''), user.password))
    return res.status(400).json({ error: 'Username atau password salah' });
  res.json({ token: newSession(user.id) });
});

app.post('/api/logout', auth, (req, res) => {
  delete data.sessions[req.token];
  save();
  res.json({ ok: true });
});

app.put('/api/me', auth, (req, res) => {
  req.user.displayName = String(req.body.displayName || '').trim().slice(0, 40) || req.user.username;
  req.user.bio = String(req.body.bio || '').trim().slice(0, 200);
  req.user.nsfw = !!req.body.nsfw;
  if (typeof req.body.tz === 'string') { try { new Intl.DateTimeFormat('id-ID', { timeZone: req.body.tz }); req.user.tz = req.body.tz; } catch (e) {} }
  if (Array.isArray(req.body.links)) req.user.links = req.body.links.map(x => String(x).trim().slice(0, 200)).filter(x => /^https?:\/\/[^\s]+$/i.test(x)).slice(0, 5);
  if (CATS.includes(req.body.category)) req.user.category = req.body.category;
  if (Array.isArray(req.body.quick)) {
    const q = [...new Set(req.body.quick.map(n => parseInt(n, 10)).filter(n => n >= 1000 && n <= 10000000))].sort((a, b) => a - b).slice(0, 8);
    if (q.length >= 1) req.user.quick = q;
  }
  save();
  res.json(pub(req.user));
});

app.get('/api/dashboard', auth, (req, res) => {
  const list = data.donations
    .filter(d => d.creatorId === req.user.id && d.status === 'paid')
    .sort((a, b) => b.paidAt - a.paidAt);
  res.json({
    user: pub(req.user),
    overlayKey: getKey(req.user),
    total: list.reduce((s, d) => s + d.amount, 0),
    ...walletInfo(req.user),
    donations: list.slice(0, 50)
  });
});

app.get('/api/creator/:username', (req, res) => {
  const u = data.users.find(x => x.username === req.params.username.toLowerCase());
  if (!u) return res.status(404).json({ error: 'Kreator tidak ditemukan' });
  res.json(pub(u));
});

const TP_KEY = process.env.TRIPAY_API_KEY;
const TP_MC = process.env.TRIPAY_MERCHANT_CODE;
const TP_PK = process.env.TRIPAY_PRIVATE_KEY;
const TP_BASE = process.env.TRIPAY_MODE === 'production' ? 'https://tripay.co.id/api' : 'https://tripay.co.id/api-sandbox';
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

app.post('/api/creator/:username/support', async (req, res, next) => {
  if (!TP_PK) return next();
  const u = data.users.find(x => x.username === req.params.username.toLowerCase());
  if (!u) return res.status(404).json({ error: 'Kreator tidak ditemukan' });
  const amount = parseInt(req.body.amount, 10);
  if (!(amount >= 1000 && amount <= 10000000))
    return res.status(400).json({ error: 'Nominal Rp1.000 - Rp10.000.000' });
  const d = {
    id: rid(),
    creatorId: u.id,
    name: String(req.body.name || 'Anonim').trim().slice(0, 40) || 'Anonim',
    message: String(req.body.message || '').trim().slice(0, 200),
    amount,
    status: 'pending',
    createdAt: Date.now()
  };
  data.donations.push(d);
  save();
  try {
    const signature = crypto.createHmac('sha256', TP_PK).update(TP_MC + d.id + amount).digest('hex');
    const r = await fetch(TP_BASE + '/transaction/create', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TP_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: process.env.TRIPAY_METHOD || 'QRIS',
        merchant_ref: d.id,
        amount,
        customer_name: d.name,
        customer_email: 'donatur@dukung.in',
        customer_phone: '081234567890',
        order_items: [{ name: 'Dukungan untuk ' + u.displayName, price: amount, quantity: 1 }],
        return_url: BASE_URL + '/' + u.username + '?thanks=1',
        expired_time: Math.floor(Date.now() / 1000) + 3600,
        signature
      })
    });
    const j = await r.json();
    if (!j.success) {
      d.status = 'failed';
      save();
      console.log('Tripay error:', j.message);
      return res.status(502).json({ error: 'Gagal membuat pembayaran: ' + (j.message || '') });
    }
    d.tripayRef = j.data.reference;
    save();
    res.json({ id: d.id, checkoutUrl: j.data.checkout_url });
  } catch (e) {
    console.log('Tripay fetch error:', e.message);
    res.status(502).json({ error: 'Gagal terhubung ke Tripay' });
  }
});

app.post('/api/tripay/callback', (req, res) => {
  if (!TP_PK || !req.rawBody) return res.status(400).json({ success: false });
  const sig = crypto.createHmac('sha256', TP_PK).update(req.rawBody).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(String(req.headers['x-callback-signature'] || ''));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return res.status(403).json({ success: false });
  if (req.headers['x-callback-event'] !== 'payment_status') return res.json({ success: true });
  const d = data.donations.find(x => x.id === req.body.merchant_ref);
  if (!d) return res.json({ success: false });
  const st = String(req.body.status || '').toUpperCase();
  if (st === 'PAID' && d.status !== 'paid') { d.status = 'paid'; d.paidAt = Date.now(); d.fee = feeOf(d); save(); }
  else if ((st === 'EXPIRED' || st === 'FAILED') && d.status === 'pending') { d.status = st.toLowerCase(); save(); }
  console.log('Callback', d.id, st);
  res.json({ success: true });
});

app.post('/api/creator/:username/support', (req, res) => {
  const u = data.users.find(x => x.username === req.params.username.toLowerCase());
  if (!u) return res.status(404).json({ error: 'Kreator tidak ditemukan' });
  const amount = parseInt(req.body.amount, 10);
  if (!(amount >= 1000 && amount <= 10000000))
    return res.status(400).json({ error: 'Nominal Rp1.000 - Rp10.000.000' });
  const d = {
    id: rid(),
    creatorId: u.id,
    name: String(req.body.name || 'Anonim').trim().slice(0, 40) || 'Anonim',
    message: String(req.body.message || '').trim().slice(0, 200),
    amount,
    status: 'pending',
    createdAt: Date.now()
  };
  data.donations.push(d);
  save();
  res.json({ id: d.id });
});

// SIMULASI pembayaran. Ganti dengan webhook gateway nanti.
app.post('/api/donations/:id/pay', (req, res) => {
  if (process.env.SIMULATE !== '1' || process.env.TRIPAY_PRIVATE_KEY) return res.status(403).json({ error: 'Nonaktif' });
  const d = data.donations.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (d.status !== 'paid') { d.status = 'paid'; d.paidAt = Date.now(); d.fee = feeOf(d); save(); }
  res.json({ ok: true });
});

function getKey(u) {
  if (!u.overlayKey) { u.overlayKey = crypto.randomBytes(12).toString('hex'); save(); }
  return u.overlayKey;
}

app.get('/api/overlay/:key/poll', (req, res) => {
  const u = data.users.find(x => x.overlayKey && x.overlayKey === req.params.key);
  if (!u) return res.status(404).json({ error: 'Key salah' });
  if (req.query.since === undefined) return res.json({ now: Date.now(), donations: [] });
  const since = parseInt(req.query.since, 10) || 0;
  const list = data.donations
    .filter(d => d.creatorId === u.id && d.status === 'paid' && d.paidAt > since)
    .sort((a, b) => a.paidAt - b.paidAt)
    .slice(0, 20)
    .map(d => ({ id: d.id, name: d.name, amount: d.amount, message: d.message, paidAt: d.paidAt }));
  res.json({ now: Date.now(), donations: list });
});

app.get('/overlay/:key', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));

const FEE_PCT = parseFloat(process.env.FEE_PCT || '10');
const MIN_WD = parseInt(process.env.MIN_WITHDRAW || '50000', 10);
const ADMIN_KEY = process.env.ADMIN_KEY || '';
data.withdrawals = data.withdrawals || [];
const feeOf = d => Math.round(d.amount * FEE_PCT / 100);

function walletInfo(u) {
  const paid = data.donations.filter(d => d.creatorId === u.id && d.status === 'paid');
  const gross = paid.reduce((s, d) => s + d.amount, 0);
  const fee = paid.reduce((s, d) => s + (d.fee != null ? d.fee : feeOf(d)), 0);
  const ws = data.withdrawals.filter(w => w.userId === u.id);
  const reserved = ws.filter(w => w.status !== 'rejected').reduce((s, w) => s + w.amount, 0);
  return {
    gross, feePct: FEE_PCT, earned: gross - fee, balance: gross - fee - reserved,
    minWd: MIN_WD, payout: u.payout || {}, tz: u.tz || 'Asia/Jakarta',
    withdrawals: ws.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)
  };
}

app.put('/api/payout', auth, (req, res) => {
  const bank = String(req.body.bank || '').trim();
  const account = String(req.body.account || '').trim();
  const holder = String(req.body.holder || '').trim();
  if (bank.length < 2 || bank.length > 30) return res.status(400).json({ error: 'Nama bank/e-wallet 2-30 karakter' });
  if (!/^[0-9A-Za-z\- ]{4,30}$/.test(account)) return res.status(400).json({ error: 'Nomor rekening tidak valid' });
  if (holder.length < 2 || holder.length > 60) return res.status(400).json({ error: 'Nama pemilik 2-60 karakter' });
  req.user.payout = { bank, account, holder };
  save();
  res.json({ ok: true });
});

app.post('/api/withdraw', auth, (req, res) => {
  const p = req.user.payout;
  if (!p || !p.account) return res.status(400).json({ error: 'Isi dan simpan rekening dulu' });
  const amount = parseInt(req.body.amount, 10);
  if (!(amount >= MIN_WD)) return res.status(400).json({ error: 'Minimal penarikan Rp' + MIN_WD.toLocaleString('id-ID') });
  if (amount > walletInfo(req.user).balance) return res.status(400).json({ error: 'Saldo tidak cukup' });
  data.withdrawals.push({ id: rid(), userId: req.user.id, amount, status: 'pending', createdAt: Date.now(), payout: { ...p } });
  save();
  res.json({ ok: true });
});

function adminAuth(req, res, next) {
  const a = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const b = Buffer.from(ADMIN_KEY);
  if (!ADMIN_KEY || a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return res.status(401).json({ error: 'Kunci admin salah' });
  next();
}

app.get('/api/admin/withdrawals', adminAuth, (req, res) => {
  const list = data.withdrawals.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 100)
    .map(w => ({ ...w, username: (data.users.find(u => u.id === w.userId) || {}).username }));
  res.json(list);
});

app.post('/api/admin/withdrawals/:id', adminAuth, (req, res) => {
  const w = data.withdrawals.find(x => x.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (w.status !== 'pending') return res.status(400).json({ error: 'Sudah diproses' });
  const act = req.body.action;
  if (act === 'paid') { w.status = 'paid'; }
  else if (act === 'reject') { w.status = 'rejected'; w.note = String(req.body.note || '').slice(0, 100); }
  else return res.status(400).json({ error: 'Aksi tidak valid' });
  w.doneAt = Date.now();
  save();
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

data.resets = data.resets || {};

app.post('/api/password', auth, (req, res) => {
  const oldPw = String(req.body.old || '');
  const np = String(req.body.new || '');
  if (!verify(oldPw, req.user.password)) return res.status(400).json({ error: 'Password lama salah' });
  if (np.length < 6) return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  req.user.password = hash(np);
  for (const t of Object.keys(data.sessions)) if (data.sessions[t] === req.user.id && t !== req.token) delete data.sessions[t];
  save();
  res.json({ ok: true });
});

app.post('/api/admin/reset', adminAuth, (req, res) => {
  const u = data.users.find(x => x.username === String(req.body.username || '').toLowerCase());
  if (!u) return res.status(404).json({ error: 'Username tidak ditemukan' });
  const t = crypto.randomBytes(24).toString('hex');
  data.resets[t] = { userId: u.id, exp: Date.now() + 3600000 };
  save();
  res.json({ url: BASE_URL + '/reset/' + t });
});

app.post('/api/reset', (req, res) => {
  const token = String(req.body.token || '');
  const r = data.resets[token];
  if (!r || r.exp < Date.now()) return res.status(400).json({ error: 'Link tidak valid atau kedaluwarsa' });
  const np = String(req.body.password || '');
  if (np.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });
  const u = data.users.find(x => x.id === r.userId);
  if (!u) return res.status(400).json({ error: 'Akun tidak ditemukan' });
  u.password = hash(np);
  for (const t of Object.keys(data.sessions)) if (data.sessions[t] === u.id) delete data.sessions[t];
  delete data.resets[token];
  save();
  res.json({ ok: true });
});

app.get('/reset/:token', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset.html')));

const fsx = require('fs');
const BK_DIR = path.join(__dirname, 'backups');
function backup() {
  try {
    const src = path.join(__dirname, 'data.json');
    if (!fsx.existsSync(src)) return;
    fsx.mkdirSync(BK_DIR, { recursive: true });
    fsx.copyFileSync(src, path.join(BK_DIR, 'data-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'));
    const all = fsx.readdirSync(BK_DIR).filter(x => x.startsWith('data-')).sort();
    all.slice(0, Math.max(0, all.length - 30)).forEach(x => fsx.unlinkSync(path.join(BK_DIR, x)));
  } catch (e) { console.log('Backup gagal:', e.message); }
}
backup();
setInterval(backup, 6 * 3600000).unref();

const DC_HOOK = process.env.DISCORD_WEBHOOK_URL;
const BK_PASS = process.env.BACKUP_PASS;
async function remoteBackup() {
  if (!DC_HOOK || !BK_PASS) return;
  try {
    const raw = fsx.readFileSync(path.join(__dirname, 'data.json'));
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', crypto.scryptSync(BK_PASS, salt, 32), iv);
    const enc = Buffer.concat([c.update(raw), c.final()]);
    const out = Buffer.concat([salt, iv, c.getAuthTag(), enc]);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify({ content: 'Backup Dukung.in ' + stamp }));
    fd.append('files[0]', new Blob([out]), 'dukung-' + stamp + '.enc');
    const r = await fetch(DC_HOOK, { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) });
    if (!r.ok) console.log('Backup Discord gagal: HTTP ' + r.status);
  } catch (e) { console.log('Backup Discord error:', e.message); }
}
setTimeout(remoteBackup, 30000).unref();
setInterval(remoteBackup, 6 * 3600000).unref();

setInterval(() => {
  const now = Date.now();
  const ex = data.sessionExp || {};
  for (const t of Object.keys(ex)) if (ex[t] < now) { delete data.sessions[t]; delete ex[t]; }
  for (const t of Object.keys(data.resets)) if (data.resets[t].exp < now) delete data.resets[t];
  save();
}, 3600000).unref();

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

const CATS = ['Streamer', 'Content Creator', 'Virtual YouTuber', 'Musisi', 'Seniman', 'Cosplayer', 'Komunitas', 'Lainnya'];
const UP = path.join(__dirname, 'uploads', 'avatars');

app.put('/api/avatar', auth, (req, res) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Format gambar tidak valid' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 90000 || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: 'Gambar terlalu besar atau bukan JPEG' });
  fsx.mkdirSync(UP, { recursive: true });
  fsx.writeFileSync(path.join(UP, req.user.id + '.jpg'), buf);
  req.user.avatarV = Date.now();
  save();
  res.json({ avatar: '/avatar/' + req.user.username + '?v=' + req.user.avatarV });
});

app.delete('/api/avatar', auth, (req, res) => {
  try { fsx.unlinkSync(path.join(UP, req.user.id + '.jpg')); } catch (e) {}
  delete req.user.avatarV;
  save();
  res.json({ ok: true });
});

app.get('/avatar/:username', (req, res) => {
  const u = data.users.find(x => x.username === req.params.username.toLowerCase());
  const f = u && path.join(UP, u.id + '.jpg');
  if (!f || !fsx.existsSync(f)) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('image/jpeg').sendFile(f);
});

app.get('/api/explore', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim().slice(0, 40);
  const cat = String(req.query.cat || '');
  const list = data.users
    .filter(u => (!cat || u.category === cat) && (!q || u.username.includes(q) || u.displayName.toLowerCase().includes(q)))
    .slice(-60).reverse()
    .map(u => { const p = pub(u); return { username: p.username, displayName: p.displayName, bio: p.bio, category: p.category, avatar: p.avatar }; });
  res.json(list);
});
app.get('/explore', (req, res) => res.sendFile(path.join(__dirname, 'public', 'explore.html')));
app.get('/faq', (req, res) => res.sendFile(path.join(__dirname, 'public', 'faq.html')));

let tpCache = { t: 0, ok: null };
async function tripayOk() {
  if (!TP_PK) return null;
  if (Date.now() - tpCache.t < 60000) return tpCache.ok;
  try {
    const r = await fetch(TP_BASE + '/merchant/payment-channel', { headers: { Authorization: 'Bearer ' + TP_KEY }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    tpCache = { t: Date.now(), ok: !!j.success };
  } catch (e) { tpCache = { t: Date.now(), ok: false }; }
  return tpCache.ok;
}

app.get('/api/status', async (req, res) => {
  let store = true;
  const df = path.join(__dirname, 'data.json');
  try { if (fsx.existsSync(df)) fsx.accessSync(df, fsx.constants.R_OK | fsx.constants.W_OK); } catch (e) { store = false; }
  const pay = await tripayOk();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    checkedAt: Date.now(),
    uptime: Math.floor(process.uptime()),
    components: [
      { name: 'Situs dan API', ok: true },
      { name: 'Penyimpanan data', ok: store },
      { name: 'Pembayaran QRIS', ok: pay }
    ]
  });
});
app.get('/status', (req, res) => res.sendFile(path.join(__dirname, 'public', 'status.html')));
app.get('/changelog', (req, res) => res.sendFile(path.join(__dirname, 'public', 'changelog.html')));

const BUP = path.join(__dirname, 'uploads', 'banners');

app.put('/api/banner', auth, (req, res) => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image || ''));
  if (!m) return res.status(400).json({ error: 'Format gambar tidak valid' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 90000 || buf[0] !== 0xff || buf[1] !== 0xd8) return res.status(400).json({ error: 'Gambar terlalu besar atau bukan JPEG' });
  fsx.mkdirSync(BUP, { recursive: true });
  fsx.writeFileSync(path.join(BUP, req.user.id + '.jpg'), buf);
  req.user.bannerV = Date.now();
  save();
  res.json({ banner: '/banner/' + req.user.username + '?v=' + req.user.bannerV });
});

app.delete('/api/banner', auth, (req, res) => {
  try { fsx.unlinkSync(path.join(BUP, req.user.id + '.jpg')); } catch (e) {}
  delete req.user.bannerV;
  save();
  res.json({ ok: true });
});

app.get('/banner/:username', (req, res) => {
  const u = data.users.find(x => x.username === req.params.username.toLowerCase());
  const f = u && path.join(BUP, u.id + '.jpg');
  if (!f || !fsx.existsSync(f)) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('image/jpeg').sendFile(f);
});

app.delete('/api/me', auth, (req, res) => {
  if (!verify(String(req.body.password || ''), req.user.password)) return res.status(400).json({ error: 'Password salah' });
  if (walletInfo(req.user).balance > 0 || data.withdrawals.some(x => x.userId === req.user.id && x.status === 'pending'))
    return res.status(400).json({ error: 'Tarik seluruh saldo dan tunggu penarikan selesai dulu' });
  const id = req.user.id;
  for (const t of Object.keys(data.sessions)) if (data.sessions[t] === id) delete data.sessions[t];
  data.users = data.users.filter(u => u.id !== id);
  try { fsx.unlinkSync(path.join(UP, id + '.jpg')); } catch (e) {}
  try { fsx.unlinkSync(path.join(BUP, id + '.jpg')); } catch (e) {}
  save();
  res.json({ ok: true });
});

require('./features')(app, { data, save, auth, getKey });

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/:username', (req, res, next) => {
  const n = req.params.username.toLowerCase();
  if (RESERVED.includes(n) || !data.users.find(x => x.username === n)) return next();
  res.sendFile(path.join(__dirname, 'public', 'creator.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dukung.in jalan di port ' + PORT));
