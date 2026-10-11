import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from '../ui/ToggleSwitch';
import type { ViewConfigUser } from './viewConfigModel';

interface DashboardViewVisibilityTabProps {
  users: ViewConfigUser[];
  loadingUsers: boolean;
  allowedUsers: string[];
  onUserToggle: (userId: string, checked: boolean) => void;
}

export function DashboardViewVisibilityTab({ users, loadingUsers, allowedUsers, onUserToggle }: DashboardViewVisibilityTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <p className="text-body text-foreground">{t('dashboards.editor.visibility_hint')}</p>
      {loadingUsers ? (
        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar pr-1">
          {users.map(user => {
            const isChecked = allowedUsers.includes(user.id);
            const userLabel = user.displayName || user.username;
            return (
              <div key={user.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-muted/10 px-3 py-2.5 transition-colors hover:bg-muted/35">
                <span className="text-body font-bold">{userLabel}</span>
                <ToggleSwitch
                  checked={isChecked}
                  onCheckedChange={checked => onUserToggle(user.id, checked)}
                  label={userLabel}
                  size="sm"
                />
              </div>
            );
          })}
          {users.length === 0 && (
            <div className="text-center py-8 text-caption text-muted-foreground">{t('dashboards.view_config.no_other_users')}</div>
          )}
        </div>
      )}
    </div>
  );
}
