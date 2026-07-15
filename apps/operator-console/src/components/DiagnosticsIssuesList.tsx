import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

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
      <h3 className="text-micro font-black tracking-widest uppercase text-muted-foreground opacity-50">{t('diagnostics.active_issues')}</h3>
      {issues.map((issue, index) => (
        <div key={`${issue.code}-${index}`} className={cn(
          "flex items-start gap-4 p-4 rounded-xl border",
          issue.severity === 'critical' ? "border-destructive/50 bg-destructive/5 text-destructive" : "border-warning/50 bg-warning/5 text-warning"
        )}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="uppercase font-mono text-label tracking-widest font-bold">{t(`diagnostics.issues.${issue.code}`, { defaultValue: issue.code }) as string}</span>
            <span className="text-body">{t(issue.message)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
