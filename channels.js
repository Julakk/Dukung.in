const base = process.env.TRIPAY_MODE === 'production' ? 'https://tripay.co.id/api' : 'https://tripay.co.id/api-sandbox';
fetch(base + '/merchant/payment-channel', { headers: { Authorization: 'Bearer ' + process.env.TRIPAY_API_KEY } })
  .then(r => r.json())
  .then(j => {
    if (!j.success) return console.log('Error:', j.message);
    j.data.forEach(c => console.log(c.code.padEnd(12), c.active ? 'AKTIF ' : 'mati  ', c.name));
  });
