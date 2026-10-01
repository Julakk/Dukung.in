const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'data.json');
let data = { users: [], donations: [], sessions: {} };
if (fs.existsSync(FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    console.error('data.json rusak. Server berhenti supaya data tidak tertimpa. Pulihkan dari folder backups/.');
    process.exit(1);
  }
}
function save() {
  const tmp = FILE + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, FILE);
}
module.exports = { data, save };
