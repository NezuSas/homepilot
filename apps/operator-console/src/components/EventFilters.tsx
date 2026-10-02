import { useTranslation } from 'react-i18next';
import { DateField } from './ui/DateField';
import { SearchInput } from './ui/Input';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { DashboardSkeletonBar } from './ui/DashboardCardSkeleton';

export interface EventFilterValues { date: string; action: string; name: string }
export const EMPTY_EVENT_FILTERS: EventFilterValues = { date: '', action: 'all', name: '' };

export function EventFiltersSkeleton() {
  return <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">{['date', 'action', 'name'].map(field => <div key={field} className="space-y-1.5"><DashboardSkeletonBar className="h-5 w-24" /><DashboardSkeletonBar className="h-11 w-full" /></div>)}</div>;
}

export function EventFilters({ value, onChange }: { value: EventFilterValues; onChange: (value: EventFilterValues) => void }) {
  const { t } = useTranslation();
  return <div className="grid min-w-0 items-end gap-3 sm:grid-cols-3 [&_label]:m-0 [&_label]:block [&_label]:text-micro [&_label]:leading-5">
    <DateField label={t('diagnostics.filters.date')} value={value.date} onChange={event => onChange({ ...value, date: event.target.value })} />
    <SearchableSelectField label={t('diagnostics.filters.action')} value={value.action} onChange={action => onChange({ ...value, action })} options={['all', 'scene', 'command', 'automation'].map(action => ({ value: action, label: t(`diagnostics.filters.${action}`) }))} className="space-y-1.5" />
    <SearchInput label={t('diagnostics.filters.name')} placeholder={t('diagnostics.filters.search_name')} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} className="h-11" />
  </div>;
}
