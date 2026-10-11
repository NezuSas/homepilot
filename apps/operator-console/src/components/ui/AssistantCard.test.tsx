import { renderToStaticMarkup } from 'react-dom/server';
import { Lightbulb } from 'lucide-react';
import { AssistantCard } from './AssistantCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}));

const isForwardRef = (component: unknown) => (component as { $$typeof?: symbol }).$$typeof === Symbol.for('react.forward_ref');
const props = { icon: Lightbulb, category: 'Energía', title: 'Luz encendida', description: 'Lleva horas encendida' };

describe('Feature: AssistantCard recommendation card (modular contract C1-C4)', () => {
  it('renders title, category and description as a labelled region', () => {
    const html = renderToStaticMarkup(<AssistantCard {...props} />);
    for (const text of ['Luz encendida', 'Energía', 'Lleva horas encendida']) expect(html).toContain(text);
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toMatch(/aria-describedby="[^"]+"/);
  });

  it('does not repeat the category when it equals the title', () => {
    const html = renderToStaticMarkup(<AssistantCard {...props} category="Luz encendida" />);
    expect(html.match(/Luz encendida/g)).toHaveLength(1);
  });

  it('shows a severity badge only when a severity is set', () => {
    expect(renderToStaticMarkup(<AssistantCard {...props} severity="high" />)).toContain('high');
    expect(renderToStaticMarkup(<AssistantCard {...props} />)).not.toContain('tracking-label');
  });

  it('renders children and actions when provided', () => {
    const html = renderToStaticMarkup(<AssistantCard {...props} actions={<button type="button">Apagar</button>}>Extra</AssistantCard>);
    expect(html).toContain('Apagar');
    expect(html).toContain('Extra');
  });

  it('hides a dismissed card from assistive tech', () => {
    expect(renderToStaticMarkup(<AssistantCard {...props} isDismissed />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<AssistantCard {...props} />)).not.toContain('aria-hidden="true"><div');
  });

  it('merges a consumer className, forwards attributes and refs', () => {
    const html = renderToStaticMarkup(<AssistantCard {...props} className="extra" data-finding="1" />);
    expect(html).toContain('extra');
    expect(html).toContain('data-finding="1"');
    expect(isForwardRef(AssistantCard)).toBe(true);
  });
});
