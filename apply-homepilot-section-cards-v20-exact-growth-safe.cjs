// HomePilot Section Cards V20 - exact canvas growth + safe preview extras
// Run from repo root:
// node .\apply-homepilot-section-cards-v20-exact-growth-safe.cjs
//
// Fixes based on current file state:
// 1) DashboardCanvas was still forcing section layout to h: dashboardSectionRows.
//    This preserves/derives a taller h from section.config.extra.cards.
// 2) Some real widget previews still crashed reading ".percentage" because config.extra
//    could overwrite safe defaults. This makes safe defaults win.
// 3) Makes internal section rows slightly more compact but fully visible.

const fs = require("fs");

const canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx";
const sectionPath = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx";

let canvas = fs.readFileSync(canvasPath, "utf8");

// Patch the section layout function so it can receive a height.
canvas = canvas.replace(
  /function getDashboardSectionLayout\(sectionIndex: number, sectionCount: number\) \{/,
  "function getDashboardSectionLayout(sectionIndex: number, sectionCount: number, sectionHeight = dashboardSectionRows) {"
);

canvas = canvas.replace(
  /(\s+)h:\s*dashboardSectionRows,\s*(\n\s+\};\n\})/,
  "$1h: sectionHeight,$2"
);

// Replace the section mapping block exactly around current lines 111-118.
const oldBlock = `    const layout = getDashboardSectionLayout(sectionIndex, sectionCount);
    sectionIndex += 1;

    return {
      ...widget,
      config: {
        ...widget.config,
        layout,`;

const newBlock = `    const sectionCards = Array.isArray(widget.config.extra?.cards)
      ? widget.config.extra.cards
      : [];
    const internalItems = Math.max(1, sectionCards.length + 1);
    const internalRows = Math.ceil(internalItems / 2);
    const requestedHeight = Math.max(
      widget.config.layout?.h ?? dashboardSectionRows,
      dashboardSectionRows,
      1 + internalRows * 3,
    );
    const layout = getDashboardSectionLayout(sectionIndex, sectionCount, requestedHeight);
    sectionIndex += 1;

    return {
      ...widget,
      config: {
        ...widget.config,
        layout,`;

if (!canvas.includes(newBlock)) {
  if (!canvas.includes(oldBlock)) {
    throw new Error("Could not find the exact sanitizedWidgets section layout block in DashboardCanvas.tsx");
  }
  canvas = canvas.replace(oldBlock, newBlock);
}

fs.writeFileSync(canvasPath, canvas, "utf8");

let section = fs.readFileSync(sectionPath, "utf8");

// Keep helper height formula in sync.
section = section.replace(
  /function getRecommendedSectionHeight\(currentHeight: number, cardsCount: number\) \{[\s\S]*?\n\}/,
`function getRecommendedSectionHeight(currentHeight: number, cardsCount: number) {
  const internalItems = Math.max(1, cardsCount + 1);
  const internalRows = Math.ceil(internalItems / 2);
  const recommended = Math.max(4, 1 + internalRows * 3);
  return Math.max(currentHeight || 4, recommended);
}`
);

// Make rows match the section height formula better.
section = section.replace(/auto-rows-\[[^\]]+\]/g, "auto-rows-[10.5rem]");
section = section.replace(/min-h-\[[^\]]+\]/g, "min-h-[10.5rem]");

// If the current extra block spreads safe defaults first and config.extra later,
// config.extra can overwrite percentage-like fields with undefined.
// We replace the buildInternalConfig extra block with a defensive object where safe defaults win.
const extraStart = section.indexOf("    extra: {", section.indexOf("const buildInternalConfig"));
if (extraStart < 0) {
  throw new Error("Could not locate buildInternalConfig extra block start.");
}

let brace = section.indexOf("{", extraStart);
let depth = 0;
let extraEnd = -1;
for (let i = brace; i < section.length; i++) {
  if (section[i] === "{") depth++;
  if (section[i] === "}") depth--;
  if (depth === 0) {
    extraEnd = i + 1;
    break;
  }
}
if (extraEnd < 0) throw new Error("Could not locate buildInternalConfig extra block end.");

const safeExtra = `    extra: {
      ...config.extra,
      percentage: typeof config.extra?.percentage === 'number' ? config.extra.percentage : 64,
      value: typeof config.extra?.value === 'number' ? config.extra.value : 64,
      current: typeof config.extra?.current === 'number' ? config.extra.current : 64,
      total: typeof config.extra?.total === 'number' ? config.extra.total : 100,
      unit: config.extra?.unit || '%',
      status: config.extra?.status || 'preview',
      label: card.title,
      subtitle: card.entityName || card.description || '',
      cameraStatus: card.entityId ? 'live' : 'connecting',
      energy: {
        percentage: 64,
        current: 1.8,
        total: 3,
        unit: 'kW',
        ...(typeof config.extra?.energy === 'object' && config.extra.energy ? config.extra.energy : {}),
      },
      metrics: {
        percentage: 64,
        current: 1.8,
        total: 3,
        unit: 'kW',
        ...(typeof config.extra?.metrics === 'object' && config.extra.metrics ? config.extra.metrics : {}),
      },
      stats: {
        percentage: 64,
        active: 1,
        total: 7,
        ...(typeof config.extra?.stats === 'object' && config.extra.stats ? config.extra.stats : {}),
      },
      sectionCardId: card.id,
      sectionCardKind: card.kind,
      sectionCardPreview: true,
    }`;

section = section.slice(0, extraStart) + safeExtra + section.slice(extraEnd);

fs.writeFileSync(sectionPath, section, "utf8");

console.log("V20 exact section growth and safe preview extras applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
