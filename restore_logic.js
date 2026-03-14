const cp = require('child_process');
const fs = require('fs');

try {
    const logic = cp.execSync('git show HEAD~1:public/configurator-logic.js').toString();
    fs.writeFileSync('public/configurator-logic.js', logic);
    console.log('Restored old configurator-logic.js');
} catch (e) {
    console.error(e);
}
