import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import type { CardGridOptions } from '../types';
import { CARD_EDITOR_MAX_ROWS, pickCardGridSize } from './cardGridResize';

/** One two-dimensional control for mouse, touch and keyboard sizing. */
export function CardGridSizePicker({ value, onChange }: { value: CardGridOptions; onChange: (value: CardGridOptions) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const columns = value.columns === 'full' ? 12 : value.columns;
  const rowLimit = CARD_EDITOR_MAX_ROWS;
  const rows = value.rows === 'auto' ? 4 : value.rows;
  const update = (element: HTMLElement, x: number, y: number) => {
    const bounds = element.getBoundingClientRect();
    onChange(pickCardGridSize(value, x - bounds.left, y - bounds.top, bounds.width, bounds.height));
  };
  return <div className="space-y-3">
    <output className="block text-body-compact font-semibold text-foreground">
      {t('dashboards.edit_session.columns')}: {value.columns === 'full' ? t('dashboard.editor.sections.card_size_full') : columns}
      {' · '}{t('dashboards.edit_session.rows')}: {value.rows === 'auto' ? t('dashboards.edit_session.auto') : rows}
    </output>
    <div role="grid" tabIndex={0} aria-label={t('dashboards.edit_session.design')}
      aria-rowcount={rowLimit} aria-colcount={12} aria-activedescendant={`${id}-${Math.min(rows, rowLimit)}-${columns}`}
      className="grid aspect-[3/2] w-72 max-w-full touch-manipulation select-none overflow-hidden rounded-control border border-border bg-border/50 p-px outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{ gridTemplateRows: `repeat(${rowLimit}, minmax(0, 1fr))`, gap: 1 }}
      onMouseDown={event => event.stopPropagation()}
      onTouchStart={event => event.stopPropagation()}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation();
        event.currentTarget.focus();
        update(event.currentTarget, event.clientX, event.clientY);
      }}
      onKeyDown={event => {
        const directions: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
        const direction = directions[event.key];
        if (!direction) return;
        event.preventDefault();
        onChange(pickCardGridSize(value, columns + direction[0], rows + direction[1], 12, rowLimit));
      }}>
      {Array.from({ length: rowLimit }, (_, row) => <div role="row" key={row} className="grid grid-cols-12 gap-px">
        {Array.from({ length: 12 }, (_, column) => <span role="gridcell" key={column} id={`${id}-${row + 1}-${column + 1}`}
          aria-selected={row + 1 === rows && column + 1 === columns}
          aria-label={`${t('dashboards.edit_session.columns')}: ${column + 1}, ${t('dashboards.edit_session.rows')}: ${row + 1}`}
          className={column < columns && row < rows ? 'cursor-pointer bg-primary/35' : 'cursor-pointer bg-card'} />)}
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" size="sm" aria-pressed={value.rows === 'auto'} onClick={() => onChange({ ...value, rows: 'auto' })}>{t('dashboards.edit_session.auto')}</Button>
      {(value.maxColumns ?? 12) === 12 && <Button type="button" variant="secondary" size="sm" aria-pressed={value.columns === 'full'} onClick={() => onChange({ ...value, columns: 'full' })}>{t('dashboard.editor.sections.card_size_full')}</Button>}
    </div>
  </div>;
}
