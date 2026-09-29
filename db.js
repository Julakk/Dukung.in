const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'data.json');
let data = { users: [], donations: [], sessions: {} };
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
function save() {
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(FILE + '.tmp', FILE);
}
module.exports = { data, save };
