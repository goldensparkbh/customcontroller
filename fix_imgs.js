const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/moham/.gemini/antigravity/brain/e19b4319-10bc-4455-937a-df3b04d82c15';
const destDir = 'c:/Users/moham/codes/ps5-controller/public/assets/instagram';

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
files.forEach(file => {
    // Match custom_ps5_controller_X_...
    const match = file.match(/custom_ps5_controller_(\d+)_/);
    if (match) {
        const id = match[1];
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, `ig-${id}.png`);
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied and renamed ${file} to ig-${id}.png`);
    }
});
