import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { NativeCameraSettingsCard } from './NativeCameraSettingsCard';
import { AssistantFindingCard } from './AssistantFindingCard';
import { AssistantFindingGroupCard } from './AssistantFindingGroupCard';
import { DashboardInsightsSection } from './DashboardInsightsSection';
import { DiagnosticsResilienceSummary } from './DiagnosticsResilienceSummary';
import { DateField } from './ui/DateField';
import type { AssistantFinding } from '../stores/useAssistantStore';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const noop = () => {};
const finding: AssistantFinding = { id: 'f', type: 'habit_pattern_detected', title: '', description: '', severity: 'medium',
  relatedEntityId: 'd', relatedEntityType: 'device', status: 'open', score: 1, metadata: { deviceName: 'Speaker', timeWindow: '00:00' },
  actions: [{ type: 'configure_automation', label: 'assistant.actions.create_automation' }, { type: 'ignore', label: 'assistant.actions.ignore' }] };
describe('Feature: Compact system presentation (AC59)', () => {
  it('renders the same finding component in Home and Assistant with recorded evidence', () => {
    const card = renderToStaticMarkup(<AssistantFindingCard finding={finding} onAction={noop} />);
    const home = renderToStaticMarkup(<MemoryRouter><DashboardInsightsSection findings={Array.from({ length: 7 }, (_, i) => ({ ...finding, id: `finding-${i}` }))} onAction={noop} /></MemoryRouter>);
    expect(card).toContain('assistant.evidence.habit_window');
    expect(home.match(/assistant.evidence.habit_window/g)).toHaveLength(5);
    expect(home).toContain('href="/assistant"');
    expect(card).toContain('assistant.actions.create_automation');
  });
  it('groups without hiding individual actions when expanded and exposes disclosure semantics', () => {
    const group = { id: 'g', type: finding.type, subGroups: [{ name: 'Speaker', findings: [finding, { ...finding, id: 'f2' }] }], actions: [] };
    const props = { group, onToggleGroup: noop, onImportAll: noop, onAction: noop, onDismiss: noop };
    expect(renderToStaticMarkup(<AssistantFindingGroupCard {...props} isExpanded={false} />)).toContain('aria-expanded="false"');
    const expanded = renderToStaticMarkup(<AssistantFindingGroupCard {...props} isExpanded />);
    expect(expanded.match(/assistant.actions.create_automation/g)).toHaveLength(2);
  });
  it('keeps camera configuration actions named and omits live playback', () => {
    const html = renderToStaticMarkup(<NativeCameraSettingsCard camera={{ deviceId: 'c', homeId: 'h', sourceType: 'rtsp-dvr', name: 'Patio', host: '192.0.2.1', rtspPort: 554, onvifPort: 80, rtspPath: '/stream', enabled: true, createdAt: '' }} onEdit={noop} onDelete={noop} />);
    expect(html).toContain('aria-label="common.edit: Patio"');
    expect(html).toContain('aria-label="common.delete: Patio"');
    expect(html).toContain('/stream');
    expect(html).not.toMatch(/<video|<img/);
  });
  it('counts HA-backed resources instead of reporting native autonomy as zero', () => {
    const html = renderToStaticMarkup(<DiagnosticsResilienceSummary devices={[]} scenes={[{}, {}]} automations={[{}]} />);
    expect(html).toContain('diagnostics.metrics.scenes');
    expect(html).toContain('diagnostics.metrics.automations');
    expect(html).toContain('>2</span>');
    expect(html).not.toContain('hardware_autonomy');
  });
  it('keeps a labelled native date control and visible empty guidance', () => {
    const html = renderToStaticMarkup(<DateField label="Fecha" value="" onChange={noop} />);
    expect(html).toContain('type="date"');
    expect(html).toContain('diagnostics.filters.choose_date');
    expect(renderToStaticMarkup(<DateField label="Fecha" value="2026-10-01" onChange={noop} />)).not.toContain('diagnostics.filters.choose_date');
  });
});
