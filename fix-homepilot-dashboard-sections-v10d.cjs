// HomePilot Dashboard Sections V10D
// Run from repo root on Windows:
// node .\fix-homepilot-dashboard-sections-v10d.cjs
//
// This version does NOT insert helper functions at top level.
// It rewrites handleAddWidget with local helpers inside the function,
// so it works even if DashboardsView.tsx is compacted or generateId moved.

const fs = require("fs");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceBetween(content, startMarker, endMarker, replacement, fileName) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, Math.max(0, start));

  if (start < 0 || end <= start) {
    throw new Error(`Could not locate block in ${fileName}: ${startMarker} -> ${endMarker}`);
  }

  return content.slice(0, start) + replacement + content.slice(end);
}

// ---------------------------------------------------------------------------
// 1) i18n keys
// ---------------------------------------------------------------------------
const localeUpdates = [
  {
    path: "apps/operator-console/src/locales/es/common.json",
    sections: {
      add_title: "A\u00f1adir t\u00edtulo",
      title_area: "T\u00edtulo del tablero",
      title_placeholder: "Hola {{ user }}",
      subtitle_placeholder: "A\u00f1ade tu texto aqu\u00ed, se admiten variables de plantilla \u2728",
      title_markdown: "Contenido Markdown",
      title_alignment: "Alineaci\u00f3n",
      align_left: "Izquierda",
      align_center: "Centro",
      align_right: "Derecha",
      add_section: "A\u00f1adir secci\u00f3n",
      new_section: "Nueva secci\u00f3n",
      untitled_section: "Secci\u00f3n sin t\u00edtulo",
      section_title: "T\u00edtulo de secci\u00f3n",
      section_title_placeholder: "Mi secci\u00f3n",
      add_card: "A\u00f1adir tarjeta"
    }
  },
  {
    path: "apps/operator-console/src/locales/en/common.json",
    sections: {
      add_title: "Add title",
      title_area: "Dashboard title",
      title_placeholder: "Hello {{ user }}",
      subtitle_placeholder: "Add your text here. Template variables are supported \u2728",
      title_markdown: "Markdown content",
      title_alignment: "Alignment",
      align_left: "Left",
      align_center: "Center",
      align_right: "Right",
      add_section: "Add section",
      new_section: "New section",
      untitled_section: "Untitled section",
      section_title: "Section title",
      section_title_placeholder: "My section",
      add_card: "Add card"
    }
  }
];

for (const item of localeUpdates) {
  const json = JSON.parse(read(item.path));
  json.dashboard ??= {};
  json.dashboard.editor ??= {};
  json.dashboard.editor.sections = {
    ...(json.dashboard.editor.sections ?? {}),
    ...item.sections
  };
  write(item.path, `${JSON.stringify(json, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// 2) DashboardCanvas: proportional section placeholder + plus-only
// ---------------------------------------------------------------------------
const canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx";
let canvas = read(canvasPath);

if (canvas.includes("t('dashboard.editor.sections") && !canvas.includes("const { t } = useTranslation();")) {
  canvas = canvas.replace(
    /export function DashboardCanvas\(([^\)]*)\)\s*\{/,
    (match) => `${match}\n  const { t } = useTranslation();`
  );
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

  const sectionStartY = hasDashboardTitle ? 2 : 2;
  const sectionsInCurrentRow = sections.length % 4;
  const completedRows = Math.floor(sections.length / 4);

  if (sections.length === 0) {
    placeholders.push({ key: 'add_section_final', x: 4, y: sectionStartY, w: 4, h: 1, type: 'add_section' });
  } else {
    const slotCount = sectionsInCurrentRow === 0 ? 1 : Math.min(4, sectionsInCurrentRow + 1);
    const slotW = Math.floor(12 / slotCount);
    const placeholderSlot = sectionsInCurrentRow === 0 ? 0 : sectionsInCurrentRow;
    const placeholderY = sectionStartY + completedRows * 2;

    placeholders.push({
      key: 'add_section_final',
      x: placeholderSlot * slotW,
      y: placeholderY,
      w: slotW,
      h: 2,
      type: 'add_section',
    });
  }

  return placeholders;
}, [sanitizedWidgets, canEditLayout]);

`;

canvas = replaceBetween(
  canvas,
  "// Compute virtual placeholders for HASS-style add-card and add-section buttons.",
  "const canvasMinRows",
  newVirtualPlaceholders,
  canvasPath
);

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
`;

canvas = replaceBetween(
  canvas,
  "{/* Home Assistant style virtual placeholders */}",
  "{/* Snap drop preview */}",
  `${newPlaceholderRender} `,
  canvasPath
);

write(canvasPath, canvas);

// ---------------------------------------------------------------------------
// 3) DashboardsView: replace handleAddWidget only
// ---------------------------------------------------------------------------
const viewPath = "apps/operator-console/src/views/DashboardsView.tsx";
let view = read(viewPath);

const handleStart = view.indexOf("const handleAddWidget = async");
const handleEnd = view.indexOf("const handleLayoutChange", Math.max(0, handleStart));

if (handleStart < 0 || handleEnd <= handleStart) {
  throw new Error("Could not locate handleAddWidget -> handleLayoutChange block in DashboardsView.tsx");
}

const newHandleAddWidget = `const handleAddWidget = async (type: WidgetType, size?: { w: number; h: number }) => {
    if (!active || active.tabs.length === 0) return;

    const currentTab = active.tabs[activeTabIdx];

    const getSectionLayout = (sectionIndex: number) => {
      const row = Math.floor(sectionIndex / 4);
      const indexInRow = sectionIndex % 4;
      const rowItemCount = indexInRow + 1;
      const width = Math.floor(12 / rowItemCount);

      return {
        x: indexInRow * width,
        y: 2 + row * 2,
        w: width,
        h: 2,
      };
    };

    const isBrokenSectionTitle = (value: unknown) =>
      typeof value === 'string' && /[\\u00c3\\u00c2\\u00e2\\u00c6\\u20ac]/.test(value);

    const normalizeSectionWidgets = (widgets: typeof currentTab.widgets) => {
      let sectionIndex = 0;

      return widgets.map((widget) => {
        if (widget.type !== 'section') return widget;

        const layout = getSectionLayout(sectionIndex);
        sectionIndex += 1;

        const title = isBrokenSectionTitle(widget.config.appearance?.title)
          ? t('dashboard.editor.sections.new_section')
          : widget.config.appearance?.title;

        return {
          ...widget,
          config: {
            ...widget.config,
            layout,
            appearance: {
              ...widget.config.appearance,
              title,
            },
          },
        };
      });
    };

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
    const sectionLayout = getSectionLayout(sectionWidgets.length);

    const widgetW = isDashboardTitle ? 12 : isSection ? sectionLayout.w : (size?.w ?? 4);
    const widgetH = isDashboardTitle ? 2 : isSection ? sectionLayout.h : (size?.h ?? 4);
    const widgetX = isDashboardTitle ? 0 : isSection ? sectionLayout.x : 0;
    const widgetY = isDashboardTitle ? 0 : isSection ? sectionLayout.y : Math.max(2, maxY);

    const defaultConfig: DashboardWidgetConfig = {
      layout: { x: widgetX, y: widgetY, w: widgetW, h: widgetH },
      binding: { entityId: '', entityType: 'system' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: {
        variant: 'glass',
        title: isDashboardTitle
          ? t('dashboard.editor.sections.title_area')
          : isSection
            ? t('dashboard.editor.sections.new_section')
            : '',
        showTitle: true,
      },
      extra: isDashboardTitle
        ? {
            markdown: \`# \${t('dashboard.editor.sections.title_placeholder')}\\n\${t('dashboard.editor.sections.subtitle_placeholder')}\`,
            align: 'center',
          }
        : {},
    };

    const widgetId = generateId();

    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx
        ? tab
        : {
            ...tab,
            widgets: normalizeSectionWidgets([
              ...tab.widgets,
              { id: widgetId, type, config: defaultConfig },
            ]),
          },
    );

    const saved = await patch(active.id, { tabs: updatedTabs });

    if (saved && !isSection) {
      setSelectedWidgetId(widgetId);
      setIsInspectorOpen(true);
    }
  };

`;

view = view.slice(0, handleStart) + newHandleAddWidget + view.slice(handleEnd);
write(viewPath, view);

// ---------------------------------------------------------------------------
// 4) WidgetInspector: placeholder from i18n
// ---------------------------------------------------------------------------
const inspectorPath = "apps/operator-console/src/views/dashboards/WidgetInspector.tsx";
let inspector = read(inspectorPath);

if (!inspector.includes("const isDashboardTitle =")) {
  inspector = inspector.replace(
    /(const\s+isSection\s*=\s*safeWidget\.type\s*===\s*'section';)/,
    "$1\n  const isDashboardTitle = safeWidget.type === 'dashboard_title';"
  );
}

// Replace any "Mi Secci..." placeholder with i18n without hardcoding accented text here.
inspector = inspector.replace(
  /placeholder=\{?['"][^'"]*Mi Secci[^'"]*['"]\}?/g,
  "placeholder={t('dashboard.editor.sections.section_title_placeholder')}"
);

write(inspectorPath, inspector);

console.log("Dashboard Sections V10D applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
