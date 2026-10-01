import sys

def patch(anchor, new):
    p = 'public/style.css'
    s = open(p, encoding='utf-8').read()
    n = s.count(anchor)
    if n != 1:
        print('GAGAL anchor ditemukan', n, 'kali:', anchor)
        sys.exit(1)
    open(p, 'w', encoding='utf-8').write(s.replace(anchor, new))
    print('OK')

patch(".top{background:var(--ink);color:#fff;padding:28px 16px 60px}",
      ".top{background:var(--ink);color:#fff;padding:28px max(16px,calc((100% - 460px)/2)) 60px}")
patch(".in,.sheet{max-width:460px;margin-left:auto;margin-right:auto}",
      ".in{max-width:460px;margin:0 auto}")
patch(".sheet{margin-top:-32px;background:var(--paper);border-radius:28px 28px 0 0;padding:22px 16px 110px;min-height:60vh;position:relative}",
      ".sheet{margin:-32px 0 0;background:var(--paper);border-radius:28px 28px 0 0;padding:22px max(16px,calc((100% - 460px)/2)) 110px;min-height:60vh;position:relative}")
