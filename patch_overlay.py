import sys

def patch(path, anchor, new, before=False):
    s = open(path, encoding='utf-8').read()
    n = s.count(anchor)
    if n != 1:
        print('GAGAL', path, 'anchor ditemukan', n, 'kali:', anchor)
        sys.exit(1)
    rep = new + anchor if before else new
    open(path, 'w', encoding='utf-8').write(s.replace(anchor, rep))
    print('OK', path)

patch('server.js', "'creator'];", "'creator', 'overlay'];")

patch('server.js', "user: pub(req.user),", "user: pub(req.user),\n    overlayKey: getKey(req.user),")

block = r"""function getKey(u) {
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

"""
patch('server.js', "app.get('/dashboard', (req, res) =>", block, before=True)

card = """<h2>Overlay OBS</h2>
    <div class="mut">Tempel di OBS sebagai Browser Source. Jangan dibagikan.</div>
    <a id="ov" style="color:var(--ac);word-break:break-all" target="_blank"></a>
    <button class="ghost" id="cp">Salin link</button>
  </div>
  <div class="card">
    <h2>Profil</h2>"""
patch('public/dashboard.html', "<h2>Profil</h2>", card)

js = """$('#link').href = '/' + j.user.username;
  const ovUrl = location.origin + '/overlay/' + j.overlayKey;
  $('#ov').textContent = ovUrl;
  $('#ov').href = ovUrl;
  $('#cp').onclick = () => { navigator.clipboard.writeText(ovUrl); $('#cp').textContent = 'Tersalin'; };"""
patch('public/dashboard.html', "$('#link').href = '/' + j.user.username;", js)
