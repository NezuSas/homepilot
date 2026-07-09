// HomePilot Section Cards V22 incremental UX patch
// Run from repo root:
// node .\apply-homepilot-section-cards-v22-ux.cjs
//
// Fixes:
// - Removes hardcoded Gustavo fallback for {{ user }}.
// - Makes section card clicks internal only.
// - Adds card sizes: small/medium/full.
// - Replaces generic clock with 4 clock variants in the catalog.
// - Editor preview uses the selected title.

const fs = require("fs");

const sectionPath = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx";
const titlePath = "apps/operator-console/src/views/dashboards/widgets/DashboardTitleWidget.tsx";
const widgetPath = "apps/operator-console/src/views/dashboards/DashboardWidget.tsx";
const localePaths = [
  "apps/operator-console/src/locales/es/common.json",
  "apps/operator-console/src/locales/en/common.json",
];

function write(path, data) {
  fs.writeFileSync(path, data, "utf8");
}

function replaceFunction(source, name, replacement) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`No function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(0, start) + replacement + source.slice(i + 1);
  }
  throw new Error(`No end for ${name}`);
}

function patchLocales() {
  const es = {
    section_card_clock_digital: "Reloj digital",
    section_card_clock_digital_desc: "Tarjeta de hora digital amplia para el tablero.",
    section_card_clock_analog: "Reloj analógico",
    section_card_clock_analog_desc: "Reloj con esfera analógica y datos contextuales.",
    section_card_clock_premium: "Reloj premium",
    section_card_clock_premium_desc: "Reloj grande con estilo residencial premium.",
    section_card_clock_minimal: "Reloj minimal",
    section_card_clock_minimal_desc: "Reloj limpio y compacto para secciones.",
    card_size: "Tamaño de tarjeta",
    card_size_small: "Pequeña · 3 por fila",
    card_size_medium: "Media · 2 por fila",
    card_size_full: "Completa · 1 por fila"
  };
  const en = {
    section_card_clock_digital: "Digital clock",
    section_card_clock_digital_desc: "Large digital time card for the dashboard.",
    section_card_clock_analog: "Analog clock",
    section_card_clock_analog_desc: "Clock with analog face and contextual data.",
    section_card_clock_premium: "Premium clock",
    section_card_clock_premium_desc: "Large premium residential clock.",
    section_card_clock_minimal: "Minimal clock",
    section_card_clock_minimal_desc: "Clean compact clock for sections.",
    card_size: "Card size",
    card_size_small: "Small · 3 per row",
    card_size_medium: "Medium · 2 per row",
    card_size_full: "Full · 1 per row"
  };

  for (const path of localePaths) {
    if (!fs.existsSync(path)) continue;
    const json = JSON.parse(fs.readFileSync(path, "utf8"));
    json.dashboard ??= {};
    json.dashboard.editor ??= {};
    json.dashboard.editor.sections ??= {};
    Object.assign(json.dashboard.editor.sections, path.includes("/es/") || path.includes("\\es\\") ? es : en);
    write(path, JSON.stringify(json, null, 2) + "\n");
  }
}

function patchTitle() {
  let s = fs.readFileSync(titlePath, "utf8");
  const fn = `function getStoredUserName() {
  if (typeof window === 'undefined') return 'Usuario';

  type Candidate = { value: string; score: number };
  const candidates: Candidate[] = [];
  const storages = [window.sessionStorage, window.localStorage];

  const normalizeName = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    if (!clean || clean.length > 80) return null;
    return clean.includes('@') ? clean.split('@')[0] : clean;
  };

  const addCandidate = (value: unknown, score: number) => {
    const normalized = normalizeName(value);
    if (!normalized) return;
    candidates.push({
      value: normalized,
      score: normalized.toLowerCase() === 'gustavo' ? score - 80 : score,
    });
  };

  const readNameFromObject = (input: unknown): string | null => {
    if (!input || typeof input !== 'object') return null;

    const stack: unknown[] = [input];
    const seen = new Set<unknown>();

    while (stack.length) {
      const current = stack.shift();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);

      const record = current as Record<string, unknown>;
      const direct = record.name || record.displayName || record.fullName || record.username || record.userName || record.email;
      const normalized = normalizeName(direct);
      if (normalized) return normalized;

      for (const value of Object.values(record)) {
        if (value && typeof value === 'object') stack.push(value);
      }
    }

    return null;
  };

  const readJwtPayload = (value: string) => {
    const payload = value.split('.')[1];
    if (!payload) return null;

    try {
      return JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return null;
    }
  };

  for (const storage of storages) {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) || '';
      const raw = storage.getItem(key);
      if (!raw) continue;

      const lowerKey = key.toLowerCase();
      const isLikelyAuth = ['auth', 'session', 'current', 'user', 'token', 'operator'].some((part) => lowerKey.includes(part));
      if (!isLikelyAuth) continue;

      const score =
        lowerKey.includes('token') ? 100 :
        lowerKey.includes('session') ? 90 :
        lowerKey.includes('auth') ? 85 :
        lowerKey.includes('current') ? 80 :
        lowerKey.includes('operator') ? 70 :
        lowerKey.includes('user') ? 55 :
        20;

      const jwtPayload = readJwtPayload(raw);
      if (jwtPayload) addCandidate(readNameFromObject(jwtPayload), score + 25);

      try {
        addCandidate(readNameFromObject(JSON.parse(raw)), score);
      } catch {
        addCandidate(raw, score - 20);
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.value || 'Usuario';
}`;
  s = replaceFunction(s, "getStoredUserName", fn);
  write(titlePath, s);
}

function patchDashboardWidget() {
  let s = fs.readFileSync(widgetPath, "utf8");
  s = s.replace(
    "onClick={(e) => { e.stopPropagation(); onClick(); }}",
    "onClick={(e) => { e.stopPropagation(); if (!isSection) onClick(); }}"
  );
  write(widgetPath, s);
}

function patchSectionWidget() {
  let s = fs.readFileSync(sectionPath, "utf8");

  // Type additions
  s = s.replace("  | 'clock'\n", "  | 'clock_digital'\n  | 'clock_analog'\n  | 'clock_premium'\n  | 'clock_minimal'\n");
  if (!s.includes("type SectionCardSpan")) {
    s = s.replace("  | 'system';", "  | 'system';\n\ntype SectionCardSpan = 'small' | 'medium' | 'full';");
  }
  if (!s.includes("span?: SectionCardSpan;")) {
    s = s.replace("  entityName?: string;\n}", "  entityName?: string;\n  span?: SectionCardSpan;\n}");
  }
  if (!s.includes("  span: SectionCardSpan;")) {
    s = s.replace("  entityId: string;\n}", "  entityId: string;\n  span: SectionCardSpan;\n}");
  }

  // Catalog list
  s = s.replace("  'clock',", "  'clock_digital',\n  'clock_analog',\n  'clock_premium',\n  'clock_minimal',");

  const helpers = `function isClockKind(kind: SectionCardKind) {
  return kind === 'clock_digital' || kind === 'clock_analog' || kind === 'clock_premium' || kind === 'clock_minimal';
}

function getClockStyle(kind: SectionCardKind) {
  switch (kind) {
    case 'clock_analog':
      return 'analog';
    case 'clock_premium':
      return 'premium';
    case 'clock_minimal':
      return 'minimal';
    case 'clock_digital':
    default:
      return 'digital';
  }
}

function getDefaultSpan(kind: SectionCardKind): SectionCardSpan {
  if (kind === 'light' || kind === 'device' || kind === 'cover') return 'small';
  if (isClockKind(kind)) return kind === 'clock_minimal' ? 'medium' : 'full';
  if (kind === 'camera') return 'medium';
  return 'medium';
}

function getSpanCols(span: SectionCardSpan) {
  switch (span) {
    case 'small':
      return 2;
    case 'full':
      return 6;
    case 'medium':
    default:
      return 3;
  }
}

function getSpanClass(span: SectionCardSpan) {
  switch (span) {
    case 'small':
      return 'col-span-2';
    case 'full':
      return 'col-span-6';
    case 'medium':
    default:
      return 'col-span-3';
  }
}

`;
  if (!s.includes("function isClockKind")) {
    s = s.replace("function getWidgetType", helpers + "function getWidgetType");
  }

  // Widget type
  s = s.replace("function getWidgetType(kind: SectionCardKind): WidgetType {\n  switch (kind) {", "function getWidgetType(kind: SectionCardKind): WidgetType {\n  if (isClockKind(kind)) return 'clock_display' as WidgetType;\n\n  switch (kind) {");
  s = s.replace(/\s+case 'clock':\s+return 'clock_display' as WidgetType;/, "");

  // Label and desc keys
  s = s.replace("    case 'energy':\n      return 'dashboard.editor.sections.section_card_energy';", "    case 'clock_digital':\n      return 'dashboard.editor.sections.section_card_clock_digital';\n    case 'clock_analog':\n      return 'dashboard.editor.sections.section_card_clock_analog';\n    case 'clock_premium':\n      return 'dashboard.editor.sections.section_card_clock_premium';\n    case 'clock_minimal':\n      return 'dashboard.editor.sections.section_card_clock_minimal';\n    case 'energy':\n      return 'dashboard.editor.sections.section_card_energy';");
  s = s.replace("    case 'energy':\n      return 'dashboard.editor.sections.section_card_energy_desc';", "    case 'clock_digital':\n      return 'dashboard.editor.sections.section_card_clock_digital_desc';\n    case 'clock_analog':\n      return 'dashboard.editor.sections.section_card_clock_analog_desc';\n    case 'clock_premium':\n      return 'dashboard.editor.sections.section_card_clock_premium_desc';\n    case 'clock_minimal':\n      return 'dashboard.editor.sections.section_card_clock_minimal_desc';\n    case 'energy':\n      return 'dashboard.editor.sections.section_card_energy_desc';");

  // Normalize legacy clock and spans
  s = s.replace(
    /return rawCards[\s\S]*?\.map\(\(card\) => \(\{[\s\S]*?widgetType: card\.widgetType \?\? getWidgetType\(card\.kind\),[\s\S]*?\}\)\);/,
    `return rawCards
    .filter((card): card is SectionCardItem => {
      if (!card || typeof card !== 'object') return false;
      const candidate = card as Partial<SectionCardItem>;
      return typeof candidate.id === 'string' && typeof candidate.kind === 'string';
    })
    .map((card) => {
      const normalizedKind = (card.kind === 'clock' ? 'clock_digital' : card.kind) as SectionCardKind;

      return {
        ...card,
        kind: normalizedKind,
        title: typeof card.title === 'string' && card.title.trim() ? card.title : normalizedKind,
        widgetType: card.widgetType ?? getWidgetType(normalizedKind),
        span: card.span ?? getDefaultSpan(normalizedKind),
      };
    });`
  );

  // Height function and calls
  s = replaceFunction(s, "getRecommendedSectionHeight", `function getRecommendedSectionHeight(currentHeight: number, cards: SectionCardItem[]) {
  const spans = [
    ...cards.map((card) => getSpanCols(card.span ?? getDefaultSpan(card.kind))),
    3,
  ];

  let rows = 1;
  let used = 0;

  for (const cols of spans) {
    if (used + cols > 6) {
      rows += 1;
      used = 0;
    }

    used += cols;

    if (used >= 6) {
      rows += 1;
      used = 0;
    }
  }

  const effectiveRows = Math.max(1, used === 0 ? rows - 1 : rows);
  const recommended = Math.max(4, 1 + effectiveRows * 3);
  return Math.max(currentHeight || 4, recommended);
}`);
  s = s.replace("h: getRecommendedSectionHeight(config.layout.h, nextCards.length),", "h: getRecommendedSectionHeight(config.layout.h, nextCards),");

  // Initial draft and catalog span
  s = s.replace("useState<CardDraft>({ title: '', kind: 'device', entityId: '' })", "useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small' })");
  s = s.replace("widgetType: getWidgetType(kind),\n  }))", "widgetType: getWidgetType(kind),\n    span: getDefaultSpan(kind),\n  }))");

  // Add card span and draft span
  s = s.replace("widgetType: item.widgetType,\n    };", "widgetType: item.widgetType,\n      span: item.span,\n    };");
  s = s.replace("entityId: '',\n    });", "entityId: '',\n      span: nextCard.span ?? getDefaultSpan(nextCard.kind),\n    });");
  s = s.replace("entityId: card.entityId || '',\n    });", "entityId: card.entityId || '',\n      span: card.span ?? getDefaultSpan(card.kind),\n    });");

  // Save span
  s = s.replace("entityName: selectedDevice?.name,\n      };", "entityName: selectedDevice?.name,\n        span: cardDraft.span,\n      };");

  // Internal config clock styles and layout width
  s = s.replace("layout: { x: 0, y: 0, w: 2, h: 2 },", "layout: { x: 0, y: 0, w: getSpanCols(card.span ?? getDefaultSpan(card.kind)), h: 2 },");
  s = s.replace("sectionCardPreview: true,\n    },", "clockStyle: isClockKind(card.kind) ? getClockStyle(card.kind) : undefined,\n      style: isClockKind(card.kind) ? getClockStyle(card.kind) : undefined,\n      sectionCardPreview: true,\n    },");

  // Render real clocks
  s = s.replace("const renderRealDesignedCard = (card: SectionCardItem) => {\n    const internalConfig = buildInternalConfig(card);\n\n    switch (card.kind) {", "const renderRealDesignedCard = (card: SectionCardItem) => {\n    const internalConfig = buildInternalConfig(card);\n\n    if (isClockKind(card.kind)) {\n      return <ClockWidget config={internalConfig} />;\n    }\n\n    switch (card.kind) {");
  s = s.replace(/\s+case 'clock':\s+return <ClockWidget config=\{internalConfig\} \/>;/, "");

  // Static preview clocks
  s = s.replace("if (kind === 'clock') {", "if (isClockKind(kind)) {");
  s = s.replace("Hora local</span>", "{kind === 'clock_analog' ? 'Analógico premium' : kind === 'clock_minimal' ? 'Minimal' : 'Hora local'}</span>");

  // Render card: stop click and span class
  s = s.replace("const renderCard = (card: SectionCardItem) => (\n    <div", "const renderCard = (card: SectionCardItem) => {\n    const span = card.span ?? getDefaultSpan(card.kind);\n\n    return (\n    <div");
  s = s.replace("key={card.id}\n      className=\"group/card", "key={card.id}\n      onClick={(event) => event.stopPropagation()}\n      className={cn(\n        \"group/card");
  s = s.replace("hover:border-primary/45\"\n    >", "hover:border-primary/45\",\n        getSpanClass(span)\n      )}\n    >");
  s = s.replace("    </div>\n  );\n\n  const renderCatalogPreview", "    </div>\n  );\n  };\n\n  const renderCatalogPreview");

  // Catalog preview title override
  s = s.replace("const renderCatalogPreview = (kind: SectionCardKind) => {\n    const title = t(getCatalogLabelKey(kind));", "const renderCatalogPreview = (kind: SectionCardKind, titleOverride?: string) => {\n    const title = titleOverride || t(getCatalogLabelKey(kind));");
  s = s.replace("{renderCatalogPreview(cardDraft.kind)}", "{renderCatalogPreview(cardDraft.kind, cardDraft.title || t(getCatalogLabelKey(cardDraft.kind)))}");

  // Type change should reset span default
  s = s.replace("entityId: isBindableKind(nextKind) ? draft.entityId : '',\n                    title: draft.title || t(getCatalogLabelKey(nextKind)),", "entityId: isBindableKind(nextKind) ? draft.entityId : '',\n                    span: getDefaultSpan(nextKind),\n                    title: draft.title || t(getCatalogLabelKey(nextKind)),");

  // Insert size selector after type label
  if (!s.includes("dashboard.editor.sections.card_size")) {
    const marker = `</label>

            {isBindableKind(cardDraft.kind) ? (`;
    const sizeSelect = `</label>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
                {t('dashboard.editor.sections.card_size')}
              </span>
              <select
                value={cardDraft.span}
                onChange={(event) => setCardDraft((draft) => ({ ...draft, span: event.target.value as SectionCardSpan }))}
                className="w-full rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/60"
              >
                <option value="small">{t('dashboard.editor.sections.card_size_small')}</option>
                <option value="medium">{t('dashboard.editor.sections.card_size_medium')}</option>
                <option value="full">{t('dashboard.editor.sections.card_size_full')}</option>
              </select>
            </label>

            {isBindableKind(cardDraft.kind) ? (`;
    s = s.replace(marker, sizeSelect);
  }

  // Grid 6 columns and add button span
  s = s.replace("grid-cols-2 auto-rows-[10.5rem]", "grid-cols-6 auto-rows-[10.5rem]");
  s = s.replace("<div className=\"grid min-h-0 flex-1", "<div\n      onClick={(event) => event.stopPropagation()}\n      className=\"grid min-h-0 flex-1");
  s = s.replace("cards.length === 0 && \"col-span-2\"", "cards.length === 0 ? \"col-span-6\" : \"col-span-3\"");

  // Section wrappers should not bubble to outer widget click.
  s = s.replace("<section className=\"flex h-full", "<section onClick={(event) => event.stopPropagation()} className=\"flex h-full");
  s = s.replace("<div className=\"group/section", "<div onClick={(event) => event.stopPropagation()} className=\"group/section");

  write(sectionPath, s);
}

patchLocales();
patchTitle();
patchDashboardWidget();
patchSectionWidget();

console.log("V22 incremental section UX patch applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
