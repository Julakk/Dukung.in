# Dukung.in

Platform dukungan/donasi untuk kreator Indonesia. Kreator punya halaman publik, donatur membayar lewat QRIS (Tripay), saldo masuk ke wallet kreator dan bisa ditarik.

## Fitur

- Halaman kreator publik (`/username`), profil, bio, kategori, link, avatar dan banner
- Donasi lewat Tripay (QRIS), notifikasi pembayaran lewat callback bertanda tangan
- Dashboard kreator, wallet, dan penarikan saldo (dikonfirmasi manual oleh admin)
- Overlay donasi untuk streaming (`/overlay/:key`)
- Halaman explore, status layanan, FAQ, dan changelog
- Backup otomatis `data.json` (lokal dan terenkripsi ke Discord)

## Menjalankan

    npm install
    node server.js

Server jalan di port 3000 (atur dengan `PORT`). Data disimpan di `data.json`.

## Konfigurasi (.env)

File `.env` jangan pernah di-commit.

    TRIPAY_API_KEY=
    TRIPAY_MERCHANT_CODE=
    TRIPAY_PRIVATE_KEY=
    TRIPAY_MODE=production
    BASE_URL=https://domain-kamu
    ADMIN_KEY=
    FEE_PCT=10
    MIN_WITHDRAW=50000
    TRUST_CF=1
    DISCORD_WEBHOOK_URL=
    BACKUP_PASS=

- `TRIPAY_*`: kredensial Tripay. Kalau `TRIPAY_MODE` bukan `production`, memakai sandbox.
- `TRIPAY_METHOD`: metode bayar (default `QRIS`).
- `ADMIN_KEY`: kunci untuk halaman `/admin` (penarikan dan reset password).
- `FEE_PCT` dan `MIN_WITHDRAW`: potongan platform (persen) dan minimal penarikan.
- `TRUST_CF=1`: isi hanya kalau situs berada di belakang Cloudflare, supaya rate limit memakai IP asli pengunjung.
- `SIMULATE=1`: hanya untuk development tanpa Tripay. Jangan dipakai di production.
- `DISCORD_WEBHOOK_URL` dan `BACKUP_PASS`: backup terenkripsi ke Discord tiap 6 jam.

## Backup dan restore

Backup lokal ada di `backups/`. Backup Discord berupa file `.enc` terenkripsi AES-256-GCM. Cara membukanya:

    BACKUP_PASS=sandi node scripts/restore-backup.js file.enc > data.restored.json

Periksa isi `data.restored.json` dulu, baru gantikan `data.json` (server dalam keadaan mati). Simpan `BACKUP_PASS` di tempat selain server.

## Struktur

- `server.js`: server Express dan semua endpoint
- `db.js`: penyimpanan `data.json` (penulisan atomik)
- `features.js`, `channels.js`: fitur tambahan
- `public/`: halaman frontend
- `scripts/`: script bantu; `scripts/old-patches/` berisi tambalan lama (arsip)
