
import os
import re

file_path = r'c:\Users\moham\codes\ps5-controller\src\pages\Configurator.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Read {len(content)} chars.")

# Debug: find the switch
if 'mobilePanelSwitch' in content:
    idx = content.find('mobilePanelSwitch')
    print(f"Found mobilePanelSwitch at {idx}")
    # Print surrounding 200 chars
    snippet = content[idx-50:idx+350]
    print("SNIPPET BEGIN")
    print(snippet)
    print("SNIPPET END")
    print(f"Hex snippet: {snippet.encode('utf-8').hex()}")
else:
    print("mobilePanelSwitch NOT FOUND")

# Debug: find the drawer
if 'mobileOptionsDrawer' in content:
    idx = content.find('mobileOptionsDrawer')
    print(f"Found mobileOptionsDrawer at {idx}")
    snippet = content[idx-50:idx+300]
    print("DRAWER SNIPPET BEGIN")
    print(snippet)
    print("DRAWER SNIPPET END")
else:
    print("mobileOptionsDrawer NOT FOUND")
