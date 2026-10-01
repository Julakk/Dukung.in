import sys

p = 'server.js'
s = open(p, encoding='utf-8').read()
start = "const FEE_PCT = parseFloat"
end = "app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));\n\n"
while s.count(start) > 1:
    i = s.rfind(start)
    e = s.find(end, i)
    if e == -1:
        print('GAGAL: akhir blok server tidak ketemu')
        sys.exit(1)
    s = s[:i] + s[e + len(end):]
    print('server.js: satu salinan blok dihapus')
dbl = "...walletInfo(req.user),\n    ...walletInfo(req.user),"
while dbl in s:
    s = s.replace(dbl, "...walletInfo(req.user),", 1)
    print('server.js: walletInfo dobel dirapikan')
open(p, 'w', encoding='utf-8').write(s)

p = 'public/dashboard.html'
s = open(p, encoding='utf-8').read()
t = '<h2>Penarikan dana</h2>'
em = '<div id="wlist" style="margin-top:12px"></div>\n  </div>\n  '
while s.count(t) > 1:
    i = s.rfind(t)
    st = s.rfind('<div class="card">', 0, i)
    e = s.find(em, i)
    if st == -1 or e == -1:
        print('GAGAL: kartu dashboard tidak ketemu')
        sys.exit(1)
    s = s[:st] + s[e + len(em):]
    print('dashboard.html: satu salinan kartu dihapus')
open(p, 'w', encoding='utf-8').write(s)

checks = {
    'server.js': ["const FEE_PCT", "app.put('/api/payout'", "...walletInfo", "app.get('/admin'", "function walletInfo"],
    'public/dashboard.html': ['Penarikan dana', 'Saldo tersedia', 'rp(j.balance)', "$('#wgo').onclick", '<h2>Profil</h2>'],
}
for f, ks in checks.items():
    t2 = open(f, encoding='utf-8').read()
    for k in ks:
        print(t2.count(k), k)
