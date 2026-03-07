
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Configurator.jsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original size:', content.length);

// 1. Add Grid
// Regex to find the panel switch block. we use [\s\S] to match newlines.
// It ends with </div>.
// We look for ID mobilePanelSwitch
const switchRegex = /(<div class="mobile-panel-switch" id="mobilePanelSwitch"[\s\S]*?<\/button>\s*<\/div>)/;
if (switchRegex.test(content)) {
    // Check if grid already exists after it
    // We can't easy check with regex replacement logic, so let's check global.
    if (!content.includes('id="mobileOptionsGrid" class="mobile-options-grid horizontal-scroll"')) {
        // Note: the exact string might vary, check simple ID
        // But we want to avoid double insertion.
        // We will insert.
        console.log('Inserting mobileOptionsGrid...');
        content = content.replace(switchRegex, '$1\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>');
    } else {
        console.log('Grid seems already present (by complex check)?');
    }
} else {
    console.error('Failed to match switch block regex.');
}

// 2. Remove Drawer
// Anchor: <div class="mobile-options-drawer" ... > UP TO <div class="parts-accordion">
const drawerRegex = /(<div class="mobile-options-drawer"[\s\S]*?)(<div class="parts-accordion">)/;

if (drawerRegex.test(content)) {
    console.log('Removing mobileOptionsDrawer...');
    content = content.replace(drawerRegex, '$2');
} else {
    // Check if it's already gone
    if (content.includes('id="mobileOptionsDrawer"')) {
        console.error('Drawer exists but regex failed to match.');
    } else {
        console.log('Drawer already removed.');
    }
}

// 3. Just to be safe, check if we created duplicate headers or something.
// Nah.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
