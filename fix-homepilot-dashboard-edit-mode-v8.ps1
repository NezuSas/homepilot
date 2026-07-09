# HomePilot Dashboard Edit Mode Guard V8
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File .\fix-homepilot-dashboard-edit-mode-v8.ps1

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path, $Content, $encoding)
}

$inspectorPath = "apps/operator-console/src/views/dashboards/WidgetInspector.tsx"
$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"
$widgetPath = "apps/operator-console/src/views/dashboards/DashboardWidget.tsx"

if (!(Test-Path $inspectorPath)) { throw "Missing $inspectorPath" }
if (!(Test-Path $canvasPath)) { throw "Missing $canvasPath" }

# 1) No icon picker for dashboard title
$inspector = Get-Content $inspectorPath -Raw

if ($inspector -notmatch "const isDashboardTitle =") {
  $inspector = [regex]::Replace(
    $inspector,
    "(const\s+isSection\s*=\s*safeWidget\.type\s*===\s*'section';)",
    "`$1`r`n  const isDashboardTitle = safeWidget.type === 'dashboard_title';",
    1
  )
}

$inspector = $inspector -replace "const showIconField = !isSection && !isClock && !isCamera;", "const showIconField = !isDashboardTitle && !isSection && !isClock && !isCamera;"
$inspector = $inspector -replace "const showIconField = !isSection && !isDashboardTitle && !isClock && !isCamera;", "const showIconField = !isDashboardTitle && !isSection && !isClock && !isCamera;"

Write-Utf8NoBom $inspectorPath $inspector

# 2) Widgets only open inspector when edit mode is active
$canvas = Get-Content $canvasPath -Raw

$canvas = [regex]::Replace(
  $canvas,
  "onClick=\{\(\)\s*=>\s*onWidgetClick\(widget\.id\)\}",
  "onClick={() => { if (isEditing) onWidgetClick(widget.id); }}"
)

$canvas = [regex]::Replace(
  $canvas,
  "onClick=\{\(\)\s*=>\s*\{\s*onWidgetClick\(widget\.id\);\s*\}\}",
  "onClick={() => { if (isEditing) onWidgetClick(widget.id); }}"
)

$canvas = [regex]::Replace(
  $canvas,
  "isSelected=\{\s*selectedWidgetId\s*===\s*widget\.id\s*\}",
  "isSelected={isEditing && selectedWidgetId === widget.id}"
)

Write-Utf8NoBom $canvasPath $canvas

# 3) Internal widget guard, if root node calls onClick directly
if (Test-Path $widgetPath) {
  $widget = Get-Content $widgetPath -Raw

  $widget = [regex]::Replace(
    $widget,
    "onClick=\{\(\)\s*=>\s*onClick\?\.\(\)\}",
    "onClick={() => { if (isEditing) onClick?.(); }}"
  )

  $widget = [regex]::Replace(
    $widget,
    "onClick=\{\(event\)\s*=>\s*\{\s*event\.stopPropagation\(\);\s*onClick\?\.\(\);\s*\}\}",
    "onClick={(event) => { event.stopPropagation(); if (isEditing) onClick?.(); }}"
  )

  Write-Utf8NoBom $widgetPath $widget
}

Write-Host "Dashboard Edit Mode Guard V8 applied."
Write-Host "Run: npm run build --workspace=apps/operator-console"
