// Pakai: BACKUP_PASS=sandi node scripts/restore-backup.js file.enc > data.restored.json
const fs = require('fs');
const crypto = require('crypto');
if (!process.argv[2] || !process.env.BACKUP_PASS) { console.error('Pakai: BACKUP_PASS=sandi node scripts/restore-backup.js file.enc > data.restored.json'); process.exit(1); }
const b = fs.readFileSync(process.argv[2]);
const d = crypto.createDecipheriv('aes-256-gcm', crypto.scryptSync(process.env.BACKUP_PASS, b.subarray(0, 16), 32), b.subarray(16, 28));
d.setAuthTag(b.subarray(28, 44));
try { process.stdout.write(Buffer.concat([d.update(b.subarray(44)), d.final()])); }
catch (e) { console.error('Gagal dekripsi: sandi salah atau file rusak'); process.exit(1); }
