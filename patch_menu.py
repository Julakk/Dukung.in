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

if "/api/explore" in load('server.js'):
    print('SUDAH TERPASANG, tidak dijalankan lagi')
    sys.exit(0)

S = 'server.js'
rep(S, "'avatar', 'uploads'];", "'avatar', 'uploads', 'explore', 'faq'];")
routes = r"""app.get('/api/explore', (req, res) => {
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

"""
rep(S, "app.get('/dashboard', (req, res) =>", routes, before=True)

D = 'public/dashboard.html'
rep(D, '<a class="usr" id="usr" href="#" target="_blank"><span class="ua" id="ua">?</span><span id="hi"></span></a>',
"""<div class="dd">
    <button class="usr" id="usr" type="button" aria-haspopup="true" aria-expanded="false"><span class="ua" id="ua">?</span><span id="hi"></span></button>
    <nav class="menu" id="menu" hidden>
      <a href="/dashboard">Dashboard</a>
      <a href="#" id="mypage" target="_blank">Halaman saya</a>
      <a href="/explore">Temukan kreator</a>
      <a href="/faq">FAQ</a>
      <button type="button" id="mout" class="mo">Keluar</button>
    </nav>
  </div>""")
rep(D, "$('#usr').href = window._url;", "$('#mypage').href = window._url;")
js = r"""function closeMenu() { $('#menu').hidden = true; $('#usr').setAttribute('aria-expanded', 'false'); }
$('#usr').onclick = e => { e.stopPropagation(); const m = $('#menu'); m.hidden = !m.hidden; $('#usr').setAttribute('aria-expanded', String(!m.hidden)); };
document.addEventListener('click', closeMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$('#mout').onclick = () => $('#out').click();
"""
rep(D, "setInterval(load, 15000);", js, before=True)
