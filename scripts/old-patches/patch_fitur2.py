import sys

def load(p):
    return open(p, encoding='utf-8').read()

def rep(p, anchor, new, before=False):
    s = load(p)
    n = s.count(anchor)
    if n != 1:
        print('GAGAL', p, 'anchor ditemukan', n, 'kali:', anchor)
        sys.exit(1)
    open(p, 'w', encoding='utf-8').write(s.replace(anchor, (new + anchor) if before else new))
    print('OK', p)

if "require('./features')" in load('server.js'):
    print('SUDAH TERPASANG, tidak dijalankan lagi')
    sys.exit(0)

mw = r"""app.use('/api/creator/:username/support', (req, res, next) => {
  const u = data.users.find(x => x.username === String(req.params.username).toLowerCase());
  if (req.method !== 'POST' || !u || !u.mod) return next();
  const nm = String(req.body.name || '').toLowerCase().trim();
  if (nm && (u.mod.names || []).some(x => nm.includes(x))) return res.status(400).json({ error: 'Nama ini tidak diperbolehkan' });
  const clean = s => (u.mod.words || []).reduce((t, w) => t.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => '*'.repeat(m.length)), String(s || ''));
  req.body.name = clean(req.body.name);
  req.body.message = clean(req.body.message);
  next();
});

"""
rep('server.js', "app.use(express.static(path.join(__dirname, 'public')));", mw, before=True)
rep('server.js', "app.get('/dashboard', (req, res) =>", "require('./features')(app, { data, save, auth, getKey });\n\n", before=True)
if 'dash2.js' not in load('public/dashboard.html'):
    rep('public/dashboard.html', '</body>', '<script src="/dash2.js?v=1"></script>\n', before=True)
