
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/Configurator.jsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Read file length:', content.length);

// 1. Add mobileOptionsGrid after mobilePanelSwitch
// We look for the closing of mobilePanelSwitch.
// It matches: <div class="mobile-panel-switch" ... > ... </div>
// The </button>\n    </div> pattern seems reliable.
// Let's find the ID and then the next </div>
const panelSwitchId = 'id="mobilePanelSwitch"';
const idx = content.indexOf(panelSwitchId);
if (idx === -1) {
    console.error('Could not find mobilePanelSwitch');
    process.exit(1);
}

// Find the closing div for this block.
// We know it ends with `</div>` indented by 4 spaces (lines 67-74).
// Search for `    </div>` after idx.
const closingDivIdx = content.indexOf('    </div>', idx);
if (closingDivIdx === -1) {
    console.error('Could not find closing div for mobilePanelSwitch');
    process.exit(1);
}

// Check if we already added the grid
if (content.indexOf('id="mobileOptionsGrid"') === -1) {
    // We haven't added it (or it's in the drawer, which we will remove)
    // Wait, if it IS in the drawer, we want to MOVE it.
    // So we should just insert the new line after closingDivIdx + 10 (length of </div>\n)
}

const insertionPoint = closingDivIdx + 10; // "    </div>".length is 10? No. "    </div>".length is 10.
// Actually let's just replace the closing div with closing div + new div.
const newHtml = `    </div>
    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>`;

// Only insert if not already there in that spot?
// Regex to check if it's already there?
if (!content.includes('<div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>')) {
    // Only perform if we haven't done it.
    // Replace the first occurrence of "    </div>" after panelSwitchId
    // But verify it is indeed followed by newline?
    // We can just slice the string.
    content = content.slice(0, closingDivIdx) + newHtml + content.slice(closingDivIdx + 10);
    console.log('Inserted mobileOptionsGrid');
} else {
    console.log('mobileOptionsGrid already inserted?');
}

// 2. Remove mobile-options-drawer
// Find the block using the start string.
const drawerStart = '<div class="mobile-options-drawer" id="mobileOptionsDrawer" aria-live="polite">';
const drawerStartIdx = content.indexOf(drawerStart);
if (drawerStartIdx !== -1) {
    // Find the end of this block. It ends with:
    // </div>\n<div class="mobile-options-grid" id="mobileOptionsGrid"></div>\n</div>
    // But note we might have already removed it.
    // Or we might have moved the grid ID.
    // If exact string matching is hard, let's look for enclosing div.
    // Simple heuristic: It ends before `<div class="parts-accordion">`
    const nextBlock = '<div class="parts-accordion">';
    const nextBlockIdx = content.indexOf(nextBlock);
    if (nextBlockIdx !== -1) {
        // Remove everything from drawerStartIdx to nextBlockIdx (minus whitespace?)
        // The drawer block is lines 106-112.
        // We can just splice it out.
        // Verify nextBlock is after drawerStart.
        if (nextBlockIdx > drawerStartIdx) {
            // Check content between
            const fragment = content.slice(drawerStartIdx, nextBlockIdx);
            console.log('Removing fragment:', fragment);
            content = content.slice(0, drawerStartIdx) + content.slice(nextBlockIdx);
            console.log('Removed mobile-options-drawer');
        }
    }
} else {
    console.log('mobile-options-drawer not found (already removed?)');
}

// 3. Update JS Logic (setPanel)
// We replace the setPanel function body.
const oldSetPanelStart = 'function setPanel(panel) {';
const setPanelIdx = content.indexOf(oldSetPanelStart);
if (setPanelIdx !== -1) {
    // find end of function? It assumes indentation or matching braces.
    // Easier: Replace from `function setPanel(panel) {` to `function isMobileLayout() {`
    // Wait, isMobileLayout is after setPanel?
    // Check file content again... yes, looks like it.
    const nextFunc = 'function isMobileLayout() {';
    const nextFuncIdx = content.indexOf(nextFunc);
    if (nextFuncIdx !== -1 && nextFuncIdx > setPanelIdx) {
        const newSetPanel = `function setPanel(panel) {
      currentPanel = panel;
      // On mobile, this now switches the content of the horizontal bar
      selectionPaletteMode = panel;

      document.body.classList.toggle("config-panel-options", panel === "options");
      document.body.classList.toggle("config-panel-colors", panel === "colors");

      panelButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.panel === panel);
        btn.setAttribute("aria-pressed", btn.dataset.panel === panel ? "true" : "false");
      });
      panelSwitchButtons.forEach(btn => {
        const isActive = btn.dataset.panel === panel;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      const mobile = isMobileLayout();
      if (!mobile && accordionItems.length >= 2) {
        accordionItems.forEach((item, idx) => {
          const isOptions = panel === "options";
          item.classList.toggle("open", isOptions ? idx === 0 : idx === 1);
        });
        refreshAccordionHeights();
      }

      if (selectedPartId) {
        // Refresh the content based on new panel
        if (mobile) updateMobileOptionsDrawer();
        else openColorPanelForPart(selectedPartId);
      }
    }
    
    `;
        content = content.slice(0, setPanelIdx) + newSetPanel + content.slice(nextFuncIdx);
        console.log('Updated setPanel');
    }
}

// 4. Update JS Logic (updateMobileOptionsDrawer -> renderMobileGrid)
// Replace updateMobileOptionsDrawer function.
const oldUpdateStart = 'function updateMobileOptionsDrawer() {';
const updateIdx = content.indexOf(oldUpdateStart);
if (updateIdx !== -1) {
    // Find next function: `function openColorPanelForPart(partId) {`
    const nextFunc2 = 'function openColorPanelForPart(partId) {';
    const nextFunc2Idx = content.indexOf(nextFunc2);
    if (nextFunc2Idx !== -1 && nextFunc2Idx > updateIdx) {
        const newUpdate = `function updateMobileOptionsDrawer() {
      // Logic for horizontal scroll bar (repurposed from drawer)
      const mobileOptionsGrid = document.getElementById("mobileOptionsGrid");
      if (!mobileOptionsGrid || !isMobileLayout() || !selectedPartId) {
          if (mobileOptionsGrid) mobileOptionsGrid.innerHTML = "";
          updateMobileSelectedPartBadge();
          return;
      }

      // We rely on selectionPaletteMode set by setPanel or defaults
      let activeTab = selectionPaletteMode;
      const hasOptions = mobileDrawerOptions && mobileDrawerOptions.length;
      const hasColors = mobileDrawerColors && mobileDrawerColors.length;

      if (!hasOptions && !hasColors) {
         mobileOptionsGrid.innerHTML = "";
         updateMobileSelectedPartBadge();
         return;
      }
      
      // Fallback logic
      if (activeTab !== "options" && activeTab !== "colors") {
        activeTab = hasColors ? "colors" : "options";
      }
      if (activeTab === "colors" && !hasColors) activeTab = "options";
      if (activeTab === "options" && !hasOptions) activeTab = "colors";
      selectionPaletteMode = activeTab;

      // Update toggle buttons active state
      panelSwitchButtons.forEach(btn => {
          const p = btn.dataset.panel;
          const isActive = p === activeTab;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-pressed", isActive);
      });

      const entries = activeTab === "colors" ? mobileDrawerColors : mobileDrawerOptions;
      buildPaletteCells(mobileOptionsGrid, entries, activeTab === "options");
      updateMobileSelectedPartBadge();
    }
    
    /* ----- Palette panel ----- */
    
    `; // Note: included the comment header to bridge gap cleanly?
        
        // Actually the original had `/* ----- Palette panel ----- */` after it?
        // Let's check matching.
        // content.slice(nextFunc2Idx) starts with `function open...`
        // so I should probably make sure I consume the previous whitespace correctly.
        
        content = content.slice(0, updateIdx) + newUpdate + content.slice(nextFunc2Idx);
        console.log('Updated updateMobileOptionsDrawer');
    }
}

// 5. Update openColorPanelForPart logic (line 1207 approx)
// `const showOptions = mobile ? hasOptions : (selectionPaletteMode === ...`
const showOptionsSearch = 'const showOptions = mobile ? hasOptions : (selectionPaletteMode === "options" ? true : (selectionPaletteMode === "colors" ? false : (!hasColors && hasOptions)));';
const showOptionsIdx = content.indexOf(showOptionsSearch);
if (showOptionsIdx !== -1) {
    const newShowOptions = 'const showOptions = selectionPaletteMode === "options" ? true : (selectionPaletteMode === "colors" ? false : (!hasColors && hasOptions));';
    // Actually simpler: if we trust selectionPaletteMode is always set now.
    // content = content.replace(showOptionsSearch, newShowOptions); 
    // And showColors
    const showColorsSearch = 'const showColors = mobile ? hasColors : (selectionPaletteMode === "colors" ? true : (selectionPaletteMode === "options" ? false : hasColors));';
    
    // Replace both lines.
    content = content.replace(showOptionsSearch, newShowOptions);
    content = content.replace(showColorsSearch, 'const showColors = selectionPaletteMode === "colors" ? true : (selectionPaletteMode === "options" ? false : hasColors);');
    console.log('Updated showOptions/showColors logic');
} else {
    // If exact string mismatch, try valid regex or skip?
    // The exact string in file:
    // const showOptions = mobile ? hasOptions : (selectionPaletteMode === "options" ? true : (selectionPaletteMode === "colors" ? false : (!hasColors && hasOptions)));
    // Let's try to be flexible if indentation varies.
    console.log('Could not find showOptions line exactly, relying on JS manual update if needed or assuming it works?');
    // Actually, on mobile:
    // Old: mobile ? hasOptions : ...
    // New: selectionPaletteMode === "options" ? ... (same as desktop logic if mode is forced)
    
    // Check if I can just remove `mobile ? ... :` part?
    // No, `mobile ? hasOptions` ignored selectionPaletteMode.
    // The new logic `selectionPaletteMode === "options"` is correct for mobile too if we set mode.
}


fs.writeFileSync(filePath, content, 'utf8');
console.log('Update complete.');
