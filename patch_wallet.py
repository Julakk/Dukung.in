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

block = r"""const FEE_PCT = parseFloat(process.env.FEE_PCT || '10');
const MIN_WD = parseInt(process.env.MIN_WITHDRAW || '50000', 10);
const ADMIN_KEY = process.env.ADMIN_KEY || '';
data.withdrawals = data.withdrawals || [];
const feeOf = d => Math.round(d.amount * FEE_PCT / 100);

function walletInfo(u) {
  const paid = data.donations.filter(d => d.creatorId === u.id && d.status === 'paid');
  const gross = paid.reduce((s, d) => s + d.amount, 0);
  const fee = paid.reduce((s, d) => s + feeOf(d), 0);
  const ws = data.withdrawals.filter(w => w.userId === u.id);
  const reserved = ws.filter(w => w.status !== 'rejected').reduce((s, w) => s + w.amount, 0);
  return {
    gross, feePct: FEE_PCT, earned: gross - fee, balance: gross - fee - reserved,
    minWd: MIN_WD, payout: u.payout || {},
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

"""
patch('server.js', "app.get('/dashboard', (req, res) =>", block, before=True)

patch('server.js', "total: list.reduce((s, d) => s + d.amount, 0),",
      "total: list.reduce((s, d) => s + d.amount, 0),\n    ...walletInfo(req.user),")

card = """<h2>Penarikan dana</h2>
    <div class="mut" id="wnote"></div>
    <input id="wbank" placeholder="Bank / e-wallet (mis. BCA, DANA)">
    <input id="wacc" placeholder="Nomor rekening / HP">
    <input id="whold" placeholder="Nama pemilik rekening">
    <button class="ghost" id="wsave">Simpan rekening</button>
    <input id="wamt" type="number" inputmode="numeric" placeholder="Jumlah penarikan" style="margin-top:14px">
    <div id="werr" class="err"></div>
    <button id="wgo">Tarik dana</button>
    <div id="wlist" style="margin-top:12px"></div>
  </div>
  <div class="card">
    <h2>Profil</h2>"""
patch('public/dashboard.html', "<h2>Profil</h2>", card)

patch('public/dashboard.html', "<div class=\"mut\">Total diterima</div>", "<div class=\"mut\">Saldo tersedia</div>")

js = r"""$('#total').textContent = rp(j.balance);
  $('#wnote').textContent = 'Total dukungan ' + rp(j.gross) + ', potongan platform ' + j.feePct + '%, bersih ' + rp(j.earned) + '. Minimal tarik ' + rp(j.minWd) + '.';
  if (!window._f) {
    $('#wbank').value = j.payout.bank || '';
    $('#wacc').value = j.payout.account || '';
    $('#whold').value = j.payout.holder || '';
  }
  const lbl = { pending: 'Menunggu', paid: 'Sudah ditransfer', rejected: 'Ditolak' };
  const wl = $('#wlist');
  wl.innerHTML = '';
  j.withdrawals.forEach(w => {
    const el = document.createElement('div');
    el.className = 'item';
    const b = document.createElement('b');
    b.textContent = rp(w.amount) + ' • ' + (lbl[w.status] || w.status);
    const p = document.createElement('p');
    p.textContent = new Date(w.createdAt).toLocaleString('id-ID') + (w.note ? ' • ' + w.note : '');
    el.append(b, p);
    wl.append(el);
  });
  window._f = 1;"""
patch('public/dashboard.html', "$('#total').textContent = rp(j.total);", js)

patch('public/dashboard.html', "$('#dn').value = j.user.displayName;", "if (!window._f) $('#dn').value = j.user.displayName;")
patch('public/dashboard.html', "$('#bio').value = j.user.bio;", "if (!window._f) $('#bio').value = j.user.bio;")

handlers = r"""$('#wsave').onclick = async () => {
  const r = await fetch('/api/payout', { method: 'PUT', headers: H, body: JSON.stringify({ bank: $('#wbank').value, account: $('#wacc').value, holder: $('#whold').value }) });
  const j = await r.json();
  $('#werr').className = r.ok ? 'ok' : 'err';
  $('#werr').textContent = r.ok ? 'Rekening tersimpan' : j.error;
};
$('#wgo').onclick = async () => {
  const r = await fetch('/api/withdraw', { method: 'POST', headers: H, body: JSON.stringify({ amount: $('#wamt').value }) });
  const j = await r.json();
  $('#werr').className = r.ok ? 'ok' : 'err';
  $('#werr').textContent = r.ok ? 'Permintaan terkirim' : j.error;
  if (r.ok) { $('#wamt').value = ''; load(); }
};
"""
patch('public/dashboard.html', "setInterval(load, 15000);", handlers, before=True)
