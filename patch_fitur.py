import sys

def load(p):
    return open(p, encoding='utf-8').read()

def save(p, s):
    open(p, 'w', encoding='utf-8').write(s)

def rep(p, anchor, new, before=False):
    s = load(p)
    n = s.count(anchor)
    if n != 1:
        print('GAGAL', p, 'anchor ditemukan', n, 'kali:', anchor)
        sys.exit(1)
    save(p, s.replace(anchor, (new + anchor) if before else new))
    print('OK', p)

if 'const CATS' in load('server.js'):
    print('SUDAH TERPASANG, tidak dijalankan lagi')
    sys.exit(0)

S = 'server.js'
rep(S, "'overlay', 'reset'];", "'overlay', 'reset', 'avatar', 'uploads'];")
rep(S, "bio: u.bio || '' });",
    "bio: u.bio || '', category: u.category || '', quick: u.quick || [5000, 10000, 25000, 50000], avatar: u.avatarV ? '/avatar/' + u.username + '?v=' + u.avatarV : '' });")
rep(S, "req.user.bio = String(req.body.bio || '').trim().slice(0, 200);",
    """req.user.bio = String(req.body.bio || '').trim().slice(0, 200);
  if (CATS.includes(req.body.category)) req.user.category = req.body.category;
  if (Array.isArray(req.body.quick)) {
    const q = [...new Set(req.body.quick.map(n => parseInt(n, 10)).filter(n => n >= 1000 && n <= 10000000))].sort((a, b) => a - b).slice(0, 8);
    if (q.length >= 1) req.user.quick = q;
  }""")

late = r"""const CATS = ['Streamer', 'Content Creator', 'Virtual YouTuber', 'Musisi', 'Seniman', 'Cosplayer', 'Komunitas', 'Lainnya'];
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

"""
rep(S, "app.get('/dashboard', (req, res) =>", late, before=True)

D = 'public/dashboard.html'
rep(D, '<label class="f" for="dn">Nama tampilan</label>', """<div style="display:flex;align-items:center;gap:14px;margin-bottom:4px">
          <div class="avbox" id="avbox">?</div>
          <div><button class="cta sm" id="avb" type="button">Unggah foto</button> <button class="ghost sm" id="avd" type="button">Hapus</button></div>
          <input type="file" id="avf" accept="image/*" hidden>
        </div>
        <label class="f" for="dn">Nama tampilan</label>""")
rep(D, '<label class="f" for="bio">Bio</label>', """<label class="f" for="cat">Kategori</label>
        <select id="cat"><option value="">Pilih kategori</option><option>Streamer</option><option>Content Creator</option><option>Virtual YouTuber</option><option>Musisi</option><option>Seniman</option><option>Cosplayer</option><option>Komunitas</option><option>Lainnya</option></select>
        <label class="f" for="bio">Bio</label>""")
rep(D, '<div class="ok" id="msg"></div>', """<label class="f">Tombol nominal cepat</label>
        <p class="mut" style="margin:0">Tampil di halaman dukunganmu. Maksimal 8, minimal Rp1.000.</p>
        <div id="qk"></div>
        <button class="ghost sm" id="qadd" type="button" style="margin-top:8px">Tambah nominal</button>
        <div class="ok" id="msg"></div>""")
rep(D, "$('#total').textContent = rp(j.balance);", "$('#total').textContent = rp(j.balance);\n  setAv(j.user.avatar, j.user.displayName);")
rep(D, "$('#bio').value = j.user.bio;", "$('#bio').value = j.user.bio;\n    $('#cat').value = j.user.category || '';\n    window._q = (j.user.quick || []).slice();\n    renderQ();")
rep(D, "body: JSON.stringify({ displayName: $('#dn').value, bio: $('#bio').value })",
    "body: JSON.stringify({ displayName: $('#dn').value, bio: $('#bio').value, category: $('#cat').value, quick: collectQ() })")

js = r"""window._q = window._q || [];
function setAv(url, name) {
  const ini = (name.trim()[0] || '?').toUpperCase();
  ['#avbox', '#ua'].forEach(s => { const b = $(s); b.style.backgroundImage = url ? 'url(' + url + ')' : ''; b.textContent = url ? '' : ini; });
}
function renderQ() {
  const box = $('#qk');
  box.innerHTML = '';
  window._q.forEach((v, i) => {
    const r = el('div', 'qr');
    const inp = document.createElement('input');
    inp.inputMode = 'numeric';
    inp.value = v ? Number(v).toLocaleString('id-ID') : '';
    inp.oninput = () => { const d = digits(inp.value); inp.value = d ? Number(d).toLocaleString('id-ID') : ''; window._q[i] = d ? parseInt(d, 10) : 0; };
    const del = el('button', 'danger sm', 'Hapus');
    del.type = 'button';
    del.onclick = () => { window._q.splice(i, 1); renderQ(); };
    r.append(inp, del);
    box.append(r);
  });
  $('#qadd').style.display = window._q.length >= 8 ? 'none' : '';
}
function collectQ() { return window._q.filter(n => n >= 1000); }
$('#qadd').onclick = () => { window._q.push(0); renderQ(); };
$('#avb').onclick = () => $('#avf').click();
$('#avf').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const bmp = await createImageBitmap(f);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const s = Math.min(bmp.width, bmp.height);
    c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
    let q = 0.85, d = c.toDataURL('image/jpeg', q);
    while (d.length > 80000 && q > 0.3) { q -= 0.15; d = c.toDataURL('image/jpeg', q); }
    const r = await fetch('/api/avatar', { method: 'PUT', headers: H, body: JSON.stringify({ image: d }) });
    const j = await r.json();
    if (!r.ok) { msg('#msg', false, j.error); return; }
    setAv(j.avatar, $('#dn').value);
    msg('#msg', true, 'Foto diperbarui');
  } catch (err) { msg('#msg', false, 'Gagal memproses gambar'); }
  e.target.value = '';
};
$('#avd').onclick = async () => { await fetch('/api/avatar', { method: 'DELETE', headers: H }); setAv('', $('#dn').value); };
"""
rep(D, "setInterval(load, 15000);", js, before=True)

for p in ['public/login.html', 'public/reset.html']:
    if 'dash.css' not in load(p):
        rep(p, '<link rel="stylesheet" href="/style.css">', '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/dash.css">')
        rep(p, '<body>', '<body class="dk">')

I = 'public/index.html'
if 'dash.css' not in load(I):
    rep(I, '<link rel="stylesheet" href="/style.css">', '<link rel="stylesheet" href="/style.css">\n<link rel="stylesheet" href="/dash.css">')
    rep(I, '<body>', '<body class="dk">')
    rep(I, '</style>', """.dk .logo{color:#e6f1fb}
.dk .btn{background:#37a2ea;color:#06213a}
.dk .btn.o{background:transparent;border:1.5px solid #37a2ea;color:#e6f1fb}
.dk .hero{background:#0b1620}
.dk .hero p{color:#8aa4bb}
.dk .mock{background:#12222f}
.dk .mock .al{background:#37a2ea;color:#06213a}
.dk .mock .al span{color:#06213a}
.dk .mock .al small{color:#0d3a5e}
.dk .ft{background:#12222f;border-color:#1c3244}
.dk .ft i{background:#1d3347}
.dk .stp b{color:#06213a}
.dk .end{background:#12222f}
""", before=True)
