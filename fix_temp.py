
import re
import os
import time

print("Starting fix_temp.py...")

if not os.path.exists('temp_full.jsx'):
    print("ERROR: temp_full.jsx does not exist!")
    exit(1)

print(f"Reading temp_full.jsx size: {os.path.getsize('temp_full.jsx')}")

with open('temp_full.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Read {len(content)} chars.")

# 1. Insert Grid
switch_regex = r'(<div class="mobile-panel-switch" id="mobilePanelSwitch"[\s\S]*?</button>\s*</div>)'
match = re.search(switch_regex, content)
if match:
    print("Found switch block.")
    block = match.group(1)
    if 'mobileOptionsGrid' not in content[match.end():match.end()+200]:
        print("Inserting grid...")
        replacement = block + '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>'
        content = content.replace(block, replacement, 1)
    else:
        print("Grid already present.")
else:
    print("Switch block NOT FOUND.")

# 2. Remove Drawer
drawer_regex = r'(<div class="mobile-options-drawer"[\s\S]*?)(<div class="parts-accordion">)'
match = re.search(drawer_regex, content)
if match:
    print("Found drawer block. Removing...")
    content = content.replace(match.group(0), match.group(2), 1)
else:
    print("Drawer block NOT FOUND.")

# Write back
print("Writing to src/pages/Configurator.jsx...")
try:
    with open('src/pages/Configurator.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Write success.")
except Exception as e:
    print(f"Write failed: {e}")

print("Done.")
