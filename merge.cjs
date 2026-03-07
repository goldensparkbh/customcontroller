const fs = require('fs');
const path = require('path');

const logFile = 'merge_log.txt';
function log(msg) {
    try { fs.appendFileSync(logFile, msg + '\n'); } catch (e) { }
}

const chunks = ['conf_1.txt', 'conf_2.txt', 'conf_3.txt'];
const outFile = path.join('src', 'pages', 'Configurator_fixed.jsx'); // Try to write deep again, else root

try {
    log('Starting merge...');
    let content = '';
    for (const chunk of chunks) {
        if (fs.existsSync(chunk)) {
            content += fs.readFileSync(chunk, 'utf8');
            log(`Read ${chunk}`);
        } else {
            log(`Missing ${chunk}`);
            process.exit(1);
        }
    }

    // Ensure dir exists
    const dir = path.dirname(outFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outFile, content, 'utf8');
    log(`Successfully merged into ${outFile}`);
    console.log(`Successfully merged into ${outFile}`);
} catch (err) {
    log(`Error: ${err.message}`);
    // Try root as fallback
    try {
        const rootOut = 'Configurator_fixed.jsx';
        let content = '';
        for (const chunk of chunks) content += fs.readFileSync(chunk, 'utf8');
        fs.writeFileSync(rootOut, content, 'utf8');
        console.log(`Fallback: Merged into ${rootOut}`);
    } catch (e2) {
        console.error(e2);
        process.exit(1);
    }
}
