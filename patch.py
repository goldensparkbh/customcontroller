
import os
import re

file_path = r'c:\Users\moham\codes\ps5-controller\src\pages\Configurator.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Read {len(content)} chars.")

# 1. Insert Grid
# Regex to find the closing div of mobilePanelSwitch.
# Pattern: <div class="mobile-panel-switch".*?</div>
# We need to match lazily until the closing div, but there are nested buttons.
# The block is:
# <div class="mobile-panel-switch" ...>
#   <button ...>...</button>
#   <button ...>...</button>
# </div>
# So we can match the ID line, then finding the subsequent `</div>` is tricky with regex if nested.
# But we know the indentation from view_file: `    </div>` (4 spaces).
# Let's match the exact closing sequence:
# `      </button>\n    </div>`
pattern_switch_end = r'(</button>\s*</div>)'
# We want to insert AFTER this.

# Let's find the specific block first to be safe.
if 'id="mobilePanelSwitch"' in content:
    # Find the closing tag
    # It ends with two buttons.
    # regex: (id="mobilePanelSwitch".*?</button>\s*<button.*?</button>\s*</div>)
    # matching across lines with DOTALL
    pattern_block = r'(<div class="mobile-panel-switch" id="mobilePanelSwitch".*?</button>\s*<button.*?</button>\s*</div>)'
    
    match = re.search(pattern_block, content, re.DOTALL)
    if match:
        print("Found switch block.")
        block = match.group(1)
        # Check if grid is already there
        if 'mobileOptionsGrid' not in content[match.end():match.end()+200]:
             new_block = block + '\n    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>'
             content = content.replace(block, new_block, 1)
             print("Inserted grid.")
        else:
            print("Grid already present.")
    else:
        print("Could not match switch block structure.")
else:
    print("Could not find mobilePanelSwitch ID.")

# 2. Remove Drawer
# <div class="mobile-options-drawer" ... > ... </div>
# It contains `mobile-options-tabs` and `mobileOptionsGrid`.
# It sits before `<div class="parts-accordion">`.
if 'id="mobileOptionsDrawer"' in content:
    # Match from start of drawer to start of accordion
    # Note: Regex might be greedy or not greedy enough.
    # Pattern: (<div class="mobile-options-drawer".*?)(<div class="parts-accordion">)
    pattern_drawer = r'(<div class="mobile-options-drawer".*?)(<div class="parts-accordion">)'
    match = re.search(pattern_drawer, content, re.DOTALL)
    if match:
        print("Found drawer block.")
        # Replace the first group with empty string (or spaces to keep lines?)
        # Just remove it.
        # But `match.group(1)` includes everything up to accordion.
        # We replace `match.group(1)` with empty string.
        # Wait, ensure we don't delete `parts-accordion`.
        # The group 1 is the part to delete.
        to_delete = match.group(1)
        content = content.replace(to_delete, '', 1)
        print("Removed drawer.")
    else:
        print("Could not match drawer area.")
else:
    print("Drawer ID not found.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
