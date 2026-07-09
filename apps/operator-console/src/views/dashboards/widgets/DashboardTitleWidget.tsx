import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardWidgetConfig } from '../types';

interface DashboardTitleWidgetProps {
  config: DashboardWidgetConfig;
  isEditing: boolean;
}

type TitleAlign = 'left' | 'center' | 'right';

function getStoredUserName() {
  if (typeof window === 'undefined') return 'Gustavo';

  const directKeys = ['homepilot.user', 'homepilot.currentUser', 'user', 'currentUser', 'auth.user'];

  for (const key of directKeys) {
    const value = window.localStorage.getItem(key);
    if (!value) continue;

    try {
      const parsed = JSON.parse(value);
      const name = parsed?.name || parsed?.displayName || parsed?.username || parsed?.email;
      if (typeof name === 'string' && name.trim()) return name.split('@')[0];
    } catch {
      if (value.trim() && value.length < 48) return value.trim();
    }
  }

  return 'Gustavo';
}

function renderTemplate(markdown: string) {
  const user = getStoredUserName();

  return markdown
    .replace(/\{\{\s*user\s*\}\}/gi, user)
    .replace(/\{\{\s*usuario\s*\}\}/gi, user);
}

function markdownToBlocks(markdown: string) {
  const lines = markdown.split(/\r?\n/);

  return lines.map((rawLine, index) => {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      return { key: index, type: 'space' as const, text: '' };
    }

    if (line.startsWith('### ')) {
      return { key: index, type: 'h3' as const, text: line.slice(4).trim() };
    }

    if (line.startsWith('## ')) {
      return { key: index, type: 'h2' as const, text: line.slice(3).trim() };
    }

    if (line.startsWith('# ')) {
      return { key: index, type: 'h1' as const, text: line.slice(2).trim() };
    }

    return { key: index, type: 'p' as const, text: line.trim() };
  });
}

export function DashboardTitleWidget({ config, isEditing }: DashboardTitleWidgetProps) {
  const { t } = useTranslation();

  const markdown =
    typeof config.extra?.markdown === 'string' && config.extra.markdown.trim()
      ? config.extra.markdown
      : [
          `# ${config.appearance?.title || t('dashboard.editor.sections.title_placeholder')}`,
          typeof config.extra?.subtitle === 'string'
            ? config.extra.subtitle
            : t('dashboard.editor.sections.subtitle_placeholder'),
        ].filter(Boolean).join('\n');

  const align = (config.extra?.align === 'left' || config.extra?.align === 'right' || config.extra?.align === 'center')
    ? config.extra.align as TitleAlign
    : 'center';

  const rendered = useMemo(() => renderTemplate(markdown), [markdown]);
  const blocks = useMemo(() => markdownToBlocks(rendered), [rendered]);

  const alignmentClass = align === 'left'
    ? 'items-start text-left'
    : align === 'right'
      ? 'items-end text-right'
      : 'items-center text-center';

  if (isEditing && !markdown.trim()) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] border-2 border-dashed border-border/60 bg-background/10 px-5 py-4">
        <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/75 bg-background/35 px-5 py-2 text-sm font-semibold text-primary">
          <span className="text-xl leading-none">+</span>
          <span>{t('dashboard.editor.sections.add_title')}</span>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full w-full min-w-0 flex-col justify-center overflow-hidden rounded-[1.25rem] border border-border/35 bg-background/10 px-[clamp(1rem,3cqi,2rem)] py-[clamp(0.65rem,1.5cqi,1.1rem)] ${alignmentClass}`}
      style={{ containerType: 'inline-size' }}
    >
      <div className="min-w-0 max-w-full space-y-[clamp(0.18rem,0.6cqi,0.45rem)]">
        {blocks.map((block) => {
          if (block.type === 'space') {
            return <div key={block.key} className="h-[clamp(0.2rem,0.6cqi,0.5rem)]" />;
          }

          if (block.type === 'h1') {
            return (
              <h1
                key={block.key}
                className="min-w-0 max-w-full truncate text-[clamp(1.15rem,3.1cqi,2rem)] font-black leading-tight tracking-tight text-foreground"
              >
                {block.text}
              </h1>
            );
          }

          if (block.type === 'h2') {
            return (
              <h2
                key={block.key}
                className="min-w-0 max-w-full truncate text-[clamp(1rem,2.4cqi,1.55rem)] font-black leading-tight tracking-tight text-foreground"
              >
                {block.text}
              </h2>
            );
          }

          if (block.type === 'h3') {
            return (
              <h3
                key={block.key}
                className="min-w-0 max-w-full truncate text-[clamp(0.9rem,2cqi,1.25rem)] font-bold leading-tight text-foreground"
              >
                {block.text}
              </h3>
            );
          }

          return (
            <p
              key={block.key}
              className="min-w-0 max-w-full truncate text-[clamp(0.72rem,1.45cqi,0.98rem)] font-medium leading-snug text-muted-foreground"
            >
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}