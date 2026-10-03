import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardPreviewFrame } from './CardPreviewFrame';

describe('Feature: Stable full-grid card preview (AC48)', () => {
  it.each([2, 12])('Scenario: A %s-column card keeps the full eight-row preview stage', columns => {
    const html = renderToStaticMarkup(React.createElement(CardPreviewFrame, { label: 'Preview', children: React.createElement('div', { style: { width: columns * 20 } }, 'Actual presenter') }));
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Preview"');
    expect(html).toContain('height:216px');
    expect(html).toContain(`width:${columns * 20}px`);
    expect(html).toContain('Actual presenter');
  });
});
