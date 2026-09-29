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
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

const RESERVED = ['api', 'dashboard', 'login', 'admin', 'static', 'index', 'creator', 'overlay'];
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
  save();
  return t;
}
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const user = data.users.find(u => u.id === data.sessions[t]);
  if (!user) return res.status(401).json({ error: 'Belum login' });
  req.user = user;
  req.token = t;
  next();
}
const pub = u => ({ username: u.username, displayName: u.displayName, bio: u.bio || '' });

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
  if (st === 'PAID' && d.status !== 'paid') { d.status = 'paid'; d.paidAt = Date.now(); save(); }
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
  if (process.env.SIMULATE === '0' || process.env.TRIPAY_PRIVATE_KEY) return res.status(403).json({ error: 'Nonaktif' });
  const d = data.donations.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (d.status !== 'paid') { d.status = 'paid'; d.paidAt = Date.now(); save(); }
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

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/:username', (req, res, next) => {
  const n = req.params.username.toLowerCase();
  if (RESERVED.includes(n) || !data.users.find(x => x.username === n)) return next();
  res.sendFile(path.join(__dirname, 'public', 'creator.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dukung.in jalan di port ' + PORT));
