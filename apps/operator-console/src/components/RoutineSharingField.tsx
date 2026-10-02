import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { SearchInput } from './ui/Input';

interface ShareUser { id: string; name: string }
export function RoutineSharingSkeleton() {
  return <div aria-hidden="true" className="space-y-2"><div className="h-4 w-28 animate-pulse rounded bg-muted" /><div className="h-11 w-full animate-pulse rounded-control bg-muted" />{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-11 animate-pulse rounded-control bg-muted" />)}</div>;
}
export function RoutineSharingField({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(`${API_BASE_URL}/api/v1/scenes/share-users`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(await readApiError(response, t('routine_sharing.load_error')));
      const result = await response.json() as ShareUser[];
      if (!controller.signal.aborted) setUsers(result);
    }).catch((error: unknown) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : t('routine_sharing.load_error')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [t]);
  return <fieldset className="min-w-0 space-y-2 border-t border-border pt-4">
    <legend className="text-body-compact font-medium">{t('routine_sharing.scope')}</legend>
    <p className="text-caption text-muted-foreground">{t(value.length ? 'routine_sharing.shared' : 'routine_sharing.private')}</p>
    {loading ? <RoutineSharingSkeleton /> : error ? <p role="alert" className="text-caption text-danger">{error}</p> : <>
      <SearchInput label={t('routine_sharing.users')} value={query} onChange={event => setQuery(event.target.value)} className="h-11" />
      <div className="max-h-44 overflow-y-auto">
        {users.filter(user => user.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(user => <label key={user.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-caption hover:bg-muted/40">
          <input type="checkbox" checked={value.includes(user.id)} onChange={event => onChange(event.target.checked ? [...value, user.id] : value.filter(id => id !== user.id))} className="size-5 shrink-0 accent-primary" />
          <span className="break-words">{user.name}</span>
        </label>)}
      </div>
    </>}
  </fieldset>;
}
