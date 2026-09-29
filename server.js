const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { data, save } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RESERVED = ['api', 'dashboard', 'login', 'admin', 'static', 'index', 'creator'];
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
    total: list.reduce((s, d) => s + d.amount, 0),
    donations: list.slice(0, 50)
  });
});

app.get('/api/creator/:username', (req, res) => {
  const u = data.users.find(x => x.username === req.params.username.toLowerCase());
  if (!u) return res.status(404).json({ error: 'Kreator tidak ditemukan' });
  res.json(pub(u));
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
  if (process.env.SIMULATE === '0') return res.status(403).json({ error: 'Nonaktif' });
  const d = data.donations.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({ error: 'Tidak ditemukan' });
  if (d.status !== 'paid') { d.status = 'paid'; d.paidAt = Date.now(); save(); }
  res.json({ ok: true });
});

app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.get('/:username', (req, res, next) => {
  const n = req.params.username.toLowerCase();
  if (RESERVED.includes(n) || !data.users.find(x => x.username === n)) return next();
  res.sendFile(path.join(__dirname, 'public', 'creator.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Dukung.in jalan di port ' + PORT));
