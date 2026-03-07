
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Configurator.jsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Read file length:', content.length);

// 1. Insert Grid
if (content.indexOf('id="mobileOptionsGrid"') !== -1 && content.indexOf('horizontal-scroll') !== -1) {
    console.log('Mobile grid already seems present in correct form?');
} else {
    // Find mobilePanelSwitch
    const switchId = 'id="mobilePanelSwitch"';
    const idx = content.indexOf(switchId);
    if (idx === -1) {
        console.error('Cant find mobilePanelSwitch ID');
    } else {
        // Find the closing div of this element. 
        // It starts with <div class="mobile-panel-switch" ...
        // We can just look for the next "    </div>"
        // Or better: look for "    </div>" that follows "      </button>\n    </div>" pattern?
        // Let's search for the substring of the whole block end?
        const endBlockStr = '<span data-i18n="partsColorsHeading">الألوان</span>\n      </button>\n    </div>';
        const endIdx = content.indexOf(endBlockStr);
        if (endIdx !== -1) {
            console.log('Found end block signature.');
            const insertPoint = endIdx + endBlockStr.length;
            const toInsert = '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>';
            content = content.slice(0, insertPoint) + toInsert + content.slice(insertPoint);
            console.log('Inserted grid container.');
        } else {
            console.error('Could not match end block signature for insertion.');
            // Fallback: try to just replace the whole switching block if I can match it?
            // Let's try matching a smaller signature: `</button>\n    </div>`
            const smallSig = '</button>\n    </div>';
            const smallSigIdx = content.indexOf(smallSig, idx);
            if (smallSigIdx !== -1) {
                console.log('Found small signature.');
                const insertPoint = smallSigIdx + smallSig.length;
                const toInsert = '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>';
                content = content.slice(0, insertPoint) + toInsert + content.slice(insertPoint);
                console.log('Inserted grid container (fallback).');
            }
        }
    }
}

// 2. Remove Drawer
// Look for `<div class="mobile-options-drawer" id="mobileOptionsDrawer"`
// And remove until `</div>` that closes it.
// The drawer contains `mobile-options-tabs` and `mobileOptionsGrid`.
const drawerStartStr = '<div class="mobile-options-drawer"';
const drawerStartIdx = content.indexOf(drawerStartStr);
if (drawerStartIdx !== -1) {
    console.log('Found drawer start.');
    // It ends with </div>.
    // It's followed by <div class="parts-accordion">
    const nextSection = '<div class="parts-accordion">';
    const nextIdx = content.indexOf(nextSection);
    if (nextIdx !== -1 && nextIdx > drawerStartIdx) {
        // Remove everything between.
        // But we need to keep `nextSection`.
        // The drawer block ends with `</div>` (and newlines).
        // Let's just slice from drawerStartIdx to nextIdx, and check what we are removing.
        const removed = content.slice(drawerStartIdx, nextIdx);
        // Verify it looks like the drawer
        if (removed.includes('id="mobileOptionsDrawer"')) {
            content = content.slice(0, drawerStartIdx) + content.slice(nextIdx);
            console.log('Removed drawer block.');
        }
    } else {
        console.error('Could not find next section to delimit drawer removal.');
    }
} else {
    console.log('Drawer start not found (already removed?).');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
