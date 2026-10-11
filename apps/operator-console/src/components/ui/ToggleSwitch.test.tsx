import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToggleSwitch } from './ToggleSwitch';

describe('Feature: Modular toggle appearance and accessibility (REQ-32)', () => {
  it.each(['sm', 'md'] as const)('Scenario: legacy %s shares one 44px touch target and 32px track', size => {
    const html = renderToStaticMarkup(<ToggleSwitch size={size} checked label="Ejemplo" onCheckedChange={() => {}} isLoading />);
    expect(html).toContain('h-11 w-14');
    expect(html).toContain('homepilot-toggle-track');
    expect(html).toContain('h-8');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('motion-reduce:animate-none');
  });
  it.each([false, true])('Scenario: State %s remains explicit and named in either theme', checked => {
    const html = renderToStaticMarkup(React.createElement(ToggleSwitch, { checked, label: 'Automatic appearance', onCheckedChange: () => {} }));
    expect(html).toContain('role="switch"');
    expect(html).toContain(`aria-checked="${checked}"`);
    expect(html).toContain(`data-state="${checked ? 'checked' : 'unchecked'}"`);
    expect(html).toContain('aria-label="Automatic appearance"');
    expect(html).not.toContain('disabled=""');
  });
  it('Scenario: Off and disabled are independent states', () => {
    const html = renderToStaticMarkup(React.createElement(ToggleSwitch, { checked: false, disabled: true, label: 'Unavailable', onCheckedChange: () => {} }));
    expect(html).toContain('data-state="unchecked"');
    expect(html).toContain('disabled=""');
  });
});
