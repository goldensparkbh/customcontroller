
import re
import os

log_file = "patch_log.txt"

def log(msg):
    with open(log_file, "a", encoding='utf-8') as f:
        f.write(msg + "\n")
    print(msg)

try:
    if os.path.exists(log_file):
        os.remove(log_file)
    
    log("Starting patch...")
    target_file = "src/pages/Configurator.jsx"
    
    with open(target_file, "r", encoding='utf-8') as f:
        content = f.read()
    
    log(f"Original length: {len(content)}")
    
    # 1. Insert Grid
    # Match specific ID and the closing div after buttons
    switch_pattern = r'(<div class="mobile-panel-switch" id="mobilePanelSwitch".*?</button>\s*</div>)'
    
    if "mobileOptionsGrid" in content:
        log("Grid ID already present.")
    else:
        match = re.search(switch_pattern, content, re.DOTALL)
        if match:
            log("Found switch block.")
            block = match.group(1)
            replacement = block + '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>'
            content = content.replace(block, replacement, 1)
            log("Inserted grid.")
        else:
            log("Switch block regex did not match.")
            # Debug: show surrounding of ID
            idx = content.find('id="mobilePanelSwitch"')
            if idx != -1:
                log(f"Switch context: {content[idx:idx+200]}")

    # 2. Remove Drawer
    # Look for the drawer div up to the accordion div
    drawer_pattern = r'(<div class="mobile-options-drawer" id="mobileOptionsDrawer".*?)(<div class="parts-accordion">)'
    
    if "mobileOptionsDrawer" not in content:
        log("Drawer ID not found (already removed).")
    else:
        match = re.search(drawer_pattern, content, re.DOTALL)
        if match:
            log("Found drawer block. Removing...")
            content = content.replace(match.group(0), match.group(2), 1)
            log("Removed drawer.")
        else:
            log("Drawer regex did not match.")
            # Debug context
            idx = content.find('id="mobileOptionsDrawer"')
            if idx != -1:
                log(f"Drawer context: {content[idx:idx+200]}")

    with open(target_file, "w", encoding='utf-8') as f:
        f.write(content)
    
    log("Write complete.")

except Exception as e:
    log(f"Error: {e}")
