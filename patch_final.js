
const fs = require('fs');
const path = require('path');

const logFile = 'patch_status.txt';
function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}

try {
    log('Script started.');
    const filePath = path.join(__dirname, 'src/pages/Configurator.jsx');
    if (!fs.existsSync(filePath)) {
        log('Error: Configurator.jsx not found');
        process.exit(1);
    }

    let content = fs.readFileSync(filePath, 'utf8');
    log('File read, length: ' + content.length);

    let modifications = 0;

    // 1. Insert Grid
    // Search for the ID
    const switchId = 'id="mobilePanelSwitch"';
    const switchIdx = content.indexOf(switchId);

    if (switchIdx !== -1) {
        log('Found mobilePanelSwitch');
        // We know from view_file that the block ends with </div> indented by 4 spaces.
        // It roughly contains two buttons.
        // Let's find the closing div by looking for the next occurrence of `    </div>` after the switchIdx.
        // But we have to be careful not to pick a nested div.
        // The structure is:
        // <div ...>
        //   <button ...>
        //     <span>...</span>
        //   </button>
        //   <button ...>...
        //   </button>
        // </div>
        // There are no other </div> at indentation 4.

        // Let's try to match the exact closing sequence:
        // `      </button>\n    </div>`
        // Or variations of newlines.

        const closeSig = '</button>\n    </div>';
        // Note: Check line endings. If CRLF, \n might be \r\n.
        // Let's use regex for loose matching.

        // Find the END of the block using regex.
        // We start searching from switchIdx.
        const tail = content.slice(switchIdx);
        // Match `</div>` that closes the switch.
        // It's the first `</div>` that appears after the last `</button>`.
        // Actually, simpler: finding the `mobileOptionsGrid` ID to see if we need to act.
        if (content.indexOf('id="mobileOptionsGrid"') === -1) {
            // Not present (or we are moving it).
            // Let's use a split strategy.
            // Split by `id="mobilePanelSwitch"`.
            const parts = content.split('id="mobilePanelSwitch"');
            if (parts.length === 2) {
                const pre = parts[0];
                let post = parts[1]; // starts after ID

                // Find the closing div in `post`.
                // It matches `</div>`.
                // But wait, there are nested divs? No, just buttons.
                // <button><span>...</span></button>
                // So valid closing divs are: </span> (no), </button> (no), </div> (yes).
                // The first </div> in `post` should be the closing one, UNLESS there are divs inside buttons (unlikely).
                // Actually `view_file` showed spans inside buttons.
                // So finding first `</div>` is safe!

                const closeDivIdx = post.indexOf('</div>');
                if (closeDivIdx !== -1) {
                    log('Found closing div.');
                    const insertionIdx = closeDivIdx + 6; // length of </div>
                    // Insert after that
                    const newGrid = '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>';

                    post = post.slice(0, insertionIdx) + newGrid + post.slice(insertionIdx);
                    content = pre + 'id="mobilePanelSwitch"' + post;
                    modifications++;
                    log('Inserted Grid.');
                } else {
                    log('Could not find closing div for switch.');
                }
            }
        } else {
            log('mobileOptionsGrid already exists.');
        }
    } else {
        log('Could not find mobilePanelSwitch ID.');
    }

    // 2. Remove Drawer
    const drawerId = 'id="mobileOptionsDrawer"';
    const drawerIdx = content.indexOf(drawerId);
    if (drawerIdx !== -1) {
        log('Found mobileOptionsDrawer.');
        // It is wrapped in <div class="mobile-options-drawer" ... >
        // We want to find the start of that line.
        const startOfLineIdx = content.lastIndexOf('<div', drawerIdx);
        if (startOfLineIdx !== -1) {
            // Find where it ends.
            // It is followed by `<div class="parts-accordion">`.
            const accordionId = 'class="parts-accordion"';
            const accIdx = content.indexOf(accordionId, startOfLineIdx);

            if (accIdx !== -1) {
                // The drawer ends before `<div class="parts-accordion"`.
                // Find the last `</div>` before accIdx?
                // Or just remove everything from startOfLineIdx UP TO the <div containing accIdx.
                const accDivStart = content.lastIndexOf('<div', accIdx);
                if (accDivStart !== -1 && accDivStart > startOfLineIdx) {
                    log('Removing drawer block...');
                    // content = content.slice(0, startOfLineIdx) + content.slice(accDivStart);
                    // Check if we are removing valid stuff.
                    // The snippet to remove:
                    const snippet = content.slice(startOfLineIdx, accDivStart);
                    log('Snippet length to remove: ' + snippet.length);
                    // log('Snippet: ' + snippet); 

                    content = content.slice(0, startOfLineIdx) + content.slice(accDivStart);
                    modifications++;
                    log('Removed Drawer.');
                }
            }
        }
    } else {
        log('mobileOptionsDrawer not found.');
    }

    if (modifications > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        log('File updated successfully.');
    } else {
        log('No modifications made.');
    }

} catch (err) {
    log('Exception: ' + err.message);
}
