import sys

p = 'server.js'
s = open(p, encoding='utf-8').read()
start = "const FEE_PCT = parseFloat"
end = "app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));\n\n"
i1 = s.find(start)
i2 = s.find(start, i1 + 1) if i1 != -1 else -1
if i2 != -1:
    e2 = s.find(end, i2)
    if e2 == -1:
        print('GAGAL: akhir blok server tidak ketemu')
        sys.exit(1)
    s = s[:i2] + s[e2 + len(end):]
    print('server.js: blok kedua dihapus')
dbl = "...walletInfo(req.user),\n    ...walletInfo(req.user),"
if dbl in s:
    s = s.replace(dbl, "...walletInfo(req.user),")
    print('server.js: walletInfo dobel dirapikan')
open(p, 'w', encoding='utf-8').write(s)

p = 'public/dashboard.html'
s = open(p, encoding='utf-8').read()
t = '<h2>Penarikan dana</h2>'
i1 = s.find(t)
i2 = s.find(t, i1 + 1) if i1 != -1 else -1
if i2 != -1:
    st = s.rfind('<div class="card">', 0, i2)
    em = '<div id="wlist" style="margin-top:12px"></div>\n  </div>\n  '
    e2 = s.find(em, i2)
    if st == -1 or e2 == -1:
        print('GAGAL: kartu dashboard tidak ketemu')
        sys.exit(1)
    s = s[:st] + s[e2 + len(em):]
    print('dashboard.html: kartu kedua dihapus')
open(p, 'w', encoding='utf-8').write(s)

checks = {
    'server.js': ["const FEE_PCT", "app.put('/api/payout'", "...walletInfo", "app.get('/admin'"],
    'public/dashboard.html': ['Penarikan dana', 'Saldo tersedia', 'rp(j.balance)', "$('#wgo').onclick"],
}
for f, ks in checks.items():
    t = open(f, encoding='utf-8').read()
    for k in ks:
        print(t.count(k), k)
