import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardPreviewFrame, getPreviewScale } from './CardPreviewFrame';

describe('Feature: Stable full-grid card preview (AC48)', () => {
  it('Scenario: Wide and intrinsically tall previews fit uniformly without changing card dimensions', () => {
    expect(getPreviewScale(400, 800, 216)).toBe(0.5);
    expect(getPreviewScale(400, 300, 432)).toBe(0.5);
    expect(getPreviewScale(800, 400, 216)).toBe(1);
  });
  it.each([2, 12])('Scenario: A %s-column card keeps the full eight-row preview stage', columns => {
    const html = renderToStaticMarkup(React.createElement(CardPreviewFrame, { label: 'Preview', children: React.createElement('div', { style: { width: columns * 20 } }, 'Actual presenter') }));
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Preview"');
    expect(html).toContain('height:216px');
    expect(html).toContain(`width:${columns * 20}px`);
    expect(html).toContain('Actual presenter');
  });
});
