(async function () {
  const r0 = await fetch('/api/settings', { headers: H });
  if (!r0.ok) return;
  const S = await r0.json();
  const OV = location.origin + '/overlay/' + S.key;
  const mk = (t, c, x) => el(t, c, x);

  function mkPane(name, group, label) {
    const s = mk('section', 'pane');
    s.id = 'p-' + name;
    $('.ct').append(s);
    let g = [...document.querySelectorAll('aside details')].find(d => d.querySelector('summary').textContent.trim() === group);
    if (!g) {
      g = document.createElement('details');
      g.className = 'card'; g.open = true; g.style.marginTop = '14px';
      const bd = mk('div', 'bd');
      bd.append(mk('div', 'mb'));
      g.append(mk('summary', '', group), bd);
      $('aside').append(g);
    }
    const b = mk('button', '', label);
    b.dataset.t = name;
    b.onclick = () => tab(name, true);
    g.querySelector('.mb').append(b);
    valid.push(name);
    return s;
  }
  function mkCard(pn, title) {
    const d = document.createElement('details');
    d.className = 'card'; d.open = true;
    const b = mk('div', 'bd');
    d.append(mk('summary', '', title), b);
    pn.append(d);
    return b;
  }
  function inp(v, o) { const i = document.createElement('input'); Object.assign(i, o || {}); i.value = v; return i; }
  function fld(parent, label, node) { parent.append(mk('label', 'f', label), node); return node; }
  function sel(opts, v) {
    const s = document.createElement('select');
    opts.forEach(([a, b]) => { const o = mk('option', '', b); o.value = a; s.append(o); });
    s.value = v;
    return s;
  }
  function chk(parent, label, v) {
    const l = mk('label', 'ck'), i = document.createElement('input');
    i.type = 'checkbox'; i.checked = !!v;
    l.append(i, ' ' + label);
    parent.append(l);
    return i;
  }
  function area(v, o) { const t = document.createElement('textarea'); Object.assign(t, o || {}); t.value = v; return t; }
  function link(parent, path, testLabel) {
    const url = OV + path;
    const a = mk('a', 'lnk', url);
    a.href = url; a.target = '_blank';
    parent.append(a);
    const row = mk('div', 'acts'), c = mk('button', 'cta', 'Salin link'), o = mk('button', 'ghost', testLabel);
    c.onclick = () => copy(url, c);
    o.onclick = () => window.open(path === '' ? url + '?test=1' : url, '_blank');
    row.append(c, o);
    parent.append(row);
  }
  function saveBtn(parent, sec, body, after) {
    const m = mk('div', 'ok'), b = mk('button', 'cta', 'Simpan');
    parent.append(m, b);
    b.onclick = async () => {
      const r = await fetch('/api/settings/' + sec, { method: 'PUT', headers: H, body: JSON.stringify(body()) });
      m.className = r.ok ? 'ok' : 'err';
      m.textContent = r.ok ? 'Tersimpan' : 'Gagal menyimpan';
      if (r.ok && after) after();
      setTimeout(() => m.textContent = '', 2500);
    };
  }
  const fmtNum = i => { i.oninput = () => { const d = digits(i.value); i.value = d ? Number(d).toLocaleString('id-ID') : ''; }; };

  // Statistik
  const sp = mkPane('statistik', 'Akun', 'Statistik');
  const sc = mkCard(sp, 'Ringkasan');
  const st = mk('div', 'stt'), bars = mk('div', 'bars'), cap = mk('div', 'mut');
  sc.append(st, bars, cap);
  const tc = mkCard(sp, 'Pendukung teratas');
  const tl = mk('div');
  tc.append(tl);
  async function stats() {
    const r = await fetch('/api/stats', { headers: H });
    if (!r.ok) return;
    const j = await r.json();
    st.innerHTML = '';
    [['Total dukungan', j.count], ['Total nilai', rp(j.total)], ['Rata-rata', rp(j.avg)]].forEach(([k, v]) => {
      const d = mk('div');
      d.append(mk('span', 'mut', k), mk('b', '', String(v)));
      st.append(d);
    });
    const mx = Math.max(1, ...j.days.map(d => d.amount));
    bars.innerHTML = '';
    j.days.forEach(d => { const i = document.createElement('i'); i.style.height = (d.amount / mx * 100) + '%'; i.title = d.day + ': ' + rp(d.amount); bars.append(i); });
    cap.textContent = '14 hari terakhir: ' + j.days[0].day + ' sampai ' + j.days[j.days.length - 1].day + '. Batang tertinggi ' + rp(mx > 1 ? mx : 0) + '.';
    tl.innerHTML = '';
    if (!j.top.length) tl.append(mk('div', 'empty', 'Belum ada data.'));
    j.top.forEach(t => {
      const it = mk('div', 'item'), row = mk('div', 'row');
      row.append(mk('b', '', t.name), mk('span', 'amt', rp(t.amount)));
      it.append(row, mk('p', '', t.n + ' kali mendukung'));
      tl.append(it);
    });
  }
  stats();
  setInterval(stats, 60000);

  // Alert
  const ap = mkPane('alert', 'Live stream overlay', 'Alert');
  link(mkCard(ap, 'Link overlay alert'), '', 'Tes overlay');
  const ab = mkCard(ap, 'Kustomisasi alert');
  const a = S.alert;
  const pv = mk('div', 'pv');
  ab.append(pv);
  const f = {
    tpl: fld(ab, 'Teks dukungan. Pakai {sender} dan {amount}', inp(a.tpl, { maxLength: 80 })),
    size: fld(ab, 'Ukuran font (12-40)', inp(a.size, { inputMode: 'numeric' })),
    pos: fld(ab, 'Posisi', sel([['top', 'Atas'], ['center', 'Tengah'], ['bottom', 'Bawah']], a.pos)),
    dur: fld(ab, 'Durasi tampil, detik (3-20)', inp(a.dur, { inputMode: 'numeric' })),
    anim: fld(ab, 'Animasi', sel([['slide', 'Geser'], ['fade', 'Pudar'], ['none', 'Tanpa animasi']], a.anim)),
    bg: fld(ab, 'Warna latar', inp(a.bg, { type: 'color' })),
    border: fld(ab, 'Warna border', inp(a.border, { type: 'color' })),
    text: fld(ab, 'Warna teks', inp(a.text, { type: 'color' })),
    hi: fld(ab, 'Warna sorotan (nama dan nominal)', inp(a.hi, { type: 'color' }))
  };
  const cur = chk(ab, 'Tampilkan kode mata uang (Rp)', a.cur);
  const snd = chk(ab, 'Bunyikan suara notifikasi', a.sound);
  function pvu() {
    pv.style.background = f.bg.value; pv.style.border = '2px solid ' + f.border.value; pv.style.color = f.text.value;
    pv.style.fontSize = (parseInt(f.size.value, 10) || 18) + 'px';
    pv.textContent = '';
    f.tpl.value.split(/(\{sender\}|\{amount\})/).forEach(x => {
      if (x === '{sender}' || x === '{amount}') {
        const s = mk('span', '', x === '{sender}' ? 'Budi' : (cur.checked ? 'Rp' : '') + '25.000');
        s.style.color = f.hi.value;
        pv.append(s);
      } else if (x) pv.append(document.createTextNode(x));
    });
  }
  [...Object.values(f), cur].forEach(n => { n.addEventListener('input', pvu); n.addEventListener('change', pvu); });
  pvu();
  saveBtn(ab, 'alert', () => ({ tpl: f.tpl.value, size: f.size.value, pos: f.pos.value, dur: f.dur.value, anim: f.anim.value, bg: f.bg.value, border: f.border.value, text: f.text.value, hi: f.hi.value, cur: cur.checked, sound: snd.checked }));

  // Leaderboard
  const lp = mkPane('leaderboard', 'Live stream overlay', 'Leaderboard');
  link(mkCard(lp, 'Link overlay'), '/leaderboard', 'Buka');
  const lg = mkCard(lp, 'Pengaturan');
  const lf = {
    title: fld(lg, 'Judul', inp(S.lb.title, { maxLength: 40 })),
    count: fld(lg, 'Jumlah pendukung ditampilkan (1-10)', inp(S.lb.count, { inputMode: 'numeric' })),
    range: fld(lg, 'Rentang waktu', sel([['today', 'Hari ini'], ['week', '7 hari terakhir'], ['month', '30 hari terakhir'], ['all', 'Semua waktu']], S.lb.range))
  };
  const la = chk(lg, 'Tampilkan jumlah uang', S.lb.showAmt);
  saveBtn(lg, 'lb', () => ({ title: lf.title.value, count: lf.count.value, range: lf.range.value, showAmt: la.checked }));

  // Milestone
  const mp = mkPane('milestone', 'Live stream overlay', 'Milestone');
  link(mkCard(mp, 'Link overlay'), '/milestone', 'Buka');
  const mg = mkCard(mp, 'Pengaturan');
  const gon = chk(mg, 'Aktifkan milestone', S.goal.on);
  const gti = fld(mg, 'Judul', inp(S.goal.title, { maxLength: 40 }));
  const gt = fld(mg, 'Target (Rp)', inp(Number(S.goal.target).toLocaleString('id-ID'), { inputMode: 'numeric' }));
  fmtNum(gt);
  const rs = chk(mg, 'Mulai ulang progres dari nol saat disimpan', false);
  saveBtn(mg, 'goal', () => ({ on: gon.checked, title: gti.value, target: digits(gt.value), reset: rs.checked }), () => { rs.checked = false; });

  // Running text
  const rp2 = mkPane('ticker', 'Live stream overlay', 'Running text');
  link(mkCard(rp2, 'Link overlay'), '/ticker', 'Buka');
  const rg = mkCard(rp2, 'Pengaturan');
  const ron = chk(rg, 'Aktifkan running text', S.ticker.on);
  const rtx = fld(rg, 'Teks (maks. 200 karakter)', area(S.ticker.text, { rows: 3, maxLength: 200 }));
  saveBtn(rg, 'ticker', () => ({ on: ron.checked, text: rtx.value }));

  // Moderasi
  const fp = mkPane('filter', 'Moderasi', 'Filter');
  const fc = mkCard(fp, 'Filter kata');
  fc.append(mk('p', 'mut', 'Kata di daftar ini diganti bintang di nama dan pesan dukungan. Satu kata per baris.'));
  const fw = fld(fc, 'Kata yang disaring', area(S.mod.words.join('\n'), { className: 'tall' }));
  saveBtn(fc, 'mod', () => { S.mod.words = fw.value.split('\n'); return S.mod; });
  const bp = mkPane('blokir', 'Moderasi', 'Blokir');
  const bc = mkCard(bp, 'Blokir nama');
  bc.append(mk('p', 'mut', 'Dukungan dengan nama yang mengandung teks di daftar ini ditolak. Satu per baris.'));
  const bn = fld(bc, 'Nama yang diblokir', area(S.mod.names.join('\n'), { className: 'tall' }));
  saveBtn(bc, 'mod', () => { S.mod.names = bn.value.split('\n'); return S.mod; });
})();
