// HomePilot Dashboard Sections V14 - align placeholder to the actual section row
// Run from repo root on Windows:
// node .\fix-homepilot-dashboard-sections-v14-row-align.cjs
//
// This fixes the remaining vertical misalignment by deriving the placeholder
// row directly from the already-rendered section widgets instead of calculating
// an independent y value.

const fs = require("fs");

const path = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx";
let content = fs.readFileSync(path, "utf8");

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, Math.max(0, start));

  if (start < 0 || end <= start) {
    throw new Error(`Could not locate block: ${startMarker} -> ${endMarker}`);
  }

  return source.slice(0, start) + replacement + source.slice(end);
}

const newVirtualPlaceholders = `// Compute virtual placeholders for HASS-style add-card and add-section buttons.
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

  if (sections.length === 0) {
    placeholders.push({
      key: 'add_section_final',
      x: 4,
      y: 2,
      w: 4,
      h: 1,
      type: 'add_section',
    });

    return placeholders;
  }

  const lastRowIndex = Math.floor(sections.length / 4);
  const sectionsInCurrentRow = sections.length % 4;

  if (sectionsInCurrentRow === 0) {
    placeholders.push({
      key: 'add_section_final',
      x: 0,
      y: 2 + lastRowIndex * 2,
      w: 12,
      h: 1,
      type: 'add_section',
    });

    return placeholders;
  }

  const currentRowStart = lastRowIndex * 4;
  const currentRowSections = sections.slice(currentRowStart);
  const rowY = currentRowSections[0]?.config.layout.y ?? 2;
  const rowH = currentRowSections[0]?.config.layout.h ?? 2;

  const slotCount = Math.min(4, sectionsInCurrentRow + 1);
  const slotW = Math.floor(12 / slotCount);

  placeholders.push({
    key: 'add_section_final',
    x: sectionsInCurrentRow * slotW,
    y: rowY,
    w: slotW,
    h: rowH,
    type: 'add_section',
  });

  return placeholders;
}, [sanitizedWidgets, canEditLayout]);

`;

content = replaceBetween(
  content,
  "// Compute virtual placeholders for HASS-style add-card and add-section buttons.",
  "const canvasMinRows",
  newVirtualPlaceholders
);

// Normalize placeholder style once more so it uses the same visual inset.
const newPlaceholderRender = `{/* Home Assistant style virtual placeholders */}
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
        left: placeholder.x * colWidth + dashboardItemInsetX,
        top: placeholder.y * rowHeight + dashboardItemInsetY,
        width: placeholder.w * colWidth - dashboardItemInsetX * 2,
        height: placeholder.h * rowHeight - dashboardItemInsetY * 2,
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
`;

content = replaceBetween(
  content,
  "{/* Home Assistant style virtual placeholders */}",
  "{/* Snap drop preview */}",
  `${newPlaceholderRender} `
);

fs.writeFileSync(path, content, "utf8");

console.log("Dashboard Sections V14 row align fix applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
