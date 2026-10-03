import type { CardColumns, CardGridOptions } from '../types';

/** Size constraints apply to gestures and keyboard alike; never mutate input. */
export function resizeCardGrid(initial: CardGridOptions, columnsDelta: number, rowsDelta: number, measuredRows: number): CardGridOptions {
  const columns = initial.columns === 'full' ? 12 : initial.columns;
  const rows = initial.rows === 'auto' ? measuredRows : initial.rows;
  return {
    ...initial,
    columns: Math.min(initial.maxColumns ?? 12, Math.max(initial.minColumns ?? 1, columns + columnsDelta)) as CardColumns,
    rows: rowsDelta === 0 ? initial.rows : Math.min(initial.maxRows ?? Number.MAX_SAFE_INTEGER, Math.max(initial.minRows ?? 1, rows + rowsDelta)),
  };
}
