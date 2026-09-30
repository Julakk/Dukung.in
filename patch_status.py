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

if '/api/status' in load('server.js'):
    print('SUDAH TERPASANG, tidak dijalankan lagi')
    sys.exit(0)

S = 'server.js'
rep(S, "'explore', 'faq'];", "'explore', 'faq', 'status', 'changelog'];")
routes = r"""let tpCache = { t: 0, ok: null };
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

"""
rep(S, "app.get('/dashboard', (req, res) =>", routes, before=True)

D = 'public/dashboard.html'
if 'href="/status"' not in load(D):
    rep(D, '<a href="/faq">FAQ</a>', '<a href="/faq">FAQ</a>\n      <a href="/status">Status layanan</a>\n      <a href="/changelog">Changelog</a>')

I = 'public/index.html'
if 'href="/status"' not in load(I):
    rep(I, '<footer>© 2026 Dukung.in</footer>',
        '<footer>© 2026 Dukung.in<br><a href="/explore">Temukan kreator</a> &nbsp; <a href="/faq">FAQ</a> &nbsp; <a href="/status">Status layanan</a> &nbsp; <a href="/changelog">Changelog</a></footer>')
