const fs = require('fs');
const path = require('path');

const chunks = ['chunk_1.txt', 'chunk_2.txt', 'chunk_3.txt', 'chunk_4.txt', 'chunk_5.txt'];
const targetFile = path.join('src', 'pages', 'Configurator.jsx');

console.log('Starting patch process...');

try {
    let finalContent = '';
    for (const chunk of chunks) {
        if (!fs.existsSync(chunk)) {
            console.error(`Error: Missing chunk ${chunk}`);
            process.exit(1);
        }
        console.log(`Reading ${chunk}...`);
        finalContent += fs.readFileSync(chunk, 'utf8');
    }

    console.log(`Writing to ${targetFile}...`);
    fs.writeFileSync(targetFile, finalContent, 'utf8');
    console.log('Successfully updated Configurator.jsx');
} catch (err) {
    console.error('Failed to apply patch:', err);
    process.exit(1);
}
