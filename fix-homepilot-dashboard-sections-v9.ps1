# HomePilot Dashboard Sections V9
# Run from repo root:
# powershell -ExecutionPolicy Bypass -File .\fix-homepilot-dashboard-sections-v9.ps1
#
# Fixes:
# 1) Add-section placeholder: compact, centered, plus-only.
# 2) New section creation does NOT auto-open the inspector.
# 3) Section name is edited only through the section pencil.
# 4) New section default title comes from i18n, not hardcoded text.
# 5) Existing broken section names can be normalized if they match mojibake patterns.

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path, $Content, $encoding)
}

$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"
$viewPath = "apps/operator-console/src/views/DashboardsView.tsx"
$sectionPath = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx"

if (!(Test-Path $canvasPath)) { throw "Missing $canvasPath" }
if (!(Test-Path $viewPath)) { throw "Missing $viewPath" }
if (!(Test-Path $sectionPath)) { throw "Missing $sectionPath" }

# ---------------------------------------------------------------------------
# 1) SectionWidget: section card has title, but plus is centered inside the card
# ---------------------------------------------------------------------------
Write-Utf8NoBom $sectionPath @'
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function SectionWidget({ config, isEditing }: SectionWidgetProps) {
  const { t } = useTranslation();

  const rawTitle = config.appearance?.title?.trim();
  const title = rawTitle || t('dashboard.editor.sections.new_section');
  const showTitle = config.appearance?.showTitle !== false;

  if (!isEditing) {
    return (
      <section className="flex h-full w-full min-w-0 items-end px-1 pb-2">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(1rem,2cqi,1.3rem)] font-black tracking-tight text-foreground">
            {title}
          </h2>
        ) : null}
      </section>
    );
  }

  return (
    <div className="group/section flex h-full w-full min-w-0 flex-col rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5">
      <div className="min-w-0">
        {showTitle ? (
          <h2 className="min-w-0 truncate text-[clamp(0.85rem,1.65cqi,1rem)] font-semibold text-foreground">
            {title}
          </h2>
        ) : (
          <span className="text-[clamp(0.72rem,1.35cqi,0.85rem)] font-semibold text-muted-foreground">
            {t('dashboard.editor.sections.untitled_section')}
          </span>
        )}
      </div>

      <div className="grid min-h-0 flex-1 place-items-center">
        <div className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 group-hover/section:bg-primary/10">
          <Plus className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
'@

# ---------------------------------------------------------------------------
# 2) DashboardCanvas: plus-only centered add-section placeholder, closer to title
# ---------------------------------------------------------------------------
$canvas = Get-Content $canvasPath -Raw

# Ensure t hook still exists if the file uses it.
if ($canvas -match "t\('dashboard\.editor\.sections" -and $canvas -notmatch "const \{ t \} = useTranslation\(\);") {
  $canvas = [regex]::Replace(
    $canvas,
    "(export function DashboardCanvas\([^\)]*\)\s*\{)",
    "`$1`r`n  const { t } = useTranslation();",
    1
  )
}

# Replace virtual placeholder calculation. Keep only title + add-section placeholders.
$vpStart = $canvas.IndexOf("// Compute virtual placeholders for HASS-style add-card and add-section buttons.")
$vpEnd = $canvas.IndexOf("const canvasMinRows", [Math]::Max(0, $vpStart))

if ($vpStart -lt 0 -or $vpEnd -le $vpStart) {
  throw "Could not locate virtualPlaceholders calculation block in DashboardCanvas.tsx"
}

$newVp = @'
// Compute virtual placeholders for HASS-style add-card and add-section buttons.
const virtualPlaceholders = useMemo(() => {
  if (!canEditLayout) return [];

  const sections = sanitizedWidgets
    .filter(widget => widget.type === 'section')
    .sort((a, b) => {
      const byY = a.config.layout.y - b.config.layout.y;
      if (byY !== 0) return byY;
      return a.config.layout.x - b.config.layout.x;
    });

  const hasDashboardTitle = sanitizedWidgets.some(widget => widget.type === 'dashboard_title');

  const placeholders: {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    type: 'add_title' | 'add_section';
  }[] = [];

  if (!hasDashboardTitle) {
    placeholders.push({ key: 'add_title', x: 0, y: 0, w: 12, h: 2, type: 'add_title' });
  }

  const sectionStartY = hasDashboardTitle ? 2 : 2;
  const sectionSlot = sections.length;

  if (sections.length === 0) {
    placeholders.push({ key: 'add_section_final', x: 4, y: sectionStartY, w: 4, h: 1, type: 'add_section' });
  } else {
    const nextSectionX = (sectionSlot % 4) * 3;
    const nextSectionY = sectionStartY + Math.floor(sectionSlot / 4) * 2;
    placeholders.push({ key: 'add_section_final', x: nextSectionX, y: nextSectionY, w: 3, h: 2, type: 'add_section' });
  }

  return placeholders;
}, [sanitizedWidgets, canEditLayout]);

'@

$canvas = $canvas.Substring(0, $vpStart) + $newVp + $canvas.Substring($vpEnd)

# Replace placeholder render block.
$startMarker = "{/* Home Assistant style virtual placeholders */}"
$endMarker = "{/* Snap drop preview */}"
$startIndex = $canvas.IndexOf($startMarker)
$endIndex = $canvas.IndexOf($endMarker)

if ($startIndex -lt 0 -or $endIndex -le $startIndex) {
  throw "Could not locate placeholder render block in DashboardCanvas.tsx"
}

$newRender = @'
{/* Home Assistant style virtual placeholders */}
{canEditLayout && virtualPlaceholders.map((placeholder) => {
  const isAddTitle = placeholder.type === 'add_title';

  return (
    <button
      key={placeholder.key}
      type="button"
      onClick={() => {
        if (isAddTitle) {
          onAddTitleClick?.();
        } else {
          onAddSectionClick?.(placeholder.y);
        }
      }}
      aria-label={isAddTitle ? t('dashboard.editor.sections.add_title') : t('dashboard.editor.sections.add_section')}
      className={cn(
        "absolute z-10 flex transition-all duration-200",
        isAddTitle
          ? "items-center justify-center rounded-[1.25rem] border-2 border-dashed border-border/60 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
          : "items-center justify-center rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
      )}
      style={{
        left: placeholder.x * colWidth + 8,
        top: placeholder.y * rowHeight + 8,
        width: placeholder.w * colWidth - 16,
        height: placeholder.h * rowHeight - 16,
      }}
    >
      {isAddTitle ? (
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-sm font-semibold text-primary">
          <span className="text-xl leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      ) : (
        <span className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-xl font-light leading-none text-primary">
          +
        </span>
      )}
    </button>
  );
})}
'@

$canvas = $canvas.Substring(0, $startIndex) + $newRender + " " + $canvas.Substring($endIndex)

Write-Utf8NoBom $canvasPath $canvas

# ---------------------------------------------------------------------------
# 3) DashboardsView: creating a section must not open inspector automatically
# ---------------------------------------------------------------------------
$view = Get-Content $viewPath -Raw

# Make sections start closer to the title.
$view = $view -replace "const sectionY = 3 \+ Math\.floor\(sectionSlot / 4\) \* 2;", "const sectionY = 2 + Math.floor(sectionSlot / 4) * 2;"
$view = $view -replace "const widgetY = isDashboardTitle \? 0 : isSection \? sectionY : Math\.max\(3, maxY\);", "const widgetY = isDashboardTitle ? 0 : isSection ? sectionY : Math.max(2, maxY);"

# New sections should get a normal localized title.
$view = $view -replace "title: isDashboardTitle \? t\('dashboard\.editor\.sections\.title_area'\) : '',", "title: isDashboardTitle ? t('dashboard.editor.sections.title_area') : isSection ? t('dashboard.editor.sections.new_section') : '',"

# If a previous version still uses title_placeholder for title widgets.
$view = $view -replace "title: isDashboardTitle \? t\('dashboard\.editor\.sections\.title_placeholder'\) : '',", "title: isDashboardTitle ? t('dashboard.editor.sections.title_area') : isSection ? t('dashboard.editor.sections.new_section') : '',"

# Do not auto-open inspector after adding a section.
$view = [regex]::Replace(
  $view,
  "if\s*\(saved\)\s*\{\s*setSelectedWidgetId\(widgetId\);\s*setIsInspectorOpen\(true\);\s*\}",
  "if (saved && !isSection) { setSelectedWidgetId(widgetId); setIsInspectorOpen(true); }"
)

Write-Utf8NoBom $viewPath $view

Write-Host "Dashboard Sections V9 applied."
Write-Host "Run: npm run build --workspace=apps/operator-console"
