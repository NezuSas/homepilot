import { renderToStaticMarkup } from 'react-dom/server';
import { AutomationRuleCard } from './AutomationRuleCard';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../views/dashboards/components/IconPicker', () => ({ getDashboardIconComponent: () => null }));
const props = {
  rule: { id: 'rule', name: 'Trabajo', enabled: false, trigger: { type: 'time' as const, timeLocal: '19:00' }, action: { type: 'execute_scene' as const, sceneId: 'scene' } },
  devices: [], scenes: [], processingId: null, getDeviceName: () => 'Luz', getSceneName: () => 'Trabajo',
  onToggle: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn(), onToggleFavorite: jest.fn(), onExecute: jest.fn(),
  isFavorite: false, isExecuting: false, isExecutionBusy: false, isSuccessful: false,
};
describe('Feature: Compact automation cards (AC50)', () => {
  it('keeps shared execution and favorites available without edit/delete or schedule changes', () => {
    const html = renderToStaticMarkup(<AutomationRuleCard {...props} canManage={false} />);
    expect(html).toContain('automations.execute_now');
    expect(html).toContain('automations.add_favorite');
    expect(html).not.toContain('aria-label="common.edit"');
    expect(html).not.toContain('aria-label="common.delete"');
    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });
  it('renders an article with separate execution, scheduling and management controls', () => {
    const html = renderToStaticMarkup(<AutomationRuleCard {...props} />);
    expect(html).toMatch(/^<article aria-labelledby=/);
    expect(html.match(/<button /g)).toHaveLength(5);
    expect(html).toContain('automations.execute_now');
    expect(html).toContain('aria-label="automations.toggle_schedule"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="common.edit"');
    expect(html).toContain('aria-label="common.delete"');
    expect(html).not.toContain('automations.summary.resilience');
    expect(props.onExecute).not.toHaveBeenCalled();
  });
  it('keeps paused schedules manually executable and disables only execution while running', () => {
    expect(renderToStaticMarkup(<AutomationRuleCard {...props} />)).not.toContain('disabled=""');
    const html = renderToStaticMarkup(<AutomationRuleCard {...props} isExecuting isExecutionBusy />);
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).toContain('aria-busy="true"');
  });
  it('announces success independently of schedule and favorite state', () => {
    const html = renderToStaticMarkup(<AutomationRuleCard {...props} isSuccessful isFavorite />);
    expect(html).toContain('role="status" aria-live="polite">automations.executed');
    expect(html).toContain('automations.summary.paused');
    expect(html).toContain('automations.remove_favorite');
  });
});
