import { renderToStaticMarkup } from 'react-dom/server';
import { AutomationBuilderActionSection } from './AutomationBuilderActionSection';
import type { AutomationBuilderDevice } from './AutomationBuilderTypes';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'es' } }) }));
jest.mock('../stores/useDeviceSnapshotStore', () => ({ useDeviceSnapshotStore: () => ({}) }));

const devices: AutomationBuilderDevice[] = [
  { id: 'tv-button', name: 'On/Off tv', type: 'button', semanticType: 'light', capabilities: [{ type: 'button', name: 'Button', commands: [{ name: 'press' }] }] },
  { id: 'read-only-sensor', name: 'Temperature', type: 'sensor', capabilities: [{ type: 'sensor', name: 'Sensor', commands: [] }] },
];

describe('automation action command selection', () => {
  it('shows the real momentary command for a semantically relabeled button', () => {
    const html = renderToStaticMarkup(
      <AutomationBuilderActionSection
        devices={devices}
        scenes={[]}
        actionType="device_command"
        actionConfig={{ targetDeviceId: 'tv-button', command: 'press' }}
        onActionTypeChange={() => {}}
        onActionConfigChange={() => {}}
      />,
    );

    expect(html).toContain('On/off tv');
    expect(html).toContain('automations.builder.commands.press');
    expect(html).not.toContain('Temperature');
    expect(html).not.toContain('automations.builder.commands.turn_on');
  });
});
