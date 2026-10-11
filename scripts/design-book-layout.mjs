// HTML layout of the design book: cover, index, reading guide, one page per component, device and theme.
// Devices are drawn in CSS around the real full-screen captures (bezel, camera, stand), so each page shows
// the component the way it appears on a phone, tablet, kiosk or monitor.

const PAGE_W = 1123;
const PAGE_H = 794;

export const families = [
  { name: 'Acciones', components: ['Button', 'IconButton', 'SurfaceButton', 'ActionMenu'] },
  { name: 'Formularios', components: ['Input', 'Textarea', 'NumberInput', 'DateField', 'SearchableSelectField', 'MeasurementUnitSelect', 'SearchFilterBar', 'SegmentedControl', 'SelectableOptionCard', 'ToggleSwitch', 'RangeInput'] },
  { name: 'Estados y avisos', components: ['StatusPill', 'AlertBanner', 'EmptyState', 'LoadingState', 'ComponentSkeletons', 'DashboardCardSkeleton'] },
  { name: 'Estructura', components: ['Heading', 'SectionHeader', 'PageFrame', 'SidebarItem', 'Card', 'AssistantCard', 'DeviceTileShell'] },
  { name: 'Capas', components: ['Modal', 'Drawer'] },
];

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Frame metrics by device kind, as fractions of the shorter screen side. */
const frames = {
  phone: { bezel: 0.034, radius: 0.1, caption: 'Celular' },
  tablet: { bezel: 0.03, radius: 0.04, caption: 'Tableta' },
  kiosk: { bezel: 0.024, radius: 0.014, caption: 'Kiosko' },
  desktop: { bezel: 0.012, radius: 0.008, caption: 'Escritorio' },
};

function device(kind, shot, label, maxW, maxH) {
  const spec = frames[kind];
  const scale = Math.min(maxW / shot.width, maxH / shot.height);
  const sw = Math.round(shot.width * scale);
  const sh = Math.round(shot.height * scale);
  const m = Math.min(sw, sh);
  const b = Math.max(5, Math.round(m * spec.bezel));
  const rs = Math.round(m * spec.radius);
  const vertical = sh > sw;
  let ornament = '';
  if (kind === 'phone') {
    ornament = vertical
      ? `<i class="island" style="top:${Math.round(b + m * 0.03)}px;left:50%;width:${Math.round(m * 0.27)}px;height:${Math.round(m * 0.072)}px;transform:translateX(-50%)"></i>`
      : `<i class="island" style="left:${Math.round(b + m * 0.03)}px;top:50%;width:${Math.round(m * 0.072)}px;height:${Math.round(m * 0.27)}px;transform:translateY(-50%)"></i>`;
  } else if (kind === 'tablet') {
    ornament = vertical
      ? `<i class="cam" style="top:${Math.round(b / 2 - 2)}px;left:50%"></i>`
      : `<i class="cam" style="left:${Math.round(b / 2 - 2)}px;top:50%"></i>`;
  } else if (kind === 'kiosk') {
    ornament = `<i class="led" style="bottom:${Math.round(b / 2 - 2)}px;left:50%"></i>`;
  } else {
    ornament = `<i class="cam" style="top:${Math.round(b / 2 - 2)}px;left:50%"></i>`;
  }
  const stand = kind === 'desktop'
    ? `<div class="neck" style="width:${Math.round(sw * 0.09)}px;height:${Math.round(sh * 0.1)}px"></div><div class="base" style="width:${Math.round(sw * 0.28)}px"></div>`
    : '';
  return `<figure class="dev ${kind}">
    <div class="body" style="padding:${b}px;border-radius:${rs + b}px">
      <div class="screen" style="width:${sw}px;height:${sh}px;border-radius:${rs}px"><img src="${shot.file}" alt="${escapeHtml(label)}"></div>
      ${ornament}
    </div>${stand}
    <figcaption><b>${escapeHtml(label)}</b> · ${shot.cssWidth} × ${shot.cssHeight}</figcaption>
  </figure>`;
}

const css = `
  @page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .page { width: ${PAGE_W}px; height: ${PAGE_H}px; position: relative; overflow: hidden; break-after: page; page-break-after: always; }
  .page.light { background: radial-gradient(1200px 700px at 30% 0%, #f4f1ec 0%, #e8e3db 70%); color: #1f252d; }
  .page.dark { background: radial-gradient(1200px 700px at 30% 0%, #26211e 0%, #121110 72%); color: #f5f1ec; }
  .pad { position: absolute; inset: 0; padding: 44px 64px; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #c76a3c; }
  .dark .eyebrow { color: #f08d3d; }
  h1.name { font-size: 40px; line-height: 1.05; margin: 8px 0 0; font-weight: 700; letter-spacing: -.03em; }
  .purpose { margin: 10px 0 0; max-width: 620px; font-size: 14px; line-height: 1.5; opacity: .72; }
  .variants { margin: 6px 0 0; font-size: 11.5px; opacity: .55; letter-spacing: .01em; }
  .mode { position: absolute; top: 48px; right: 64px; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; border: 1px solid currentColor; opacity: .8; }
  .mode i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .stage { position: absolute; left: 64px; right: 64px; top: 190px; bottom: 56px; display: flex; justify-content: center; align-items: flex-end; gap: 56px; }
  .foot { position: absolute; left: 64px; right: 64px; bottom: 22px; display: flex; justify-content: space-between; font-size: 10.5px; letter-spacing: .06em; opacity: .5; }
  figure { margin: 0; }
  .dev { display: flex; flex-direction: column; align-items: center; }
  .dev .body { position: relative; background: linear-gradient(145deg, #3a3a3f 0%, #17171a 45%, #0c0c0e 100%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14), inset 0 1px 0 rgba(255,255,255,.22), 0 36px 54px -26px rgba(0,0,0,.55), 0 10px 18px -8px rgba(0,0,0,.35); }
  .dev.kiosk .body { background: linear-gradient(145deg, #55555b 0%, #2b2b30 50%, #1a1a1d 100%); }
  .dev .screen { overflow: hidden; background: #000; }
  .dev .screen img { display: block; width: 100%; height: 100%; }
  .island { position: absolute; background: #050506; border-radius: 999px; }
  .cam { position: absolute; width: 5px; height: 5px; background: #0a0a0c; border-radius: 50%; box-shadow: inset 0 0 0 1px #2c2c31; transform: translate(-50%, 0); }
  .led { position: absolute; width: 5px; height: 5px; background: #5de0a3; border-radius: 50%; box-shadow: 0 0 6px #5de0a3; transform: translate(-50%, 0); }
  .neck { background: linear-gradient(90deg, #4a4a50, #2a2a2f 50%, #4a4a50); }
  .base { height: 8px; border-radius: 4px; background: linear-gradient(180deg, #55555b, #2a2a2f); box-shadow: 0 14px 20px -8px rgba(0,0,0,.5); }
  figcaption { margin-top: 14px; font-size: 11px; letter-spacing: .03em; opacity: .62; text-align: center; }
  figcaption b { font-weight: 700; opacity: 1; }
  .cover .pad { padding-top: 70px; }
  .cover .mark { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .cover .bar { width: 56px; height: 6px; border-radius: 3px; background: #f08d3d; }
  .cover h1 { font-size: 76px; line-height: .95; margin: 0; letter-spacing: -.04em; font-weight: 800; }
  .cover h2 { font-size: 22px; margin: 14px 0 0; font-weight: 500; opacity: .75; letter-spacing: -.01em; }
  .cover .meta { margin-top: 18px; font-size: 12px; opacity: .5; max-width: 420px; line-height: 1.55; }
  .cover .hero { position: absolute; right: 56px; bottom: 56px; display: flex; align-items: flex-end; gap: 28px; }
  h2.sec { font-size: 30px; margin: 8px 0 28px; letter-spacing: -.03em; }
  .toc { columns: 2; column-gap: 56px; }
  .toc section { break-inside: avoid; margin-bottom: 20px; }
  .toc h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #c76a3c; }
  .toc li { display: flex; gap: 8px; font-size: 13px; padding: 3px 0; list-style: none; }
  .toc ul { margin: 0; padding: 0; }
  .toc .dots { flex: 1; border-bottom: 1px dotted currentColor; opacity: .25; transform: translateY(-4px); }
  .guide { display: grid; grid-template-columns: 1fr 1fr; gap: 28px 56px; margin-top: 8px; }
  .guide .item { display: flex; gap: 18px; align-items: center; }
  .guide .sil { flex: none; border: 2px solid #3a3a3f; background: #17171a; }
  .guide h4 { margin: 0 0 4px; font-size: 15px; }
  .guide p { margin: 0; font-size: 12px; line-height: 1.5; opacity: .7; }
  .divider .pad { display: flex; flex-direction: column; justify-content: center; }
  .divider h2 { font-size: 64px; margin: 6px 0 0; letter-spacing: -.04em; font-weight: 800; }
  .divider p { font-size: 15px; opacity: .65; margin: 14px 0 0; max-width: 520px; line-height: 1.5; }
`;

export function buildBookHtml({ selected, manifest, devices, purposes, variants, date }) {
  const pages = [];
  const toc = [];
  let number = 0;
  const shotFor = (name, deviceId, theme) => {
    const shot = manifest[`${name}/${deviceId}-${theme}`];
    if (!shot) return null;
    const device = devices.find((entry) => entry.id === deviceId);
    return { ...shot, cssWidth: device.width, cssHeight: device.height };
  };
  const foot = (n, dark) => `<div class="foot"><span>HomePilot · Libro de diseño</span><span>${n}</span></div>`;

  // Cover: three real screens of a representative component in dark mode.
  const heroName = selected.includes('Card') ? 'Card' : selected[0];
  const heroPieces = [
    ['desktop', shotFor(heroName, 'escritorio', 'dark'), 'Escritorio', 430, 270],
    ['tablet', shotFor(heroName, 'tableta-vertical', 'dark'), 'Tableta', 150, 200],
    ['phone', shotFor(heroName, 'celular-vertical', 'dark'), 'Celular', 100, 216],
  ].filter((entry) => entry[1]);
  number += 1;
  pages.push(`<section class="page dark cover"><div class="pad">
    <div class="mark"><span class="bar"></span><span class="eyebrow">Consola del operador</span></div>
    <h1>HomePilot</h1><h2>Libro de diseño de componentes</h2>
    <p class="meta">Cada componente compartido, capturado de la aplicación real en modo oscuro y claro, en celular, tableta, kiosko y escritorio, en vertical y horizontal.<br>Generado el ${date}.</p>
    <div class="hero">${heroPieces.map(([kind, shot, label, w, h]) => device(kind, shot, label, w, h)).join('')}</div>
  </div></section>`);

  // Reading guide
  number += 1;
  pages.push(`<section class="page light"><div class="pad">
    <div class="eyebrow">Cómo leer este libro</div><h2 class="sec">Formatos y modos</h2>
    <div class="guide">
      <div class="item"><div class="sil" style="width:34px;height:70px;border-radius:10px"></div><div><h4>Celular</h4><p>390 × 844 en vertical y 844 × 390 en horizontal. Pantalla táctil.</p></div></div>
      <div class="item"><div class="sil" style="width:62px;height:82px;border-radius:8px"></div><div><h4>Tableta</h4><p>768 × 1024 en vertical y 1024 × 768 en horizontal. Es el formato principal de uso.</p></div></div>
      <div class="item"><div class="sil" style="width:40px;height:72px;border-radius:3px"></div><div><h4>Kiosko</h4><p>Pantalla fija de pared: 1080 × 1920 en vertical y 1920 × 1080 en horizontal.</p></div></div>
      <div class="item"><div class="sil" style="width:86px;height:56px;border-radius:4px"></div><div><h4>Escritorio</h4><p>1440 × 900 en horizontal, con puntero.</p></div></div>
    </div>
    <p style="margin-top:36px;max-width:700px;font-size:13px;line-height:1.6;opacity:.7">Las páginas oscuras muestran el modo oscuro y las claras el modo claro. Cada pantalla es una captura real de la aplicación con sus puntos de corte, tipografía Inter y tokens de color; no son maquetas. Los componentes se agrupan por familia: acciones, formularios, estados y avisos, estructura y capas.</p>
    ${foot(2)}
  </div></section>`);
  number = 2;
  const tocSlot = pages.length;
  pages.push('');
  number += 1;

  const groups = [
    { kind: 'phone', title: 'Celular', ids: ['celular-vertical', 'celular-horizontal'], caps: [[218, 470], [500, 330]] },
    { kind: 'tablet', title: 'Tableta', ids: ['tableta-vertical', 'tableta-horizontal'], caps: [[338, 450], [520, 390]] },
    { kind: 'kiosk', title: 'Kiosko', ids: ['kiosko-vertical', 'kiosko-horizontal'], caps: [[253, 450], [600, 340]] },
    { kind: 'desktop', title: 'Escritorio', ids: ['escritorio'], caps: [[690, 420]] },
  ];
  const labels = { 'celular-vertical': 'Vertical', 'celular-horizontal': 'Horizontal', 'tableta-vertical': 'Vertical', 'tableta-horizontal': 'Horizontal', 'kiosko-vertical': 'Vertical', 'kiosko-horizontal': 'Horizontal', escritorio: 'Horizontal' };

  for (const family of families) {
    const names = family.components.filter((name) => selected.includes(name));
    if (names.length === 0) continue;
    number += 1;
    pages.push(`<section class="page dark divider"><div class="pad"><div class="eyebrow">Familia</div><h2>${escapeHtml(family.name)}</h2><p>${names.length} componente${names.length === 1 ? '' : 's'}: ${names.map(escapeHtml).join(', ')}.</p>${foot(number)}</div></section>`);
    for (const name of names) {
      toc.push({ family: family.name, name, page: number + 1 });
      for (const group of groups) {
        for (const theme of ['dark', 'light']) {
          const shots = group.ids.map((id) => ({ id, shot: shotFor(name, id, theme) })).filter((entry) => entry.shot);
          if (shots.length === 0) continue;
          number += 1;
          const figures = shots.map((entry, index) => device(group.kind, entry.shot, `${group.title} · ${labels[entry.id]}`, group.caps[index][0], group.caps[index][1])).join('');
          const intro = purposes[name] ? `<p class="purpose">${escapeHtml(purposes[name])}</p>` : '';
          const vr = variants[name]?.length ? `<p class="variants">${variants[name].map(escapeHtml).join('   ·   ')}</p>` : '';
          pages.push(`<section class="page ${theme}"><div class="pad">
            <div class="eyebrow">${escapeHtml(family.name)} · ${group.title}</div>
            <h1 class="name">${escapeHtml(name)}</h1>${intro}${vr}
            <div class="mode"><i></i>${theme === 'dark' ? 'Modo oscuro' : 'Modo claro'}</div>
            <div class="stage">${figures}</div>
            ${foot(number)}
          </div></section>`);
        }
      }
    }
  }

  const byFamily = families.map((family) => ({ family: family.name, rows: toc.filter((entry) => entry.family === family.name) })).filter((entry) => entry.rows.length);
  pages[tocSlot] = `<section class="page light"><div class="pad"><div class="eyebrow">Contenido</div><h2 class="sec">Índice de componentes</h2><div class="toc">${byFamily.map((entry) => `<section><h3>${escapeHtml(entry.family)}</h3><ul>${entry.rows.map((row) => `<li><span>${escapeHtml(row.name)}</span><span class="dots"></span><span>${row.page}</span></li>`).join('')}</ul></section>`).join('')}</div>${foot(3)}</div></section>`;
  return { html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>HomePilot · Libro de diseño</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`, pageCount: pages.length };
}
