
const fs = require('fs');

const logFile = 'patch_log_v2.txt';
function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
}

try {
    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
    log('Starting patch_v2...');

    const filePath = 'src/pages/Configurator.jsx';
    if (!fs.existsSync(filePath)) {
        log('Error: Configurator.jsx missing');
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    log('Read file, length: ' + content.length);

    // 1. Insert Grid
    // Strategy: Find the switch div content.
    // It is unique: id="mobilePanelSwitch"
    const switchId = 'id="mobilePanelSwitch"';
    const switchIdx = content.indexOf(switchId);

    let newContent = content;

    if (switchIdx === -1) {
        log('Error: Could not find mobilePanelSwitch');
    } else {
        if (content.indexOf('id="mobileOptionsGrid"') !== -1) {
            log('Grid already present.');
        } else {
            // Find the closing div for this switch.
            // It is followed by `</div>` (closing controller-buttons-stack, line 75)
            // AND `</div>` (closing controller class?, line 76)
            // AND `<div class="colors-column"` (Line 78)

            // Let's look for `<div class="colors-column"`
            const nextCol = '<div class="colors-column"';
            const nextColIdx = content.indexOf(nextCol);

            if (nextColIdx !== -1) {
                // The switch is before this.
                // Between switchIdx and nextColIdx, there are closing divs.
                // </div> (switch)
                // </div> (stack) -- Wait, look at line 66/75?
                // Step 302:
                // 74: </div>
                // 75: </div>
                // 76: </div>
                // 78: <div class="colors-column"...

                // So we have 3 closing divs before colors-column.
                // We want to insert AFTER the FIRST closing div (switch).
                // Or maybe after the switch block entirely?
                // The grid should be under the switch.
                // If we put it after switch closing div `</div>`.

                // Let's iterate found `</div>` from switchIdx.
                let cursor = switchIdx;
                const closeDiv = '</div>';

                // First </div> is likely closing a button?
                // <button...><span...>...</span></button>
                // Switch contains 2 buttons.
                // We need to skip 2 `</button>`?

                // Let's use the text snippet strategy.
                // Find `aria-label="تبديل لوحة الأجزاء والألوان">`
                // Find `data-i18n="partsColorsHeading">الألوان</span>`
                const lastSpan = 'data-i18n="partsColorsHeading">الألوان</span>';
                const lastSpanIdx = content.indexOf(lastSpan);

                if (lastSpanIdx !== -1) {
                    // Find the `</div>` after this span.
                    // It should follow `</button>`.
                    const btnClose = '</button>';
                    const btnCloseIdx = content.indexOf(btnClose, lastSpanIdx);
                    if (btnCloseIdx !== -1) {
                        const divCloseIdx = content.indexOf(closeDiv, btnCloseIdx); // Closing switch
                        if (divCloseIdx !== -1) {
                            const insertAt = divCloseIdx + closeDiv.length;
                            const gridHtml = '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>';
                            newContent = newContent.slice(0, insertAt) + gridHtml + newContent.slice(insertAt);
                            log('Inserted grid.');
                        }
                    }
                }
            }
        }
    }

    // 2. Remove Drawer
    // <div class="mobile-options-drawer"
    // to
    // <div class="parts-accordion">
    const drawerStartMarker = '<div class="mobile-options-drawer"';
    const accordionMarker = '<div class="parts-accordion">';

    // We search in `newContent`
    const dStart = newContent.indexOf(drawerStartMarker);
    const aStart = newContent.indexOf(accordionMarker);

    if (dStart !== -1 && aStart !== -1 && aStart > dStart) {
        // Remove from dStart to aStart
        // Be careful not to eat whitespace that matters? Doesn't matter much.
        // But we want to preserve `aStart`.
        const before = newContent.slice(0, dStart);
        const after = newContent.slice(aStart);
        newContent = before + after;
        log('Removed drawer.');
    } else {
        log('Drawer markers not found or order invalid.');
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    log('File written.');

} catch (e) {
    log('Exception: ' + e.message);
}
