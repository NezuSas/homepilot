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
    expect(html.match(/role="gridcell"/g)).toHaveLength(144);
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
});
