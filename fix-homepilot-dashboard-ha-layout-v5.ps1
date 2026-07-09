# HomePilot Dashboard HA Layout V5 Fix
# Run from repo root on Windows:
# powershell -ExecutionPolicy Bypass -File .\fix-homepilot-dashboard-ha-layout-v5.ps1
#
# Fixes:
# 1) Rewrites new i18n keys using unicode escapes, so PowerShell/source encoding cannot corrupt them.
# 2) Ensures "Añadir título" calls handleAddWidget('dashboard_title').
# 3) Makes title/section placeholders more compact.
# 4) Keeps the top placeholder title-only. No badges/insignias.

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)][string]$Content
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and !(Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  $encoding = New-Object System.Text.UTF8Encoding($false)
  $fullPath = Join-Path (Resolve-Path -LiteralPath $directory).Path (Split-Path -Leaf $Path)
  [System.IO.File]::WriteAllText($fullPath, $Content, $encoding)
}

# ---------------------------------------------------------------------------
# 1) Fix i18n JSON with JS unicode escapes only
# ---------------------------------------------------------------------------
$nodeScript = @'
const fs = require('fs');

const updates = [
  {
    path: 'apps/operator-console/src/locales/es/common.json',
    sections: {
      add_title: 'A\u00f1adir t\u00edtulo',
      title_area: 'T\u00edtulo del tablero',
      title_placeholder: 'Hola Gustavo',
      subtitle_placeholder: 'A\u00f1ade tu texto aqu\u00ed, se admiten variables de plantilla \u2728',
      add_section: 'A\u00f1adir secci\u00f3n',
      new_section: 'Nueva secci\u00f3n',
      untitled_section: 'Secci\u00f3n sin t\u00edtulo',
      add_card: 'A\u00f1adir tarjeta',
    },
    catalog: {
      title: 'A\u00f1adir al panel de control',
      search: 'Buscar tarjetas',
      by_card: 'Por tarjeta',
      by_entity: 'Por entidad',
      other_cards: 'Otras tarjetas',
      device: 'Dispositivo',
      room: 'Habitaci\u00f3n',
      scene: 'Escena',
      camera: 'C\u00e1mara',
      light: 'Luz',
      cover: 'Cortina',
      clock: 'Reloj',
      energy: 'Energ\u00eda',
      system: 'Sistema',
      assistant: 'Asistente IA',
      section: 'Secci\u00f3n',
    },
  },
  {
    path: 'apps/operator-console/src/locales/en/common.json',
    sections: {
      add_title: 'Add title',
      title_area: 'Dashboard title',
      title_placeholder: 'Hello Gustavo',
      subtitle_placeholder: 'Add your text here. Template variables are supported \u2728',
      add_section: 'Add section',
      new_section: 'New section',
      untitled_section: 'Untitled section',
      add_card: 'Add card',
    },
    catalog: {
      title: 'Add to dashboard',
      search: 'Search cards',
      by_card: 'By card',
      by_entity: 'By entity',
      other_cards: 'Other cards',
      device: 'Device',
      room: 'Room',
      scene: 'Scene',
      camera: 'Camera',
      light: 'Light',
      cover: 'Cover',
      clock: 'Clock',
      energy: 'Energy',
      system: 'System',
      assistant: 'AI Assistant',
      section: 'Section',
    },
  },
];

for (const item of updates) {
  const json = JSON.parse(fs.readFileSync(item.path, 'utf8'));
  json.dashboard ??= {};
  json.dashboard.editor ??= {};
  json.dashboard.editor.sections = {
    ...(json.dashboard.editor.sections ?? {}),
    ...item.sections,
  };
  json.dashboard.editor.catalog = {
    ...(json.dashboard.editor.catalog ?? {}),
    ...item.catalog,
  };
  fs.writeFileSync(item.path, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}
'@

$nodeScriptPath = ".homepilot-fix-dashboard-i18n.cjs"
[System.IO.File]::WriteAllText((Resolve-Path ".").Path + [System.IO.Path]::DirectorySeparatorChar + $nodeScriptPath, $nodeScript, (New-Object System.Text.UTF8Encoding($false)))
node $nodeScriptPath
Remove-Item $nodeScriptPath -Force


# ---------------------------------------------------------------------------
# 2) DashboardTitleWidget: title only
# ---------------------------------------------------------------------------
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/DashboardTitleWidget.tsx" @'
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';

interface DashboardTitleWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function DashboardTitleWidget({ config, isEditing }: DashboardTitleWidgetProps) {
  const { t } = useTranslation();

  const title = config.appearance?.title?.trim();
  const subtitle = typeof config.extra?.subtitle === 'string' ? config.extra.subtitle.trim() : '';

  if (isEditing && !title && !subtitle) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] border-2 border-dashed border-border/60 bg-background/10 px-6 py-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-sm font-semibold text-primary">
          <span className="text-xl leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col items-center justify-center rounded-[1.35rem] border border-border/35 bg-background/10 px-[clamp(1rem,3cqi,2rem)] py-[clamp(0.85rem,1.8cqi,1.25rem)] text-center">
      {title ? (
        <h1 className="min-w-0 max-w-full truncate text-[clamp(1.35rem,3cqi,2.25rem)] font-black tracking-tight text-foreground">
          {title}
        </h1>
      ) : isEditing ? (
        <span className="text-sm font-semibold text-muted-foreground">
          {t('dashboard.editor.sections.title_area')}
        </span>
      ) : null}

      {subtitle ? (
        <p className="mt-2 min-w-0 max-w-3xl truncate text-[clamp(0.8rem,1.4cqi,0.95rem)] font-medium text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
'@

# ---------------------------------------------------------------------------
# 3) SectionWidget: smaller section block
# ---------------------------------------------------------------------------
Write-Utf8NoBom "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx" @'
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';

interface SectionWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

export function SectionWidget({ config, isEditing }: SectionWidgetProps) {
  const { t } = useTranslation();

  const title = config.appearance?.title || t('dashboard.editor.sections.new_section');
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
    <div className="group/section flex h-full w-full min-w-0 flex-col justify-between rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-[clamp(0.75rem,1.7cqi,1rem)] py-[clamp(0.65rem,1.35cqi,0.9rem)] text-left transition-all duration-200 hover:border-primary/70 hover:bg-primary/5">
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

      <div className="mt-2 inline-flex h-9 min-w-16 items-center justify-center self-start rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-primary transition-all duration-200 group-hover/section:bg-primary/10">
        <Plus className="h-4 w-4" />
      </div>
    </div>
  );
}
'@


# ---------------------------------------------------------------------------
# 4) DashboardCanvas: reliable import, t hook, compact title + section placeholders
# ---------------------------------------------------------------------------
$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"
$canvas = Get-Content $canvasPath -Raw

# Clean import shape
$canvas = $canvas -replace "import \{ useState, useMemo, useRef, useCallback, useEffect \} from 'react'; import \{ useTranslation \} from 'react-i18next';", "import { useState, useMemo, useRef, useCallback, useEffect } from 'react';`r`nimport { useTranslation } from 'react-i18next';"
if ($canvas -notmatch "from 'react-i18next'") {
  $canvas = $canvas -replace "import \{ useState, useMemo, useRef, useCallback, useEffect \} from 'react';", "import { useState, useMemo, useRef, useCallback, useEffect } from 'react';`r`nimport { useTranslation } from 'react-i18next';"
}

# Ensure t hook exists inside component
if ($canvas -notmatch "const \{ t \} = useTranslation\(\);") {
  $canvas = [regex]::Replace(
    $canvas,
    "(export function DashboardCanvas\([^\)]*\)\s*\{)",
    "`$1`r`n  const { t } = useTranslation();",
    1
  )
}

# Ensure prop interface and destructuring for title callback
if ($canvas -notmatch "onAddTitleClick\?:") {
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

# Replace virtual placeholder calculation completely
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
    placeholders.push({ key: 'add_title', x: 0, y: 0, w: 12, h: 1, type: 'add_title' });
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

# Replace render block
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
      className={cn(
        "absolute z-10 flex transition-all duration-200",
        isAddTitle
          ? "items-center justify-center rounded-[1.25rem] border-2 border-dashed border-border/60 bg-background/10 text-primary hover:border-primary/70 hover:bg-primary/5"
          : "flex-col justify-between rounded-[1.15rem] border-2 border-dashed border-border/70 bg-background/15 px-3.5 py-3 text-left hover:border-primary/70 hover:bg-primary/5"
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
        <>
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {t('dashboard.editor.sections.new_section')}
          </span>
          <span className="mt-2 inline-flex h-9 min-w-16 items-center justify-center self-start rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-4 text-xl font-light leading-none text-primary">
            +
          </span>
        </>
      )}
    </button>
  );
})}
'@

$canvas = $canvas.Substring(0, $startIndex) + $newRender + " " + $canvas.Substring($endIndex)

Write-Utf8NoBom $canvasPath $canvas


# ---------------------------------------------------------------------------
# 5) DashboardsView: title callback and compact y positions
# ---------------------------------------------------------------------------
$viewPath = "apps/operator-console/src/views/DashboardsView.tsx"
$view = Get-Content $viewPath -Raw

if ($view -notmatch "onAddTitleClick") {
  $view = $view -replace "onAddSectionClick=\{\(\) => \{ void handleAddWidget\('section'\); \}\}", "onAddSectionClick={() => { void handleAddWidget('section'); }} onAddTitleClick={() => { void handleAddWidget('dashboard_title'); }}"
}

# Fix handleAddWidget y positions if V4/V5 logic exists
$view = $view -replace "const sectionY = 3 \+ Math\.floor\(sectionSlot / 4\) \* 2;", "const sectionY = 2 + Math.floor(sectionSlot / 4) * 2;"
$view = $view -replace "const widgetY = isDashboardTitle \? 0 : isSection \? sectionY : Math\.max\(3, maxY\);", "const widgetY = isDashboardTitle ? 0 : isSection ? sectionY : Math.max(2, maxY);"

Write-Utf8NoBom $viewPath $view

Write-Host "Dashboard HA Layout V5 fix applied."
Write-Host "Run: npm run build --workspace=apps/operator-console"
