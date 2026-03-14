const cp = require('child_process');
const fs = require('fs');

try {
    const log = cp.execSync('git log -p -n 5 src/pages/Configurator.jsx').toString();
    fs.writeFileSync('config_history.txt', log);
    console.log('Saved history');
} catch (e) {
    console.error(e);
}
