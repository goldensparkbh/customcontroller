const cp = require('child_process');
const fs = require('fs');

const commits = ['HEAD', 'HEAD~1', 'HEAD~2'];

for (const commit of commits) {
    try {
        const cfg = cp.execSync(`git show ${commit}:src/pages/Configurator.jsx`).toString();
        fs.writeFileSync(`Configurator_${commit.replace('~', '_')}.jsx`, cfg);
        console.log(`Saved ${commit}`);
    } catch (e) {
        console.log(`Failed on ${commit}`);
    }
}
