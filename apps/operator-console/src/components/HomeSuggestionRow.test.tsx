import { renderToStaticMarkup } from 'react-dom/server';
import type { AssistantFinding } from '../stores/useAssistantStore';
import { HomeSuggestionRow } from './HomeSuggestionRow';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const finding = (severity: AssistantFinding['severity']): AssistantFinding => ({
  id: 'f1', type: 'habit_pattern_detected', severity, title: '', description: '', relatedEntityType: 'device', relatedEntityId: 'd1',
  status: 'open', score: 1, metadata: { deviceName: 'Altavoz estudio' },
  actions: [{ type: 'configure_automation', label: 'assistant.actions.create_automation' }, { type: 'ignore', label: 'assistant.actions.ignore' }],
});

describe('Feature: Home suggestion row', () => {
  it('names the device, the kind of suggestion and both ways to act', () => {
    const html = renderToStaticMarkup(<HomeSuggestionRow finding={finding('medium')} onAction={() => undefined} />);
    expect(html).toContain('aria-label="Altavoz estudio"');
    expect(html).toContain('assistant.types.habit_pattern_detected');
    expect(html).toContain('assistant.actions.create_automation');
    expect(html).toContain('assistant.actions.ignore');
    expect(html).not.toContain('assistant.severities.high');
  });

  it('marks only the high-priority ones', () => {
    expect(renderToStaticMarkup(<HomeSuggestionRow finding={finding('high')} onAction={() => undefined} />)).toContain('assistant.severities.high');
  });
});
