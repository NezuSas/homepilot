# HomePilot Dashboard Sections V3C
# Run from repo root on Windows:
# powershell -ExecutionPolicy Bypass -File .\apply-homepilot-dashboard-sections-v3c.ps1
#
# Replaces the full handleAddWidget function instead of matching a tiny segment.
# This avoids failing on compact/one-line formatting.

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path, $Content, $encoding)
}

$viewPath = "apps/operator-console/src/views/DashboardsView.tsx"
$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"

if (!(Test-Path $viewPath)) { throw "DashboardsView.tsx not found" }
if (!(Test-Path $canvasPath)) { throw "DashboardCanvas.tsx not found" }

# ---------------------------------------------------------------------------
# 1) Replace full handleAddWidget in DashboardsView
# ---------------------------------------------------------------------------
$view = Get-Content $viewPath -Raw

$newHandleAddWidget = @'
const handleAddWidget = async (type: WidgetType, size?: { w: number; h: number }) => {
    if (!active || active.tabs.length === 0) return;

    const currentTab = active.tabs[activeTabIdx];
    const maxY = currentTab.widgets.reduce(
      (max, widget) => Math.max(max, widget.config.layout.y + widget.config.layout.h),
      0,
    );

    const sectionWidgets = currentTab.widgets.filter(widget => widget.type === 'section');
    const sectionSlot = sectionWidgets.length;

    const isSection = type === 'section';
    const sectionX = (sectionSlot % 4) * 3;
    const sectionBaseY =
      sectionWidgets.length > 0
        ? Math.min(...sectionWidgets.map(section => section.config.layout.y))
        : maxY;

    const sectionY = sectionBaseY + Math.floor(sectionSlot / 4) * 2;

    const widgetW = isSection ? 3 : (size?.w ?? 4);
    const widgetH = isSection ? 2 : (size?.h ?? 4);
    const widgetX = isSection ? sectionX : 0;
    const widgetY = isSection ? sectionY : maxY;

    const defaultConfig: DashboardWidgetConfig = {
      layout: { x: widgetX, y: widgetY, w: widgetW, h: widgetH },
      binding: { entityId: '', entityType: 'device' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: { variant: 'glass', title: '', showTitle: true },
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
$replacement = $newHandleAddWidget + " const handleLayoutChange"

$updatedView = [regex]::Replace(
  $view,
  $pattern,
  $replacement,
  [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($updatedView -eq $view) {
  throw "Could not replace handleAddWidget. Please paste the handleAddWidget block."
}

Write-Utf8NoBom $viewPath $updatedView


# ---------------------------------------------------------------------------
# 2) DashboardCanvas placeholders
# ---------------------------------------------------------------------------
$canvas = Get-Content $canvasPath -Raw

# The failed V3/V3B may have partially replaced this block already; replace render block again if markers exist.
$startMarker = "{/* Home Assistant style virtual placeholders */}"
$endMarker = "{/* Snap drop preview */}"
$startIndex = $canvas.IndexOf($startMarker)
$endIndex = $canvas.IndexOf($endMarker)

if ($startIndex -lt 0 -or $endIndex -le $startIndex) {
  throw "Could not locate placeholder render block in DashboardCanvas.tsx"
}

$newPlaceholderRender = @'
{/* Home Assistant style virtual placeholders */}
{canEditLayout && virtualPlaceholders.map((placeholder) => {
  const isAddCard = placeholder.type === 'add_card';

  return (
    <button
      key={placeholder.key}
      type="button"
      onClick={() => {
        if (isAddCard) {
          onAddCardClick?.(placeholder.x, placeholder.y);
        } else {
          onAddSectionClick?.(placeholder.y);
        }
      }}
      className={cn(
        "absolute z-10 flex transition-all duration-200",
        isAddCard
          ? "items-center justify-center rounded-2xl border-2 border-dashed border-primary/75 bg-background/20 text-primary hover:border-primary hover:bg-primary/10"
          : "flex-col justify-between rounded-[1.35rem] border-2 border-dashed border-border/70 bg-background/15 px-4 py-3 text-left hover:border-primary/70 hover:bg-primary/5"
      )}
      style={{
        left: placeholder.x * colWidth + 8,
        top: placeholder.y * rowHeight + 8,
        width: placeholder.w * colWidth - 16,
        height: placeholder.h * rowHeight - 16,
      }}
    >
      {isAddCard ? (
        <span className="inline-flex h-11 min-w-20 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 text-2xl font-light leading-none text-primary">
          +
        </span>
      ) : (
        <>
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            Nueva sección
          </span>
          <span className="mt-3 inline-flex h-10 min-w-16 items-center justify-center self-start rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-xl font-light leading-none text-primary">
            +
          </span>
        </>
      )}
    </button>
  );
})}
'@

$canvas = $canvas.Substring(0, $startIndex) + $newPlaceholderRender + " " + $canvas.Substring($endIndex)

# Placeholders compact dimensions. These replacements tolerate prior partial changes.
$canvas = [regex]::Replace(
  $canvas,
  "placeholders\.push\(\{ key: 'add_card_root', x: \d+, y: bottomY, w: \d+, h: \d+, type: 'add_card' \}\);",
  "placeholders.push({ key: 'add_card_root', x: 4, y: bottomY, w: 4, h: 1, type: 'add_card' });"
)

$canvas = [regex]::Replace(
  $canvas,
  "placeholders\.push\(\{ key: 'add_card_pre', x: \d+, y: bottomY, w: \d+, h: \d+, type: 'add_card' \}\);",
  "placeholders.push({ key: 'add_card_pre', x: 4, y: bottomY, w: 4, h: 1, type: 'add_card' });"
)

$canvas = [regex]::Replace(
  $canvas,
  "placeholders\.push\(\{ key: `add_card_\$\{section\.id\}`, x: \d+, y: bottomY, w: \d+, h: \d+, type: 'add_card' \}\);",
  "placeholders.push({ key: `add_card_${section.id}`, x: 4, y: bottomY, w: 4, h: 1, type: 'add_card' });"
)

# Add-section final placeholder calculation. Replace only the push if full calculation cannot be found.
$canvas = [regex]::Replace(
  $canvas,
  "placeholders\.push\(\{ key: 'add_section_final', x: \d+, y: [^,]+, w: \d+, h: \d+, type: 'add_section' \}\);",
  "const sectionSlot = sections.length; const sectionX = (sectionSlot % 4) * 3; const sectionBaseY = sections.length > 0 ? Math.min(...sections.map(section => section.config.layout.y)) : absoluteMaxY + (placeholders.length > 0 ? 2 : 1); const sectionY = sectionBaseY + Math.floor(sectionSlot / 4) * 2; placeholders.push({ key: 'add_section_final', x: sectionX, y: sectionY, w: 3, h: 2, type: 'add_section' });"
)

Write-Utf8NoBom $canvasPath $canvas

Write-Host "Dashboard Sections V3C applied."
Write-Host "Run: npm run build --workspace=apps/operator-console"
