import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Blinds, CheckCircle2, Cloud, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';

interface TuyaStatus { configured: boolean; endpoint: string; clientIdHint: string; userUidHint: string; updatedAt: string | null; }
interface Home { id: string; name: string; }
interface Cover { id: string; name: string; category: string; online: boolean; }

export const TuyaSettingsView = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TuyaStatus | null>(null);
  const [homes, setHomes] = useState<Home[]>([]);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [form, setForm] = useState({ endpoint: '', clientId: '', clientSecret: '', userUid: '' });
  const [homeId, setHomeId] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'covers' | string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [statusResponse, homesResponse] = await Promise.all([apiFetch(`${API_BASE_URL}/api/v1/integrations/tuya/status`), apiFetch(`${API_BASE_URL}/api/v1/homes`)]);
      if (!statusResponse.ok || !homesResponse.ok) throw new Error('load');
      const nextStatus = await statusResponse.json() as TuyaStatus;
      const nextHomes = await homesResponse.json() as Home[];
      setStatus(nextStatus); setHomes(nextHomes); setHomeId((current) => current || nextHomes[0]?.id || '');
      setForm((current) => ({ ...current, endpoint: current.endpoint || nextStatus.endpoint }));
    } catch { setNotice({ type: 'error', text: t('tuya.messages.load_error') }); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const request = async (url: string, method: 'POST' | 'PUT') => apiFetch(`${API_BASE_URL}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
  const handleSave = async (event: FormEvent) => { event.preventDefault(); setBusy('save'); setNotice(null); try { const response = await request('/api/v1/integrations/tuya/settings', 'PUT'); if (!response.ok) throw new Error('save'); setForm((current) => ({ ...current, clientSecret: '' })); setNotice({ type: 'success', text: t('tuya.messages.save_success') }); await load(); } catch { setNotice({ type: 'error', text: t('tuya.messages.save_error') }); } finally { setBusy(null); } };
  const handleTest = async () => { setBusy('test'); setNotice(null); try { const response = await request('/api/v1/integrations/tuya/test', 'POST'); if (!response.ok) throw new Error('test'); setNotice({ type: 'success', text: t('tuya.messages.test_success') }); } catch { setNotice({ type: 'error', text: t('tuya.messages.test_error') }); } finally { setBusy(null); } };
  const loadCovers = async () => { setBusy('covers'); try { const response = await apiFetch(`${API_BASE_URL}/api/v1/integrations/tuya/covers`); if (!response.ok) throw new Error('covers'); setCovers(await response.json() as Cover[]); } catch { setNotice({ type: 'error', text: t('tuya.messages.covers_error') }); } finally { setBusy(null); } };
  const importCover = async (cover: Cover) => { if (!homeId) return; setBusy(cover.id); try { const response = await apiFetch(`${API_BASE_URL}/api/v1/integrations/tuya/covers/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homeId, sourceId: cover.id, name: cover.name }) }); if (!response.ok) throw new Error('import'); setNotice({ type: 'success', text: t('tuya.messages.import_success', { name: cover.name }) }); } catch { setNotice({ type: 'error', text: t('tuya.messages.import_error', { name: cover.name }) }); } finally { setBusy(null); } };

  return <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
    <Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Cloud className="h-6 w-6" /></div><div><h1 className="text-title font-semibold">{t('tuya.title')}</h1><p className="text-body text-muted-foreground">{t('tuya.subtitle')}</p></div></div><div className="flex items-center gap-2 text-caption text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" />{t('tuya.local_only')}</div></div></Card>
    {notice && <div className={notice.type === 'success' ? 'rounded-xl border border-success/30 bg-success/10 p-3 text-body text-success' : 'rounded-xl border border-danger/30 bg-danger/10 p-3 text-body text-danger'}>{notice.text}</div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><Card className="p-6"><form onSubmit={handleSave} className="space-y-4"><h2 className="text-section font-semibold">{t('tuya.connection_title')}</h2><Input label={t('tuya.endpoint')} value={form.endpoint} onChange={(event) => setForm({ ...form, endpoint: event.target.value })} placeholder="https://openapi.tuyaus.com" required /><Input label={t('tuya.client_id')} value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} placeholder={status?.clientIdHint || ''} required /><Input label={t('tuya.client_secret')} type="password" value={form.clientSecret} onChange={(event) => setForm({ ...form, clientSecret: event.target.value })} placeholder={status?.configured ? t('tuya.secret_unchanged') : ''} required={!status?.configured} /><Input label={t('tuya.user_uid')} value={form.userUid} onChange={(event) => setForm({ ...form, userUid: event.target.value })} placeholder={status?.userUidHint || ''} required /><div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={handleTest} disabled={busy !== null}><RefreshCw className={busy === 'test' ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />{t('tuya.test')}</Button><Button type="submit" disabled={busy !== null}><Save className="mr-2 h-4 w-4" />{t('tuya.save')}</Button></div></form></Card>
      <Card className="p-6"><h2 className="text-section font-semibold">{t('tuya.requirements_title')}</h2><ol className="mt-4 space-y-3 text-body text-muted-foreground"><li>1. {t('tuya.requirement_project')}</li><li>2. {t('tuya.requirement_authorize')}</li><li>3. {t('tuya.requirement_import')}</li></ol></Card></div>
    <Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-section font-semibold">{t('tuya.covers_title')}</h2><p className="text-body text-muted-foreground">{t('tuya.covers_subtitle')}</p></div><div className="flex gap-2"><SearchableSelectField label={t('tuya.target_home')} value={homeId} onChange={setHomeId} options={homes.map((home) => ({ value: home.id, label: home.name }))} placeholder={t('tuya.select_home')} size="small" className="min-w-52" /><Button type="button" onClick={loadCovers} disabled={busy !== null}><RefreshCw className={busy === 'covers' ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />{t('tuya.load_covers')}</Button></div></div>{covers.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{covers.map((cover) => <div key={cover.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><Blinds className="h-5 w-5 text-primary" /><span className={cover.online ? 'text-caption text-success' : 'text-caption text-muted-foreground'}>{cover.online ? t('tuya.online') : t('tuya.offline')}</span></div><p className="mt-3 truncate font-medium">{cover.name}</p><p className="text-caption text-muted-foreground">{cover.category}</p><Button className="mt-4 w-full" size="sm" onClick={() => importCover(cover)} disabled={busy !== null || !homeId}>{busy === cover.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-2 h-4 w-4" />{t('tuya.import')}</>}</Button></div>)}</div>}</Card>
  </div>;
};