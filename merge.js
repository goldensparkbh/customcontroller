const fs = require('fs');
const path = require('path');

const logFile = 'merge_log.txt';
function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
}

const chunks = ['conf_1.txt', 'conf_2.txt', 'conf_3.txt'];
const outFile = path.join('src', 'pages', 'Configurator_fixed.jsx');

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

    fs.writeFileSync(outFile, content, 'utf8');
    log(`Successfully merged into ${outFile}`);
} catch (err) {
    log(`Error: ${err.message}`);
    process.exit(1);
}
