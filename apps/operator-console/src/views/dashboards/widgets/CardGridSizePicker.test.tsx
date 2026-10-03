import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardGridSizePicker } from './CardGridSizePicker';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('Feature: Interactive card sizing (AC48)', () => {
  it('Scenario: Design exposes a keyboard-focusable two-dimensional grid without size inputs', () => {
    const html = renderToStaticMarkup(React.createElement(CardGridSizePicker, { value: { columns: 6, rows: 8 }, onChange: () => {} }));
    expect(html).toContain('role="grid"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-activedescendant=');
    expect(html.match(/role="gridcell"/g)).toHaveLength(96);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<select');
  });
  it('Scenario: Explicit row limits bound the grid and automatic sizing remains available', () => {
    const html = renderToStaticMarkup(React.createElement(CardGridSizePicker, { value: { columns: 'full', rows: 'auto', maxRows: 8 }, onChange: () => {} }));
    expect(html.match(/role="gridcell"/g)).toHaveLength(96);
    expect(html).toContain('aria-rowcount="8"');
    expect(html).toContain('dashboards.edit_session.auto');
    expect(html).toContain('aria-pressed="true"');
  });
  it('Scenario: A tap selects once and moving a pointer cannot resize the grid', () => {
    const id = jest.spyOn(React, 'useId').mockReturnValue('sizing');
    try {
      const onChange = jest.fn();
      const element = CardGridSizePicker({ value: { columns: 6, rows: 'auto' }, onChange });
      const grid = element.props.children[1] as React.ReactElement<{
        onClick: (event: { currentTarget: { getBoundingClientRect: () => { left: number; top: number; width: number; height: number }; focus: () => void }; clientX: number; clientY: number; stopPropagation: () => void }) => void;
        onPointerMove?: unknown;
        onPointerUp?: unknown;
        onPointerCancel?: unknown;
      }>;
      expect(grid.props.onPointerMove).toBeUndefined();
      expect(grid.props.onPointerUp).toBeUndefined();
      expect(grid.props.onPointerCancel).toBeUndefined();
      grid.props.onClick({ currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 240, height: 160 }), focus: jest.fn() }, clientX: 90, clientY: 70, stopPropagation: jest.fn() });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ columns: 5, rows: 4 });
    } finally { id.mockRestore(); }
  });
});
