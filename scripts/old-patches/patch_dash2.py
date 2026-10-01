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

if "app.delete('/api/me'" in load('server.js'):
    print('SUDAH TERPASANG, tidak dijalankan lagi')
    sys.exit(0)

S = 'server.js'
rep(S, "'status', 'changelog'];", "'status', 'changelog', 'banner'];")
rep(S, "avatar: u.avatarV ? '/avatar/' + u.username + '?v=' + u.avatarV : '' });",
    "avatar: u.avatarV ? '/avatar/' + u.username + '?v=' + u.avatarV : '', banner: u.bannerV ? '/banner/' + u.username + '?v=' + u.bannerV : '', nsfw: !!u.nsfw, links: u.links || [] });")
rep(S, "minWd: MIN_WD, payout: u.payout || {},", "minWd: MIN_WD, payout: u.payout || {}, tz: u.tz || 'Asia/Jakarta',")
rep(S, "req.user.bio = String(req.body.bio || '').trim().slice(0, 200);",
    """req.user.bio = String(req.body.bio || '').trim().slice(0, 200);
  req.user.nsfw = !!req.body.nsfw;
  if (typeof req.body.tz === 'string') { try { new Intl.DateTimeFormat('id-ID', { timeZone: req.body.tz }); req.user.tz = req.body.tz; } catch (e) {} }
  if (Array.isArray(req.body.links)) req.user.links = req.body.links.map(x => String(x).trim().slice(0, 200)).filter(x => /^https?:\\/\\/[^\\s]+$/i.test(x)).slice(0, 5);""")

late = r"""const BUP = path.join(__dirname, 'uploads', 'banners');

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

"""
rep(S, "app.get('/dashboard', (req, res) =>", late, before=True)

C = 'public/creator.html'
rep(C, '<div class="top"><div class="in">', """<div id="gate" style="display:none;position:fixed;inset:0;background:#0b1620;z-index:50;align-items:center;justify-content:center;flex-direction:column;padding:24px;text-align:center">
  <h2>Konten dewasa 18+</h2>
  <p class="mut" style="max-width:26em">Halaman ini ditandai berisi konten untuk usia 18 tahun ke atas.</p>
  <div style="display:flex;gap:10px"><button class="cta" id="g18" style="width:auto;padding:12px 24px">Saya 18+, lanjutkan</button><button class="ghost" style="width:auto;padding:12px 24px" onclick="location.href='/'">Kembali</button></div>
</div>
<div class="top"><div class="in">""", before=False)
rep(C, '<p class="lead" id="bio"></p>', '<p class="lead" id="bio"></p>\n  <div class="sls" id="sls"></div>')
rep(C, 'chips(j.quick);', r"""if (j.banner) { const tp = document.querySelector('.top'); tp.classList.add('hasb'); tp.style.backgroundImage = 'linear-gradient(rgba(6,33,58,.6),rgba(6,33,58,.6)),url(' + j.banner + ')'; }
  (j.links || []).forEach(u => {
    const a = document.createElement('a');
    a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.className = 'sl';
    try { a.textContent = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { a.textContent = u; }
    $('#sls').append(a);
  });
  if (j.nsfw && !sessionStorage['ok18:' + username]) $('#gate').style.display = 'flex';
  chips(j.quick);""")
rep(C, "$('#a').oninput = sync;", "$('#g18').onclick = () => { sessionStorage['ok18:' + username] = 1; $('#gate').style.display = 'none'; };\n$('#a').oninput = sync;")

CL = 'public/changelog.html'
if 'banner' not in load(CL):
    rep(CL, '<li>Halaman Temukan kreator dan FAQ</li>', '<li>Halaman Temukan kreator dan FAQ</li>\n        <li>Foto banner, tautan sosial media, dan peringatan 18+ di halaman kreator</li>')
