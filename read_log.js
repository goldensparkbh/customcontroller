const fs = require('fs');
try {
    const logPath = 'C:\\Users\\moham\\.gemini\\antigravity\\brain\\afa4a577-08e8-4155-8cab-f8b890b96004\\.system_generated\\logs\\overview.txt';
    const data = fs.readFileSync(logPath, 'utf8');
    const lines = data.split('\n');
    let startLine = -1;
    let endLine = -1;

    // Search backwards for the most recent creation of Configurator.jsx
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('export default ConfiguratorPage;')) {
            let foundStart = false;
            for (let j = i; j >= Math.max(0, i - 300); j--) {
                if (lines[j].includes('import React')) {
                    startLine = j;
                    endLine = i;
                    foundStart = true;
                    break;
                }
            }
            if (foundStart && lines.slice(startLine, endLine).join('\\n').includes('controllerFaceFront')) {
                break;
            }
        }
    }

    if (startLine > -1) {
        fs.writeFileSync('configurator_found.txt', lines.slice(startLine, endLine + 1).join('\n'));
        console.log('Found it!');
    } else {
        console.log('Not found.');
    }
} catch (e) {
    console.error(e.message);
}
