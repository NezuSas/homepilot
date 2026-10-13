import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HomeSuggestionGroup } from './HomeSuggestionGroup';
import { HomeSuggestionRow } from './HomeSuggestionRow';
import { Heading } from './ui/Heading';
import type { AssistantFinding, AssistantFindingAction } from '../stores/useAssistantStore';

const MAX_CARDS = 5;

interface DashboardInsightsSectionProps {
  findings: AssistantFinding[];
  onAction: (finding: AssistantFinding, action: AssistantFindingAction) => void;
}

export function DashboardInsightsSection({ findings, onAction }: DashboardInsightsSectionProps) {
  const { t } = useTranslation();
  if (!findings.length) return null;
  // Suggestions of one kind share a card; every finding keeps its own action inside it. Groups appear in the order of their most urgent finding.
  const unique = findings.filter((finding, index, all) => all.findIndex(item => item.id === finding.id) === index);
  const groups = unique.reduce<AssistantFinding[][]>((all, finding) => {
    const group = all.find(items => items[0]!.type === finding.type);
    if (group) group.push(finding); else all.push([finding]);
    return all;
  }, []);
  const shownGroups = groups.slice(0, MAX_CARDS);
  return <section className="homepilot-home-insights space-y-3" aria-label={t('dashboard.actionable_insights')}>
    <div>
      <Heading variant="section" as="h2">{t('dashboard.actionable_insights')}</Heading>
      <p className="mt-1 text-caption text-muted-foreground">{t('dashboard.insights_hint', { count: findings.length })}</p>
    </div>
    <div className="grid gap-2">
      {shownGroups.map(group => group.length > 1
        ? <HomeSuggestionGroup key={group[0]!.type} findings={group} onAction={onAction} />
        : <HomeSuggestionRow key={group[0]!.id} finding={group[0]!} onAction={onAction} />)}
    </div>
    {groups.length > shownGroups.length && <Link to="/assistant"
      className="inline-flex min-h-11 items-center rounded-control px-2 text-caption font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {t('assistant.view_all_findings', { count: findings.length })}
    </Link>}
  </section>;
}
