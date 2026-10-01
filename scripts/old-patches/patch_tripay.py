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

loader = r"""try {
  require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) {}
"""
patch('server.js', "const express = require('express');", loader, before=True)

patch('server.js', "app.use(express.json());",
      "app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));")

route = r"""const TP_KEY = process.env.TRIPAY_API_KEY;
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

"""
patch('server.js', "app.post('/api/creator/:username/support'", route, before=True)

patch('server.js', "if (process.env.SIMULATE === '0')",
      "if (process.env.SIMULATE === '0' || process.env.TRIPAY_PRIVATE_KEY)")

patch('public/creator.html', "await fetch('/api/donations/' + j.id + '/pay', { method: 'POST' });",
      "if (j.checkoutUrl) { location.href = j.checkoutUrl; return; }\n  ", before=True)

patch('public/creator.html', "$('#go').onclick = async () => {",
      "if (new URLSearchParams(location.search).has('thanks')) { $('#box').style.display = 'none'; $('#done').style.display = 'block'; }\n", before=True)
