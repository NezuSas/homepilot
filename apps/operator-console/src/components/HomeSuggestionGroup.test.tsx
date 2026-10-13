import { renderToStaticMarkup } from 'react-dom/server';
import type { AssistantFinding } from '../stores/useAssistantStore';
import { HomeSuggestionGroup } from './HomeSuggestionGroup';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { count?: number }) => values?.count === undefined ? key : `${key}:${values.count}`, i18n: { language: 'es' } }) }));

const finding = (id: string, name: string): AssistantFinding => ({
  id, type: 'habit_pattern_detected', severity: 'medium', title: '', description: '', relatedEntityType: 'device', relatedEntityId: id,
  status: 'open', score: 1, metadata: { deviceName: name },
  actions: [{ type: 'configure_automation', label: 'assistant.actions.create_automation' }],
});

describe('Feature: Home suggestion group', () => {
  it('shows one closed card that names the first devices and how many are left, without repeating the actions', () => {
    const html = renderToStaticMarkup(<HomeSuggestionGroup onAction={() => undefined}
      findings={['Altavoz', 'Lámpara', 'Enchufe', 'Ventilador', 'Sensor'].map((name, index) => finding(`f${index}`, name))} />);
    expect(html).toContain('aria-label="assistant.types.habit_pattern_detected"');
    expect(html).toContain('dashboard.insights_group_count:5');
    expect(html).toContain('Altavoz, Lámpara, Enchufe y dashboard.insights_more:2');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('assistant.actions.create_automation');
  });
});
