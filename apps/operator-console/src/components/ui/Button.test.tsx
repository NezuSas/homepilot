import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, type ButtonProps } from './Button';

const variants: NonNullable<ButtonProps['variant']>[] = ['primary', 'secondary', 'outline', 'ghost', 'danger', 'warning'];
const sizes: NonNullable<ButtonProps['size']>[] = ['xs', 'sm', 'md', 'lg'];

function render(props: ButtonProps = {}) {
  return renderToStaticMarkup(React.createElement(Button, props, 'Guardar'));
}

describe('Feature: Standard action button (AC79)', () => {
  it.each(variants.flatMap(variant => sizes.map(size => ({ variant, size }))))(
    'Scenario: $variant / $size shares the single geometry and typography',
    props => {
      const markup = render(props);
      for (const token of ['!min-h-11', '!rounded-control', '!px-4', '!py-2.5', '!gap-2', '!font-sans', '!text-body-compact', '!font-semibold', '!leading-5', '!tracking-normal', '!normal-case']) {
        expect(markup).toContain(token);
      }
      expect(markup).not.toContain('interactive-lift');
      expect(markup).toContain('[&amp;&gt;svg]:!h-4');
    }
  );

  it('Scenario: historical sizes are identical compatibility aliases', () => {
    expect(new Set(sizes.map(size => render({ size }))).size).toBe(1);
  });

  it('Scenario: compatibility markup includes the standard important utilities', () => {
    const markup = render({ className: 'w-full sm:rounded-full rounded-panel h-8 px-8 text-micro font-black uppercase tracking-widest' });
    expect(markup).toContain('w-full');
    for (const token of ['!rounded-control', '!h-auto', '!min-h-11', '!px-4', '!text-body-compact', '!font-semibold', '!normal-case', '!tracking-normal']) {
      expect(markup).toContain(token);
    }
  });

  it('Scenario: an icon-only action shares the geometry with a square footprint', () => {
    const markup = render({ size: 'icon', 'aria-label': 'Guardar' });
    expect(markup).toContain('!w-11');
    expect(markup).toContain('!h-11');
    expect(markup).toContain('!rounded-control');
    expect(markup).toContain('aria-label="Guardar"');
  });

  it('Scenario: loading disables the action and preserves its accessible name', () => {
    const markup = render({ isLoading: true });
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('Guardar');
    expect(markup).toContain('focus-visible:ring-2');
  });

  it('Scenario: native form attributes and disabled behavior remain unchanged', () => {
    const markup = render({ type: 'submit', disabled: true, name: 'save', value: 'yes' });
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('name="save"');
    expect(markup).toContain('value="yes"');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('aria-busy');
  });
});
