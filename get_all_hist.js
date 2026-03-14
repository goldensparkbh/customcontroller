const cp = require('child_process');
const fs = require('fs');
try {
    const log = cp.execSync('git log --all -p -- src/pages/Configurator.jsx').toString();
    fs.writeFileSync('all_history.txt', log);
    console.log('Saved all history');
} catch (e) {
    console.error(e.message);
}
