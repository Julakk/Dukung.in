import sys

if 'function limiter' in open('server.js', encoding='utf-8').read():
    print('SUDAH TERPASANG, tidak dijalankan lagi')
    sys.exit(0)

def patch(path, anchor, new, before=False):
    s = open(path, encoding='utf-8').read()
    n = s.count(anchor)
    if n != 1:
        print('GAGAL', path, 'anchor ditemukan', n, 'kali:', anchor)
        sys.exit(1)
    rep = new + anchor if before else new
    open(path, 'w', encoding='utf-8').write(s.replace(anchor, rep))
    print('OK', path)

early = r"""app.disable('x-powered-by');
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
    const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
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

"""
patch('server.js', "app.use(express.static(path.join(__dirname, 'public')));", early, before=True)

patch('server.js', "'overlay'];", "'overlay', 'reset'];")

patch('server.js', "data.sessions[t] = userId;",
      "data.sessions[t] = userId;\n  data.sessionExp = data.sessionExp || {};\n  data.sessionExp[t] = Date.now() + 30 * 86400000;")

patch('server.js', "const user = data.users.find(u => u.id === data.sessions[t]);",
      "if (data.sessionExp && data.sessionExp[t] && data.sessionExp[t] < Date.now()) { delete data.sessions[t]; delete data.sessionExp[t]; }\n  const user = data.users.find(u => u.id === data.sessions[t]);")

late = r"""data.resets = data.resets || {};

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

setInterval(() => {
  const now = Date.now();
  const ex = data.sessionExp || {};
  for (const t of Object.keys(ex)) if (ex[t] < now) { delete data.sessions[t]; delete ex[t]; }
  for (const t of Object.keys(data.resets)) if (data.resets[t].exp < now) delete data.resets[t];
  save();
}, 3600000).unref();

"""
patch('server.js', "app.get('/dashboard', (req, res) =>", late, before=True)

card = """<h2>Ganti password</h2>
    <input id="pold" type="password" placeholder="Password lama" autocomplete="current-password">
    <input id="pnew" type="password" placeholder="Password baru (min. 6)" autocomplete="new-password">
    <div id="perr" class="err"></div>
    <button id="pgo">Ganti password</button>
  </div>
  <div class="card">
    <h2>Profil</h2>"""
patch('public/dashboard.html', "<h2>Profil</h2>", card)

handlers = r"""$('#pgo').onclick = async () => {
  const r = await fetch('/api/password', { method: 'POST', headers: H, body: JSON.stringify({ old: $('#pold').value, new: $('#pnew').value }) });
  const j = await r.json();
  $('#perr').className = r.ok ? 'ok' : 'err';
  $('#perr').textContent = r.ok ? 'Password diganti' : j.error;
  if (r.ok) { $('#pold').value = ''; $('#pnew').value = ''; }
};
"""
patch('public/dashboard.html', "setInterval(load, 15000);", handlers, before=True)

acard = """<div class="err" id="err"></div>
  <div class="card">
    <h2>Reset password kreator</h2>
    <input id="ru" placeholder="Username kreator">
    <button id="rgo">Buat link reset</button>
    <p class="mut" id="rout" style="word-break:break-all"></p>
  </div>"""
patch('public/admin.html', '<div class="err" id="err"></div>', acard)

ahandler = r"""$('#rgo').onclick = async () => {
  const r = await api('/api/admin/reset', 'POST', { username: $('#ru').value.trim() });
  if (!r) return;
  $('#rout').textContent = r.ok ? r.j.url + ' (berlaku 1 jam)' : r.j.error;
};
"""
patch('public/admin.html', "$('#rk').onclick", ahandler, before=True)
