// HomePilot Dashboard Sections V13 - hard align section + placeholder
// Run from repo root on Windows:
// node .\fix-homepilot-dashboard-sections-v13-align.cjs
//
// Fixes the visual desnivel:
// - Uses one shared section layout function for existing sections and add-section placeholder.
// - Forces section widgets and placeholder to the same y/height.
// - Adds consistent gutter.
// - Cleans old partial renderedWidgets/virtualPlaceholders blocks by replacing the whole layout block.

const fs = require("fs");

const path = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx";
let content = fs.readFileSync(path, "utf8");

function replaceBetween(content, startMarker, endMarker, replacement) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, Math.max(0, start));

  if (start < 0 || end <= start) {
    throw new Error(`Could not find block: ${startMarker} -> ${endMarker}`);
  }

  return content.slice(0, start) + replacement + content.slice(end);
}

// Make sure i18n hook exists if placeholders use t().
if (!content.includes("from 'react-i18next'")) {
  content = content.replace(
    "import { useState, useMemo, useRef, useCallback, useEffect } from 'react';",
    "import { useState, useMemo, useRef, useCallback, useEffect } from 'react';\nimport { useTranslation } from 'react-i18next';"
  );
}

if (!content.includes("const { t } = useTranslation();")) {
  content = content.replace(
    /export function DashboardCanvas\(([^\)]*)\)\s*\{/,
    (match) => `${match}\n  const { t } = useTranslation();`
  );
}

// Keep onAddCardClick quiet until the card catalog is wired back.
if (content.includes("onAddCardClick") && !content.includes("void onAddCardClick;")) {
  content = content.replace(
    "const { t } = useTranslation();",
    "const { t } = useTranslation();\n  void onAddCardClick;"
  );
}

// Replace everything from sanitizedWidgets through just before canvasMinRows.
// This avoids old leftover calculations causing y mismatch.
const layoutBlock = `const dashboardSectionStartY = 2;
const dashboardSectionRows = 2;

function getDashboardSectionLayout(sectionIndex: number, sectionCount: number) {
  const row = Math.floor(sectionIndex / 4);
  const indexInRow = sectionIndex % 4;
  const rowStart = row * 4;
  const itemsInRow = Math.min(4, Math.max(0, sectionCount - rowStart));
  const isLastRow = rowStart + itemsInRow >= sectionCount;
  const effectiveCount = isLastRow && itemsInRow < 4
    ? Math.min(4, itemsInRow + 1)
    : Math.max(1, itemsInRow);
  const width = Math.floor(12 / effectiveCount);

  return {
    x: indexInRow * width,
    y: dashboardSectionStartY + row * dashboardSectionRows,
    w: width,
    h: dashboardSectionRows,
  };
}

function getDashboardPlaceholderLayout(sectionCount: number) {
  if (sectionCount === 0) {
    return {
      x: 4,
      y: dashboardSectionStartY,
      w: 4,
      h: 1,
    };
  }

  const row = Math.floor(sectionCount / 4);
  const indexInRow = sectionCount % 4;
  const slotCount = indexInRow === 0 ? 1 : Math.min(4, indexInRow + 1);
  const width = Math.floor(12 / slotCount);

  return {
    x: indexInRow * width,
    y: dashboardSectionStartY + row * dashboardSectionRows,
    w: width,
    h: dashboardSectionRows,
  };
}

const sanitizedWidgets = useMemo(() => {
  const baseWidgets = widgets.map(sanitizeWidget);

  if (!isEditing) return baseWidgets;

  const sectionCount = baseWidgets.filter(widget => widget.type === 'section').length;

  const isBrokenSectionTitle = (value: unknown) =>
    typeof value === 'string' && /[\\u00c3\\u00c2\\u00e2\\u00c6\\u20ac]/.test(value);

  let sectionIndex = 0;

  return baseWidgets.map((widget) => {
    if (widget.type !== 'section') return widget;

    const layout = getDashboardSectionLayout(sectionIndex, sectionCount);
    sectionIndex += 1;

    return {
      ...widget,
      config: {
        ...widget.config,
        layout,
        appearance: {
          ...widget.config.appearance,
          title: isBrokenSectionTitle(widget.config.appearance?.title)
            ? t('dashboard.editor.sections.new_section')
            : widget.config.appearance?.title,
        },
      },
    };
  });
}, [widgets, isEditing, t]);

const renderedWidgets = sanitizedWidgets;

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

  const sectionPlaceholder = getDashboardPlaceholderLayout(sections.length);
  placeholders.push({
    key: 'add_section_final',
    ...sectionPlaceholder,
    type: 'add_section',
  });

  return placeholders;
}, [sanitizedWidgets, canEditLayout]);

`;

content = replaceBetween(
  content,
  "const sanitizedWidgets = useMemo",
  "const canvasMinRows",
  layoutBlock
);

// Ensure gutter constants are right after colWidth/rowHeight, or normalize existing values.
if (!content.includes("const dashboardItemInsetX")) {
  content = content.replace(
    /(const colWidth = [^;]+;\s*const rowHeight = [^;]+;)/,
    `$1
  const dashboardItemInsetX = 18;
  const dashboardItemInsetY = 12;`
  );
} else {
  content = content
    .replace(/const dashboardItemInset = \d+;\s*/g, "")
    .replace(/const dashboardItemInsetX = \d+;/g, "const dashboardItemInsetX = 18;")
    .replace(/const dashboardItemInsetY = \d+;/g, "const dashboardItemInsetY = 12;");
}

// Normalize all absolute item style formulas.
content = content
  .replace(/left:\s*([^,\n]+?)\s*\*\s*colWidth\s*\+\s*(?:8|4|dashboardItemInsetX),/g, "left: $1 * colWidth + dashboardItemInsetX,")
  .replace(/top:\s*([^,\n]+?)\s*\*\s*rowHeight\s*\+\s*(?:8|4|dashboardItemInsetY),/g, "top: $1 * rowHeight + dashboardItemInsetY,")
  .replace(/width:\s*([^,\n]+?)\s*\*\s*colWidth\s*-\s*(?:16|8|dashboardItemInsetX \* 2),/g, "width: $1 * colWidth - dashboardItemInsetX * 2,")
  .replace(/height:\s*([^,\n]+?)\s*\*\s*rowHeight\s*-\s*(?:16|8|dashboardItemInsetY \* 2),/g, "height: $1 * rowHeight - dashboardItemInsetY * 2,");

// Render block: keep add-section plus-only and aligned with same inset formula.
const placeholderRender = `{/* Home Assistant style virtual placeholders */}
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
  `${placeholderRender} `
);

fs.writeFileSync(path, content, "utf8");

console.log("Dashboard Sections V13 align fix applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
