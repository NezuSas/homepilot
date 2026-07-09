// HomePilot Section Cards V25 - searchable icon picker
// Run from repo root:
// node .\apply-homepilot-section-cards-v25-icon-search.cjs
//
// Replaces the fixed icon grid with a searchable dropdown like the previous icon picker.
// The selected icon updates the card preview immediately.

const fs = require("fs");

const path = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx";
let s = fs.readFileSync(path, "utf8");

s = s.replace("  Lightbulb,\n", "  Lightbulb,\n  LightbulbOff,\n");
s = s.replace(
  "type SectionCardIcon = 'lightbulb' | 'power' | 'plug' | 'sun' | 'moon' | 'fan' | 'camera' | 'tv' | 'shield' | 'wifi';",
  "type SectionCardIcon = string;"
);

const iconOptionsStart = s.indexOf("const iconOptions:");
if (iconOptionsStart < 0) throw new Error("Could not find iconOptions start.");
const iconOptionsEnd = s.indexOf("];", iconOptionsStart);
if (iconOptionsEnd < 0) throw new Error("Could not find iconOptions end.");

const newIconOptions = `const iconOptions: { id: SectionCardIcon; label: string }[] = [
  { id: 'lightbulb', label: 'Lightbulb' },
  { id: 'lightbulb-icon', label: 'LightbulbIcon' },
  { id: 'lightbulb-off', label: 'LightbulbOff' },
  { id: 'lightbulb-off-icon', label: 'LightbulbOffIcon' },
  { id: 'lucide-lightbulb', label: 'LucideLightbulb' },
  { id: 'power', label: 'Power' },
  { id: 'power-icon', label: 'PowerIcon' },
  { id: 'plug', label: 'Plug' },
  { id: 'plug-icon', label: 'PlugIcon' },
  { id: 'sun', label: 'Sun' },
  { id: 'sun-icon', label: 'SunIcon' },
  { id: 'moon', label: 'Moon' },
  { id: 'moon-icon', label: 'MoonIcon' },
  { id: 'fan', label: 'Fan' },
  { id: 'fan-icon', label: 'FanIcon' },
  { id: 'camera', label: 'Camera' },
  { id: 'camera-icon', label: 'CameraIcon' },
  { id: 'tv', label: 'Tv' },
  { id: 'tv-icon', label: 'TvIcon' },
  { id: 'shield', label: 'Shield' },
  { id: 'shield-icon', label: 'ShieldIcon' },
  { id: 'wifi', label: 'Wifi' },
  { id: 'wifi-icon', label: 'WifiIcon' },
];`;
s = s.slice(0, iconOptionsStart) + newIconOptions + s.slice(iconOptionsEnd + 2);

s = s.replace(
  /function iconForIconKey\(icon: SectionCardIcon\) \{[\s\S]*?\n\}/,
`function normalizeIconKey(icon: SectionCardIcon) {
  return icon
    .trim()
    .toLowerCase()
    .replace(/^lucide-/, '')
    .replace(/icon$/, '')
    .replace(/[^a-z0-9]/g, '');
}

function getIconOptionLabel(icon: SectionCardIcon) {
  const normalized = normalizeIconKey(icon);
  return iconOptions.find((option) => normalizeIconKey(option.id) === normalized)?.label || icon || 'Lightbulb';
}

function iconForIconKey(icon: SectionCardIcon) {
  const normalized = normalizeIconKey(icon);

  if (normalized.includes('lightbulboff')) return LightbulbOff;
  if (normalized.includes('lightbulb')) return Lightbulb;
  if (normalized.includes('plug')) return Plug;
  if (normalized.includes('sun')) return Sun;
  if (normalized.includes('moon')) return Moon;
  if (normalized.includes('fan')) return Fan;
  if (normalized.includes('camera')) return Camera;
  if (normalized === 'tv' || normalized.includes('television')) return Tv;
  if (normalized.includes('shield')) return Shield;
  if (normalized.includes('wifi')) return Wifi;
  if (normalized.includes('power')) return Power;

  return Lightbulb;
}`
);

s = s.replace(
  "  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);\n  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb' });",
  "  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);\n  const [iconQuery, setIconQuery] = useState('Lightbulb');\n  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);\n  const [cardDraft, setCardDraft] = useState<CardDraft>({ title: '', kind: 'device', entityId: '', span: 'small', icon: 'lightbulb' });"
);

s = s.replace(
  "    setCardDraft({\n      title: nextCard.title,\n      kind: nextCard.kind,\n      entityId: '',\n      span: nextCard.span ?? getDefaultSpan(nextCard.kind),\n      icon: nextCard.icon ?? getDefaultIcon(nextCard.kind),\n    });",
  "    const nextIcon = nextCard.icon ?? getDefaultIcon(nextCard.kind);\n    setIconQuery(getIconOptionLabel(nextIcon));\n    setCardDraft({\n      title: nextCard.title,\n      kind: nextCard.kind,\n      entityId: '',\n      span: nextCard.span ?? getDefaultSpan(nextCard.kind),\n      icon: nextIcon,\n    });"
);

s = s.replace(
  "    setCardDraft({\n      title: card.title,\n      kind: card.kind,\n      entityId: card.entityId || '',\n      span: card.span ?? getDefaultSpan(card.kind),\n      icon: card.icon ?? getDefaultIcon(card.kind),\n    });",
  "    const nextIcon = card.icon ?? getDefaultIcon(card.kind);\n    setIconQuery(getIconOptionLabel(nextIcon));\n    setCardDraft({\n      title: card.title,\n      kind: card.kind,\n      entityId: card.entityId || '',\n      span: card.span ?? getDefaultSpan(card.kind),\n      icon: nextIcon,\n    });"
);

s = s.replace(
  "                  const nextKind = event.target.value as NormalizedSectionCardKind;\n                  setCardDraft((draft) => ({",
  "                  const nextKind = event.target.value as NormalizedSectionCardKind;\n                  setIconQuery(getIconOptionLabel(getDefaultIcon(nextKind)));\n                  setCardDraft((draft) => ({"
);

const oldGrid = `            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Icono</span>
                <div className="grid grid-cols-5 gap-2">
                  {iconOptions.map((option) => {
                    const Icon = iconForIconKey(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setCardDraft((draft) => ({ ...draft, icon: option.id }))}
                        className={cn(
                          "grid h-12 place-items-center rounded-2xl border transition",
                          cardDraft.icon === option.id
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/50 bg-background/40 text-muted-foreground hover:text-foreground"
                        )}
                        title={option.label}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}`;

const newPicker = `            {(cardDraft.kind === 'light' || cardDraft.kind === 'device' || cardDraft.kind === 'cover') ? (
              <div className="relative space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Icono (opcional)</span>
                <div className="relative">
                  <input
                    value={iconQuery}
                    onFocus={() => setIsIconPickerOpen(true)}
                    onChange={(event) => {
                      const value = event.target.value;
                      setIconQuery(value);
                      setIsIconPickerOpen(true);

                      const exact = iconOptions.find((option) =>
                        option.label.toLowerCase() === value.trim().toLowerCase() ||
                        option.id.toLowerCase() === value.trim().toLowerCase()
                      );

                      if (exact) {
                        setCardDraft((draft) => ({ ...draft, icon: exact.id }));
                      }
                    }}
                    placeholder="Buscar icono, ej. Lightbulb"
                    className="w-full rounded-2xl border border-primary/60 bg-background/60 px-12 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                  />
                  {(() => {
                    const Icon = iconForIconKey(cardDraft.icon);
                    return <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />;
                  })()}
                </div>

                {isIconPickerOpen ? (
                  <div className="absolute left-0 right-0 top-full z-[100000] mt-2 max-h-56 overflow-y-auto rounded-2xl border border-border/60 bg-popover p-2 shadow-2xl">
                    {iconOptions
                      .filter((option) => {
                        const q = iconQuery.trim().toLowerCase();
                        if (!q) return true;
                        return option.label.toLowerCase().includes(q) || option.id.toLowerCase().includes(q);
                      })
                      .map((option) => {
                        const Icon = iconForIconKey(option.id);
                        const isSelected = normalizeIconKey(cardDraft.icon) === normalizeIconKey(option.id);

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCardDraft((draft) => ({ ...draft, icon: option.id }));
                              setIconQuery(option.label);
                              setIsIconPickerOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-black transition",
                              isSelected ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted/60"
                            )}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span>{option.label}</span>
                          </button>
                        );
                      })}
                  </div>
                ) : null}
              </div>
            ) : null}`;

if (!s.includes(oldGrid)) throw new Error("Could not find the fixed icon grid block to replace.");
s = s.replace(oldGrid, newPicker);

fs.writeFileSync(path, s, "utf8");
console.log("V25 searchable icon picker applied.");
console.log("Run: npm run build --workspace=apps/operator-console");
