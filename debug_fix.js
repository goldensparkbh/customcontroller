
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Configurator.jsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Total length:', content.length);

// 1. Locate Panel Switch
const switchStart = '<div class="mobile-panel-switch"';
const switchStartIdx = content.indexOf(switchStart);
if (switchStartIdx === -1) {
    console.error('FAIL: Could not find switch start');
} else {
    // Look for closing tag.
    // It should be around +500 chars or so.
    const lookAhead = content.slice(switchStartIdx, switchStartIdx + 600);
    // console.log('Snippet around switch:', lookAhead);

    // The block ends with </div>.
    // AND it contains TWO buttons.
    // Let's find `aria-label="تبديل لوحة الأجزاء والألوان"`.
    // Then `</div>` that closes it.
    // The indentation of the closing `</div>` is key.
    // In `view_file`, it was 4 spaces.

    // Let's find the closing tag by index.
    // We know it ends after the second </button>.
    const lastBtn = '</button>';
    const btn2Idx = lookAhead.lastIndexOf(lastBtn);
    if (btn2Idx !== -1) {
        // Find next </div>
        const divClose = '</div>';
        const closeIdx = lookAhead.indexOf(divClose, btn2Idx);
        if (closeIdx !== -1) {
            const absoluteCloseIdx = switchStartIdx + closeIdx + divClose.length;
            console.log('Found switch closing at:', absoluteCloseIdx);

            // Check if grid is already there
            const check = content.slice(absoluteCloseIdx, absoluteCloseIdx + 200);
            if (!check.includes('mobileOptionsGrid')) {
                // INSERT GRID
                const toInsert = '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>';
                content = content.slice(0, absoluteCloseIdx) + toInsert + content.slice(absoluteCloseIdx);
                console.log('SUCCESS: Inserted grid');
            } else {
                console.log('Grid already present.');
            }
        }
    }
}

// 2. Remove Drawer
// Start: <div class="mobile-options-drawer"
const drawerStart = '<div class="mobile-options-drawer"';
const dStartIdx = content.indexOf(drawerStart);
if (dStartIdx !== -1) {
    // End: It ends before <div class="parts-accordion">
    const nextPart = '<div class="parts-accordion">';
    const nextPartIdx = content.indexOf(nextPart);

    if (nextPartIdx !== -1 && nextPartIdx > dStartIdx) {
        const removed = content.slice(dStartIdx, nextPartIdx);
        // console.log('Removing:', removed);

        // Check if we are deleting too much?
        // The parts panel contains the drawer AND the accordion?
        // Let's check indentation.
        // Lines 106-138 in original file.
        // 105: <div class="parts-panel">
        // 106: <div class="mobile-options-drawer"...
        // 113: <div class="parts-accordion">

        // Yes, removing from start of drawer to start of accordion is correct.
        // Just keep whitespace clean?
        // `nextPartIdx` points to start of `<div `
        // We can remove up to there.
        content = content.slice(0, dStartIdx) + content.slice(nextPartIdx);
        console.log('SUCCESS: Removed drawer');
    }
} else {
    console.log('Drawer not found.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Write complete');
