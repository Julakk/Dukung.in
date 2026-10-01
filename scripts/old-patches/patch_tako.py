def sub(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        print(path, s.count(a), 'x', a[:45])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)

sub('public/style.css', [
    ('--kunyit:#ffc21a', '--brand:#37a2ea'),
    ('var(--kunyit)', 'var(--brand)'),
    ('#1b1f4b', '#0e2a47'),
    ('#f6f7fb', '#f2f8fd'),
    ('#dfe2ee', '#d5e6f5'),
    ('#6b7094', '#5b7a96'),
    ('#e6e9f5', '#e3effa'),
    ('#c5c9ee', '#1d4b73'),
    ('.top{background:var(--ink);color:#fff;', '.top{background:var(--brand);color:var(--ink);'),
    ('.bal{font-size:40px;font-weight:800;color:var(--brand)', '.bal{font-size:40px;font-weight:800;color:var(--ink)'),
    ('.av{width:64px;height:64px;border-radius:50%;background:var(--brand)', '.av{width:64px;height:64px;border-radius:50%;background:#fff'),
])

for f in ['login', 'creator', 'dashboard', 'admin']:
    sub('public/%s.html' % f, [('#1b1f4b', '#37a2ea')])

sub('public/dashboard.html', [("location.href = '/'", "location.href = '/login'")])
sub('public/reset.html', [("location.href = '/'", "location.href = '/login'")])

sub('public/login.html', [
    ('<h1>Dukung.in</h1>', '<h1><a href="/" style="color:inherit;text-decoration:none">Dukung.in</a></h1>'),
])
s = open('public/login.html', encoding='utf-8').read()
a = "document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setMode(b.dataset.m));"
if "includes('daftar')" not in s and s.count(a) == 1:
    s = s.replace(a, a + "\nif (location.search.includes('daftar')) setMode('register');")
    open('public/login.html', 'w', encoding='utf-8').write(s)
    print('login.html: mode daftar ditambah')

s = open('server.js', encoding='utf-8').read()
anchor = "app.get('/dashboard', (req, res) =>"
route = "app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));\n\n"
if "app.get('/login'" not in s and s.count(anchor) == 1:
    open('server.js', 'w', encoding='utf-8').write(s.replace(anchor, route + anchor))
    print('server.js: route /login ditambah')
