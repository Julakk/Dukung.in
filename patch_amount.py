import sys

def patch(path, anchor, new):
    s = open(path, encoding='utf-8').read()
    n = s.count(anchor)
    if n != 1:
        print('GAGAL', path, 'anchor ditemukan', n, 'kali:', anchor)
        sys.exit(1)
    open(path, 'w', encoding='utf-8').write(s.replace(anchor, new))
    print('OK', path)

patch('public/dashboard.html', 'id="wamt" type="number"', 'id="wamt" type="text"')
patch('public/dashboard.html', "amount: $('#wamt').value", "amount: $('#wamt').value.replace(/\\D/g, '')")
patch('public/creator.html', 'id="a" type="number"', 'id="a" type="text"')
patch('public/creator.html', "amount: $('#a').value", "amount: $('#a').value.replace(/\\D/g, '')")
