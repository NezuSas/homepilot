import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertBanner } from './ui/AlertBanner';
import { Heading } from './ui/Heading';

interface DiagnosticsIssue {
  code: string;
  severity: 'warning' | 'critical';
  message: string;
}

interface DiagnosticsIssuesListProps {
  issues: DiagnosticsIssue[];
}

export const DiagnosticsIssuesList: React.FC<DiagnosticsIssuesListProps> = ({ issues }) => {
  const { t } = useTranslation();

  if (!Array.isArray(issues) || issues.length === 0) return null;

  return (
    <div className="space-y-3">
      <Heading variant="label" as="h3">{t('diagnostics.active_issues')}</Heading>
      {issues.map((issue, index) => (
        <AlertBanner
          key={`${issue.code}-${index}`}
          variant={issue.severity === 'critical' ? 'danger' : 'warning'}
          size="sm"
          title={t(`diagnostics.issues.${issue.code}`, { defaultValue: issue.code }) as string}
          message={t(issue.message)}
        />
      ))}
    </div>
  );
};
