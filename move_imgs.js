const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/moham/.gemini/antigravity/brain/e19b4319-10bc-4455-937a-df3b04d82c15';
const destDir = 'c:/Users/moham/codes/ps5-controller/public/assets/instagram';

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
files.forEach(file => {
    if (file.endsWith('.png')) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file}`);
    }
});
