import { renderToStaticMarkup } from 'react-dom/server';
import { SectionActionCard } from './SectionActionCard';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../components/IconPicker', () => ({ getDashboardIconComponent: () => () => null }));

const card = (actionFeedback?: 'pending' | 'success' | 'error') => renderToStaticMarkup(
  <SectionActionCard kind="action" title="CMDPLC 1" isAssigned onAction={() => {}} momentaryCommand actionFeedback={actionFeedback} />);

describe('Feature: a momentary PLC command tells the person what happened', () => {
  it('Scenario: Given a PLC pulse at rest When shown Then it offers to run', () => {
    expect(card()).toContain('dashboards.widgets.action_button.execute');
  });

  it('Scenario: Given the pulse is running When shown Then it says it is running and cannot be pressed again', () => {
    const html = card('pending');
    expect(html).toContain('dashboards.widgets.action_button.pending');
    expect(html).toContain('disabled=""');
  });

  it('Scenario: Given the pulse went out When shown Then it says sent, yet stays a momentary tile that is ready again', () => {
    const html = card('success');
    expect(html).toContain('dashboards.widgets.action_button.sent');
    expect(html).toContain('data-action-state="idle"');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('disabled=""');
  });

  it('Scenario: Given the pulse failed When shown Then the error is shown, never "sent"', () => {
    const html = card('error');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('dashboards.widgets.action_button.sent');
  });
});
