import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HomeSuggestionRow } from './HomeSuggestionRow';
import { Heading } from './ui/Heading';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

interface DashboardInsightsSectionProps {
  findings: AssistantFinding[];
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

export function DashboardInsightsSection({ findings, onAction }: DashboardInsightsSectionProps) {
  const { t } = useTranslation();
  if (!findings.length) return null;
  // Each actual finding keeps its own action; repeated types are not discarded.
  const representatives = findings.filter((finding, index, all) =>
    all.findIndex(item => item.id === finding.id) === index).slice(0, 5);
  return <section className="homepilot-home-insights space-y-3" aria-label={t('dashboard.actionable_insights')}>
    <div>
      <Heading variant="section" as="h2">{t('dashboard.actionable_insights')}</Heading>
      <p className="mt-1 text-caption text-muted-foreground">{t('dashboard.insights_hint', { count: findings.length })}</p>
    </div>
    <div className="grid gap-2">
      {representatives.map(finding => <HomeSuggestionRow key={finding.id} finding={finding} onAction={onAction} />)}
    </div>
    {findings.length > representatives.length && <Link to="/assistant"
      className="inline-flex min-h-11 items-center rounded-control px-2 text-caption font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {t('assistant.view_all_findings', { count: findings.length })}
    </Link>}
  </section>;
}
