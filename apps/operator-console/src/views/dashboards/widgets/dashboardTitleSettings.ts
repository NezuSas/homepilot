import type { TitleAlign, TitleWidthMode } from './dashboardTitleContent';

export function readTitleAlign(value: unknown, fallback: TitleAlign): TitleAlign {
  return value === 'left' || value === 'right' || value === 'center' ? value : fallback;
}

export function readTitleWidthMode(value: unknown): TitleWidthMode {
  return value === 'half' || value === 'third' ? value : 'full';
}

/** Stored markdown wins; otherwise a heading plus subtitle is composed from the
 * appearance title and the placeholders supplied by the caller. */
export function resolveTitleMarkdown(
  extra: Record<string, unknown> | undefined,
  appearanceTitle: string | undefined,
  titlePlaceholder: string,
  subtitlePlaceholder: string,
): string {
  if (typeof extra?.markdown === 'string' && extra.markdown.trim()) return extra.markdown;
  return [
    `# ${appearanceTitle || titlePlaceholder}`,
    typeof extra?.subtitle === 'string' ? extra.subtitle : subtitlePlaceholder,
  ].filter(Boolean).join('\n');
}

export function getTitleLayoutClasses(align: TitleAlign, widthMode: TitleWidthMode, blockAlign: TitleAlign) {
  const alignmentClass = align === 'left'
    ? 'items-start text-left'
    : align === 'right'
      ? 'items-end text-right'
      : 'items-center text-center';

  const widthClass = widthMode === 'half' ? 'w-1/2' : widthMode === 'third' ? 'w-1/3' : 'w-full';
  const blockJustifyClass = blockAlign === 'left' ? 'justify-start' : blockAlign === 'right' ? 'justify-end' : 'justify-center';

  return { alignmentClass, widthClass, blockJustifyClass };
}
