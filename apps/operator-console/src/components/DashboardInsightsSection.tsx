import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AssistantFindingCard } from './AssistantFindingCard';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface DashboardInsightsSectionProps {
  findings: AssistantFinding[];
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

export function DashboardInsightsSection({ findings, onAction }: DashboardInsightsSectionProps) {
  const { t } = useTranslation();
  if (!findings.length) return null;
  // Prefer different recommendation types in the limited Home summary.
  const representatives = findings.filter((finding, index, all) =>
    all.findIndex(item => item.type === finding.type) === index).slice(0, 2);
  return <section className="homepilot-home-insights space-y-3" aria-label={t('dashboard.actionable_insights')}>
    <h2 className="text-section-title font-bold text-foreground">{t('dashboard.actionable_insights')}</h2>
    <div className="grid gap-3 md:grid-cols-2">
      {representatives.map(finding => <AssistantFindingCard key={finding.id} finding={finding} onAction={onAction} />)}
    </div>
    {findings.length > representatives.length && <Link to="/assistant"
      className="inline-flex min-h-11 items-center rounded-control px-2 text-caption font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {t('assistant.view_all_findings', { count: findings.length })}
    </Link>}
  </section>;
}
