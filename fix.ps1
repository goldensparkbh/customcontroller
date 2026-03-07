
$path = "src/pages/Configurator.jsx"
$content = Get-Content $path -Raw

# 1. Insert Grid
if ($content -notmatch 'id="mobileOptionsGrid"') {
    Write-Host "Inserting grid..."
    $content = $content -replace '(?s)(<div class="mobile-panel-switch" id="mobilePanelSwitch".*?</button>\s*</div>)', '$1 
    <div class="mobile-options-grid horizontal-scroll" id="mobileOptionsGrid"></div>'
} else {
    Write-Host "Grid already present."
}

# 2. Remove Drawer
if ($content -match 'id="mobileOptionsDrawer"') {
    Write-Host "Removing drawer..."
    $content = $content -replace '(?s)(<div class="mobile-options-drawer" id="mobileOptionsDrawer".*?)(<div class="parts-accordion">)', '$2'
} else {
    Write-Host "Drawer not found."
}

Set-Content $path $content -NoNewline
Write-Host "Done."
