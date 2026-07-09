# HomePilot Dashboard Title Click V6B
# Run from repo root on Windows:
# powershell -ExecutionPolicy Bypass -File .\fix-homepilot-dashboard-title-click-v6b.ps1
#
# Fixes the PowerShell Regex overload issue from V6.
# Also guarantees:
# - DashboardCanvas has onAddTitleClick prop/destructuring
# - Add title placeholder calls onAddTitleClick
# - DashboardsView passes onAddTitleClick to DashboardCanvas
# - handleAddWidget supports dashboard_title

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path, $Content, $encoding)
}

$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"
$viewPath = "apps/operator-console/src/views/DashboardsView.tsx"
$widgetPath = "apps/operator-console/src/views/dashboards/DashboardWidget.tsx"

if (!(Test-Path $canvasPath)) { throw "Missing $canvasPath" }
if (!(Test-Path $viewPath)) { throw "Missing $viewPath" }
if (!(Test-Path $widgetPath)) { throw "Missing $widgetPath" }

# ---------------------------------------------------------------------------
# 1) DashboardCanvas
# ---------------------------------------------------------------------------
$canvas = Get-Content $canvasPath -Raw

$canvas = $canvas -replace "import \{ useState, useMemo, useRef, useCallback, useEffect \} from 'react'; import \{ useTranslation \} from 'react-i18next';", "import { useState, useMemo, useRef, useCallback, useEffect } from 'react';`r`nimport { useTranslation } from 'react-i18next';"

if ($canvas -notmatch "from 'react-i18next'") {
  $canvas = $canvas -replace "import \{ useState, useMemo, useRef, useCallback, useEffect \} from 'react';", "import { useState, useMemo, useRef, useCallback, useEffect } from 'react';`r`nimport { useTranslation } from 'react-i18next';"
}

if ($canvas -notmatch "onAddTitleClick\?:\s*\(\)\s*=>\s*void") {
  $canvas = [regex]::Replace(
    $canvas,
    "(onAddSectionClick\?:\s*\(y:\s*number\)\s*=>\s*void;)",
    "`$1`r`n  onAddTitleClick?: () => void;",
    1
  )
}

if ($canvas -notmatch "onAddTitleClick\s*\}: DashboardCanvasProps") {
  $canvas = [regex]::Replace(
    $canvas,
    "onAddCardClick,\s*onAddSectionClick\s*\}: DashboardCanvasProps",
    "onAddCardClick, onAddSectionClick, onAddTitleClick }: DashboardCanvasProps",
    1
  )
}

if ($canvas -notmatch "const \{ t \} = useTranslation\(\);") {
  $canvas = [regex]::Replace(
    $canvas,
    "(export function DashboardCanvas\([^\)]*\)\s*\{)",
    "`$1`r`n  const { t } = useTranslation();",
    1
  )
}

if ($canvas -match "onAddCardClick" -and $canvas -notmatch "void onAddCardClick;") {
  $canvas = [regex]::Replace(
    $canvas,
    "(const \{ t \} = useTranslation\(\);)",
    "`$1`r`n  void onAddCardClick;",
    1
  )
}

# Force title placeholder click branch to call the correct callback.
$canvas = [regex]::Replace(
  $canvas,
  "if\s*\(isAddTitle\)\s*\{\s*onAddSectionClick\?\.\(placeholder\.y\);\s*\}",
  "if (isAddTitle) { onAddTitleClick?.(); }"
)

Write-Utf8NoBom $canvasPath $canvas


# ---------------------------------------------------------------------------
# 2) DashboardWidget
# ---------------------------------------------------------------------------
$widget = Get-Content $widgetPath -Raw

if ($widget -notmatch "DashboardTitleWidget") {
  $widget = $widget -replace "import \{ SectionWidget \} from './widgets/SectionWidget';", "import { SectionWidget } from './widgets/SectionWidget';`r`nimport { DashboardTitleWidget } from './widgets/DashboardTitleWidget';"
}

if ($widget -notmatch "case 'dashboard_title'") {
  $widget = [regex]::Replace(
    $widget,
    "(case\s+'section'\s*:\s*return\s+<SectionWidget[^;]+;)",
    "case 'dashboard_title': return <DashboardTitleWidget config={widget.config} isEditing={isEditing} />; `$1",
    1
  )
}

Write-Utf8NoBom $widgetPath $widget


# ---------------------------------------------------------------------------
# 3) DashboardsView
# ---------------------------------------------------------------------------
$view = Get-Content $viewPath -Raw

$newHandle = @'
const handleAddWidget = async (type: WidgetType, size?: { w: number; h: number }) => {
    if (!active || active.tabs.length === 0) return;

    const currentTab = active.tabs[activeTabIdx];

    const maxY = currentTab.widgets.reduce(
      (max, widget) => Math.max(max, widget.config.layout.y + widget.config.layout.h),
      0,
    );

    const isDashboardTitle = type === 'dashboard_title';
    const isSection = type === 'section';

    const existingTitle = currentTab.widgets.find(widget => widget.type === 'dashboard_title');
    if (isDashboardTitle && existingTitle) {
      setSelectedWidgetId(existingTitle.id);
      setIsInspectorOpen(true);
      return;
    }

    const sectionWidgets = currentTab.widgets.filter(widget => widget.type === 'section');
    const sectionSlot = sectionWidgets.length;

    const sectionX = (sectionSlot % 4) * 3;
    const sectionY = 2 + Math.floor(sectionSlot / 4) * 2;

    const widgetW = isDashboardTitle ? 12 : isSection ? 3 : (size?.w ?? 4);
    const widgetH = isDashboardTitle ? 1 : isSection ? 2 : (size?.h ?? 4);
    const widgetX = isDashboardTitle ? 0 : isSection ? sectionX : 0;
    const widgetY = isDashboardTitle ? 0 : isSection ? sectionY : Math.max(2, maxY);

    const defaultConfig: DashboardWidgetConfig = {
      layout: { x: widgetX, y: widgetY, w: widgetW, h: widgetH },
      binding: { entityId: '', entityType: 'system' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: {
        variant: 'glass',
        title: isDashboardTitle ? t('dashboard.editor.sections.title_placeholder') : '',
        showTitle: true,
      },
      extra: isDashboardTitle
        ? { subtitle: t('dashboard.editor.sections.subtitle_placeholder') }
        : {},
    };

    const widgetId = generateId();

    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx
        ? tab
        : { ...tab, widgets: [...tab.widgets, { id: widgetId, type, config: defaultConfig }] },
    );

    const saved = await patch(active.id, { tabs: updatedTabs });

    if (saved) {
      setSelectedWidgetId(widgetId);
      setIsInspectorOpen(true);
    }
  };
'@

$pattern = "const handleAddWidget = async \(type: WidgetType, size\?: \{ w: number; h: number \}\) => \{.*?\};\s*const handleLayoutChange"
$view2 = [regex]::Replace(
  $view,
  $pattern,
  $newHandle + " const handleLayoutChange",
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($view2 -eq $view) {
  throw "Could not replace handleAddWidget in DashboardsView.tsx. Paste that function if this fails."
}
$view = $view2

# Direct and safe injection of onAddTitleClick into DashboardCanvas usage.
if ($view -notmatch "onAddTitleClick") {
  $view = $view -replace "onAddSectionClick=\{\(\) => \{ void handleAddWidget\('section'\); \}\}", "onAddSectionClick={() => { void handleAddWidget('section'); }} onAddTitleClick={() => { void handleAddWidget('dashboard_title'); }}"
}

# Fallback: inject before selectedWidgetId within the DashboardCanvas tag.
if ($view -notmatch "onAddTitleClick") {
  $rx = [regex]::new("(<DashboardCanvas\b(?:(?!/>).)*?)(selectedWidgetId=)", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  $view = $rx.Replace(
    $view,
    "`$1onAddTitleClick={() => { void handleAddWidget('dashboard_title'); }} `$2",
    1
  )
}

if ($view -notmatch "onAddTitleClick") {
  throw "Could not inject onAddTitleClick into DashboardCanvas usage."
}

Write-Utf8NoBom $viewPath $view

Write-Host "Dashboard title click V6B fix applied."
Write-Host "Run: npm run build --workspace=apps/operator-console"
