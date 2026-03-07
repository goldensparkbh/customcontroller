const fs = require('fs');
const path = require('path');

const chunks = ['chunk_1.txt', 'chunk_2.txt', 'chunk_3.txt', 'chunk_4.txt', 'chunk_5.txt'];
const targetFile = path.join('src', 'pages', 'Configurator.jsx');
const logFile = 'force_log.txt';

function log(msg) {
    try { fs.appendFileSync(logFile, msg + '\n'); } catch (e) { }
    console.log(msg);
}

log('Starting force update...');

try {
    // 1. Read all chunks first to memory to ensure we have them
    let fullContent = '';
    for (const chunk of chunks) {
        if (!fs.existsSync(chunk)) {
            log(`Error: Missing chunk ${chunk}`);
            process.exit(1);
        }
        fullContent += fs.readFileSync(chunk, 'utf8');
    }
    log(`Loaded ${fullContent.length} bytes.`);

    // 2. Open file with 'w' flag to truncate and write
    // We use openSync + writeSync for granular control, or just writeFileSync is usually fine.
    // We will try writeFileSync first.
    fs.writeFileSync(targetFile, fullContent, 'utf8');
    log(`Successfully overwrote ${targetFile}`);

} catch (err) {
    log(`Failed: ${err.message}`);
    // Try fallback: delete then write?
    try {
        if (fs.existsSync(targetFile)) {
            log('Attempting to unlink...');
            fs.unlinkSync(targetFile);
        }
        fs.writeFileSync(targetFile, fullContent, 'utf8');
        log('Success after unlink.');
    } catch (e2) {
        log(`Double failure: ${e2.message}`);
    }
}
