import { Cable, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModbusConnection, ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { Button } from './ui/Button';
import { LoadingState } from './ui/LoadingState';
import { DashboardSkeletonBar as Bar } from './ui/DashboardCardSkeleton';

export type ModbusConnectionSummary = ModbusConnection & { variables: ModbusVariable[] };
export function ModbusConnectionCard({ connection, onEdit, onAdd, onVariable }: {
  connection: ModbusConnectionSummary; onEdit: () => void; onAdd: () => void; onVariable: (variable: ModbusVariable) => void;
}) {
  const { t } = useTranslation();
  return <section aria-label={connection.name} className="min-w-0 rounded-section border border-border bg-card p-4 text-card-foreground">
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3"><Cable aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <div className="min-w-0"><h2 className="break-words font-semibold">{connection.name}</h2><p className="break-words text-caption text-muted-foreground">{connection.host}:{connection.port} · {t('modbus.unitId')} {connection.unitId}</p></div>
      </div>
      <div className="flex items-center justify-between gap-3"><span className="text-caption text-muted-foreground">{t(connection.enabled ? 'modbus.enabled' : 'modbus.disabled')}</span>
        <Button variant="secondary" size="lg" onClick={onEdit}><Settings aria-hidden="true" className="size-4" />{t('modbus.configure')}</Button>
      </div>
    </div>
    {connection.variables.length ? <ul className="mt-3 divide-y divide-border border-t border-border">{connection.variables.map(variable => <li key={variable.deviceId} className="flex flex-wrap items-center gap-2 py-2">
      <div className="min-w-0 flex-1"><p className="break-words text-body-compact font-medium">{variable.name}</p><p className="break-words text-caption text-muted-foreground">{variable.symbolicAddress ? `${variable.symbolicAddress} · ` : ''}{t(`modbus.${variable.area}`)} · {variable.address} · {variable.dataType} · {t(variable.writable ? 'modbus.write_allowed' : 'modbus.read_only')}</p></div>
      <Button variant="ghost" size="lg" aria-label={t('modbus.edit_variable', { name: variable.name })} onClick={() => onVariable(variable)}>{t('modbus.configure')}</Button>
    </li>)}</ul> : <p className="my-3 text-caption text-muted-foreground">{t('modbus.no_variables')}</p>}
    <Button variant="outline" size="lg" onClick={onAdd}>{t('modbus.add_variable')}</Button>
  </section>;
}
export function ModbusConnectionCardSkeleton() {
  return <div className="min-w-0 rounded-section border border-border bg-card p-4"><div className="flex gap-3"><Bar className="size-5" /><div className="flex-1 space-y-2"><Bar className="h-5 w-40 max-w-full" /><Bar className="h-4 w-48 max-w-full" /></div><Bar className="h-11 w-28" /></div><div className="mt-3 space-y-3 border-t border-border pt-3"><Bar className="h-11 w-full" /><Bar className="h-11 w-full" /><Bar className="h-11 w-36" /></div></div>;
}
export function ModbusSettingsSkeleton({ label, className }: { label: string; className?: string }) {
  return <LoadingState label={label} className={className}><Bar className="h-8 w-48" /><div className="grid gap-4 lg:grid-cols-2"><ModbusConnectionCardSkeleton /><ModbusConnectionCardSkeleton /></div></LoadingState>;
}
