import { renderToStaticMarkup } from 'react-dom/server';
import { RangeInput } from './RangeInput';

const noop = () => undefined;
const isForwardRef = (component: unknown) => (component as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');

describe('Feature: RangeInput slider primitive (modular contract C1-C4)', () => {
  it('renders a native range input with its bounds, step and value', () => {
    const html = renderToStaticMarkup(<RangeInput value={40} min={0} max={100} step={5} onValueChange={noop} aria-label="Brillo" />);
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="100"');
    expect(html).toContain('step="5"');
    expect(html).toContain('value="40"');
    expect(html).toContain('aria-label="Brillo"');
  });

  it('shows formatted bounds only when requested', () => {
    const hidden = renderToStaticMarkup(<RangeInput value={40} min={0} max={100} formatValue={(v) => `${v} %`} onValueChange={noop} />);
    expect(hidden).not.toContain('100 %');
    const shown = renderToStaticMarkup(<RangeInput value={40} min={0} max={100} showBounds formatValue={(v) => `${v} %`} onValueChange={noop} />);
    expect(shown).toContain('0 %');
    expect(shown).toContain('100 %');
  });

  it('disables the control and forwards refs', () => {
    expect(renderToStaticMarkup(<RangeInput value={1} min={0} max={2} disabled onValueChange={noop} />)).toContain('disabled');
    expect(isForwardRef(RangeInput)).toBe(true);
  });

  it('merges a consumer className', () => {
    expect(renderToStaticMarkup(<RangeInput value={1} min={0} max={2} className="extra-x" onValueChange={noop} />)).toContain('extra-x');
  });
});
