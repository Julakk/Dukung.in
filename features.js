module.exports = (app, { data, save, auth, getKey }) => {
  const path = require('path');
  const col = /^#[0-9a-f]{6}$/i;
  const A = { bg: '#37a2ea', border: '#ffffff', text: '#06213a', hi: '#ffffff', size: 18, pos: 'top', dur: 8, tpl: '{sender} memberi {amount}', cur: true, anim: 'slide', sound: true };
  const L = { title: 'Papan Peringkat', count: 5, range: 'week', showAmt: true };
  const G = { on: false, title: 'Target Kita', target: 1000000, since: 0 };
  const T = { on: false, text: '' };
  const num = (v, lo, hi, d) => { v = parseInt(v, 10); return v >= lo && v <= hi ? v : d; };
  const clr = (v, d) => col.test(String(v)) ? String(v) : d;
  const str = (v, n) => String(v || '').trim().slice(0, n);
  const pick = (v, opts, d) => opts.includes(v) ? v : d;
  const list = (a, n, m) => Array.isArray(a) ? [...new Set(a.map(x => str(x, n).toLowerCase()).filter(Boolean))].slice(0, m) : [];
  const byKey = k => data.users.find(x => x.overlayKey && x.overlayKey === k);
  const paid = u => data.donations.filter(d => d.creatorId === u.id && d.status === 'paid');
  const dayKey = (ts, tz) => new Date(ts).toLocaleDateString('en-CA', { timeZone: tz });
  const cfgs = u => ({
    alert: { ...A, ...u.alertCfg }, lb: { ...L, ...u.lbCfg }, goal: { ...G, ...u.goalCfg },
    ticker: { ...T, ...u.tickerCfg }, mod: { words: [], names: [], ...u.mod }
  });

  app.get('/api/settings', auth, (req, res) => res.json({ key: getKey(req.user), ...cfgs(req.user) }));

  app.put('/api/settings/:s', auth, (req, res) => {
    const b = req.body || {}, u = req.user;
    switch (req.params.s) {
      case 'alert':
        u.alertCfg = {
          bg: clr(b.bg, A.bg), border: clr(b.border, A.border), text: clr(b.text, A.text), hi: clr(b.hi, A.hi),
          size: num(b.size, 12, 40, A.size), pos: pick(b.pos, ['top', 'center', 'bottom'], A.pos),
          dur: num(b.dur, 3, 20, A.dur), tpl: str(b.tpl, 80) || A.tpl, cur: !!b.cur,
          anim: pick(b.anim, ['slide', 'fade', 'none'], A.anim), sound: !!b.sound
        };
        break;
      case 'lb':
        u.lbCfg = { title: str(b.title, 40) || L.title, count: num(b.count, 1, 10, L.count), range: pick(b.range, ['today', 'week', 'month', 'all'], L.range), showAmt: !!b.showAmt };
        break;
      case 'goal':
        u.goalCfg = { on: !!b.on, title: str(b.title, 40) || G.title, target: num(b.target, 1000, 1000000000, G.target), since: b.reset ? Date.now() : ((u.goalCfg && u.goalCfg.since) || 0) };
        break;
      case 'ticker':
        u.tickerCfg = { on: !!b.on, text: str(b.text, 200) };
        break;
      case 'mod':
        u.mod = { words: list(b.words, 30, 50), names: list(b.names, 40, 50) };
        break;
      default:
        return res.status(404).json({ error: 'Pengaturan tidak ada' });
    }
    save();
    res.json({ ok: true });
  });

  app.get('/api/overlay/:key/config', (req, res) => {
    const u = byKey(req.params.key);
    if (!u) return res.status(404).json({ error: 'Key salah' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(cfgs(u).alert);
  });

  app.get('/api/overlay/:key/widget/:type', (req, res) => {
    const u = byKey(req.params.key);
    if (!u) return res.status(404).json({ error: 'Key salah' });
    const c = cfgs(u), tz = u.tz || 'Asia/Jakarta', now = Date.now(), items = paid(u);
    res.setHeader('Cache-Control', 'no-store');
    const t = req.params.type;
    if (t === 'leaderboard') {
      const ok = d => c.lb.range === 'all' || (c.lb.range === 'today' ? dayKey(d.paidAt, tz) === dayKey(now, tz) : d.paidAt > now - (c.lb.range === 'week' ? 7 : 30) * 86400000);
      const m = {};
      items.filter(ok).forEach(d => { const k = d.name.toLowerCase(); m[k] = m[k] || { name: d.name, amount: 0 }; m[k].amount += d.amount; });
      return res.json({ cfg: c.lb, rows: Object.values(m).sort((a, b) => b.amount - a.amount).slice(0, c.lb.count) });
    }
    if (t === 'milestone') return res.json({ cfg: c.goal, current: items.filter(d => d.paidAt >= c.goal.since).reduce((s, d) => s + d.amount, 0) });
    if (t === 'ticker') return res.json({ cfg: c.ticker });
    res.status(404).json({ error: 'Widget tidak ada' });
  });

  app.get('/overlay/:key/:type', (req, res) => {
    if (!['leaderboard', 'milestone', 'ticker'].includes(req.params.type)) return res.status(404).end();
    res.sendFile(path.join(__dirname, 'public', 'widget.html'));
  });

  app.get('/api/stats', auth, (req, res) => {
    const tz = req.user.tz || 'Asia/Jakarta', now = Date.now(), items = paid(req.user);
    const days = {}, top = {};
    let total = 0;
    for (let i = 13; i >= 0; i--) days[dayKey(now - i * 86400000, tz)] = 0;
    items.forEach(d => {
      total += d.amount;
      const k = dayKey(d.paidAt, tz);
      if (k in days) days[k] += d.amount;
      const n = d.name.toLowerCase();
      top[n] = top[n] || { name: d.name, amount: 0, n: 0 };
      top[n].amount += d.amount;
      top[n].n++;
    });
    res.json({
      count: items.length, total, avg: items.length ? Math.round(total / items.length) : 0,
      days: Object.entries(days).map(([day, amount]) => ({ day, amount })),
      top: Object.values(top).sort((a, b) => b.amount - a.amount).slice(0, 5)
    });
  });
};
