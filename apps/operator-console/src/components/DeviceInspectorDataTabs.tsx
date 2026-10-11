import { useTranslation } from 'react-i18next';
import { Clock, Terminal } from 'lucide-react';
import type { ActivityLog, InspectableDevice } from './deviceInspectorTypes';

export function DeviceInspectorLogsTab({ logs }: { logs: ActivityLog[] }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      {Array.isArray(logs) && logs.map((log, index) => (
        <div key={index} className="p-3 bg-muted/10 border border-border/20 rounded-control flex flex-col gap-2 group hover:bg-muted/20 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-micro font-black px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-tighter">
              {t(`common.events.${log.type}`, { defaultValue: log.type })}
            </span>
            <span className="text-micro font-mono opacity-40 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString(i18n.language)}
            </span>
          </div>
          <p className="text-caption font-bold leading-tight mt-1 text-card-foreground/80">{t(`audit_logs.messages.${log.description === 'Device synchronized from Home Assistant WebSocket' ? 'DEVICE_SYNC' : log.type}`, { ...log.data, defaultValue: log.description })}</p>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="text-center py-8 flex flex-col items-center justify-center text-muted-foreground">
          <Terminal className="w-12 h-12 mb-4" />
          <div className="text-caption font-black uppercase tracking-label">{t('inbox.inspector.no_logs')}</div>
        </div>
      )}
    </div>
  );
}

export function DeviceInspectorStateTab({ device }: { device: InspectableDevice }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 h-full">
      <div className="flex-1 rounded-dashboard border border-white/5 bg-background p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-4 right-8 text-micro font-black font-mono opacity-20 tracking-widest group-hover:opacity-40 transition-opacity">{t('inbox.inspector.json_parser_hint')}</div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <pre className="text-label font-mono text-success overflow-auto h-full leading-relaxed custom-scrollbar relative z-10 selection:bg-primary/30">
          {JSON.stringify(device.lastKnownState, null, 4)}
        </pre>
      </div>
    </div>
  );
}
