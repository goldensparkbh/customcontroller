const cp = require('child_process');
const fs = require('fs');

try {
    const diff = cp.execSync('git diff HEAD~1 --name-only').toString();
    console.log('Modified files:', diff);

    if (diff.includes('src/pages/Configurator.jsx')) {
        const origCfg = cp.execSync('git show HEAD~1:src/pages/Configurator.jsx').toString();
        fs.writeFileSync('src/pages/Configurator.jsx', origCfg);
        console.log('Restored older Configurator.jsx');
    }
} catch (e) {
    console.error(e);
}
