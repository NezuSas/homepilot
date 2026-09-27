import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Home, MonitorSmartphone, Plus, RefreshCw } from 'lucide-react';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { LoadingState } from '../components/ui/LoadingState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { RangeInput } from '../components/ui/RangeInput';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import { DeviceInspector } from '../components/DeviceInspector';
import { androidDisplayApi, AndroidDisplayApiError, type AndroidDisplaySource, type AndroidDisplayTestResult } from '../lib/androidDisplayApi';
import { displayIssue, duplicateKind, validPrivateIpv4, type DisplayIssue } from '../lib/androidDisplayUi';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';

function issueFrom(error: unknown, duplicate: DisplayIssue | null = null): DisplayIssue {
  return displayIssue(error instanceof AndroidDisplayApiError ? error.code : '', duplicate);
}

export function AndroidDisplaysView() {
  const { t } = useTranslation();
  const homes = useDeviceSnapshotStore(state => state.homes);
  const devices = useDeviceSnapshotStore(state => state.devices);
  const roomsByHome = useDeviceSnapshotStore(state => state.roomsByHome);
  const refreshSnapshot = useDeviceSnapshotStore(state => state.refreshSnapshot);
  const upsertDevice = useDeviceSnapshotStore(state => state.upsertDevice);
  const [homeId, setHomeId] = useState('');
  const [displays, setDisplays] = useState<AndroidDisplaySource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'test' | 'adopt' | 'refresh' | 'command' | null>(null);
  const [issue, setIssue] = useState<DisplayIssue | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5555');
  const [test, setTest] = useState<AndroidDisplayTestResult | null>(null);
  const [testedEndpoint, setTestedEndpoint] = useState('');
  const [volumeDraft, setVolumeDraft] = useState(50);
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeInFlight = useRef(false);
  const lastVolume = useRef<number | null>(null);

  useEffect(() => { void refreshSnapshot(); }, [refreshSnapshot]);
  useEffect(() => {
    if (!homes.some(home => home.id === homeId)) setHomeId(homes[0]?.id ?? '');
  }, [homes, homeId]);

  useEffect(() => {
    setDisplays([]); setSelectedId(null); setTest(null); setTestedEndpoint('');
    if (!homeId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setIssue(null);
    void androidDisplayApi.list(homeId, controller.signal).then(result => {
      if (!controller.signal.aborted) setDisplays(result.displays);
    }).catch(error => {
      if (!controller.signal.aborted) setIssue(issueFrom(error));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [homeId]);

  useEffect(() => () => { if (volumeTimer.current) clearTimeout(volumeTimer.current); }, []);
  useEffect(() => { lastVolume.current = null; setVolumeDraft(50); }, [selectedId]);

  const selected = displays.find(display => display.deviceId === selectedId) ?? null;
  const roomNames = useMemo(() => new Map((roomsByHome[homeId] ?? []).map(room => [room.id, room.name])), [roomsByHome, homeId]);
  const deviceById = useMemo(() => new Map(devices.map(device => [device.id, device])), [devices]);
  const endpoint = `${host.trim()}:${port.trim()}`;
  const testIsCurrent = testedEndpoint === endpoint && test !== null;
  const knownDuplicate = duplicateKind(displays, host.trim(), testIsCurrent ? test : null);
  const canAdopt = testIsCurrent && test.connectionState === 'online' && !knownDuplicate && !!name.trim() && !busy;

  const updateDisplay = useCallback((display: AndroidDisplaySource) => {
    setDisplays(current => current.some(item => item.deviceId === display.deviceId)
      ? current.map(item => item.deviceId === display.deviceId ? display : item)
      : [...current, display]);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void androidDisplayApi.get(selectedId, controller.signal).then(result => {
      if (!controller.signal.aborted) updateDisplay(result.display);
    }).catch(error => {
      if (!controller.signal.aborted) setIssue(issueFrom(error));
    });
    return () => controller.abort();
  }, [selectedId, updateDisplay]);

  async function runTest() {
    setIssue(null); setNotice(null); setTest(null); setTestedEndpoint('');
    if (!homeId || !validPrivateIpv4(host) || port.trim() !== '5555') { setIssue('invalid_ip'); return; }
    setBusy('test');
    try {
      const result = await androidDisplayApi.test(homeId, host.trim(), 5555);
      setTest(result); setTestedEndpoint(endpoint);
      if (result.connectionState === 'needs_authorization') setIssue('authorization');
      else if (result.connectionState === 'offline') setIssue('offline');
      else if (result.connectionState === 'identity_mismatch') setIssue('identity_mismatch');
      else setIssue(duplicateKind(displays, host.trim(), result));
    } catch (error) { setIssue(issueFrom(error)); }
    finally { setBusy(null); }
  }

  async function adopt() {
    if (!canAdopt) return;
    setBusy('adopt'); setIssue(null);
    try {
      const result = await androidDisplayApi.adopt(homeId, name.trim(), host.trim(), 5555);
      updateDisplay(result.display);
      setSelectedId(result.display.deviceId);
      setShowAdd(false); setName(''); setHost(''); setPort('5555'); setTest(null); setTestedEndpoint('');
      setNotice(t('android_displays.adopted'));
      void refreshSnapshot({ force: true });
    } catch (error) { setIssue(issueFrom(error, knownDuplicate)); }
    finally { setBusy(null); }
  }

  async function refresh() {
    if (!selected || busy) return;
    setBusy('refresh'); setIssue(null); setNotice(null);
    try {
      const result = await androidDisplayApi.refresh(selected.deviceId);
      updateDisplay(result.display);
      if (result.display.connectionState === 'identity_mismatch') setIssue('identity_mismatch');
      else if (result.display.connectionState === 'needs_authorization') setIssue('authorization');
      else if (result.display.connectionState === 'offline') setIssue('offline');
      else setNotice(t('android_displays.refreshed'));
    } catch (error) { setIssue(issueFrom(error)); }
    finally { setBusy(null); }
  }

  async function command(name: 'navigate_home' | 'navigate_back' | 'volume_set', volume?: number): Promise<boolean> {
    if (!selected || selected.connectionState !== 'online' || busy) return false;
    setBusy('command'); setIssue(null); setNotice(null);
    try {
      await androidDisplayApi.command(selected.deviceId, name, volume);
      setNotice(t(name === 'volume_set' ? 'android_displays.volume_sent' : 'android_displays.command_sent'));
      return true;
    } catch (error) { setIssue(issueFrom(error)); return false; }
    finally { setBusy(null); }
  }

  function commitVolume() {
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    if (!selected || volumeInFlight.current || lastVolume.current === volumeDraft) return;
    volumeInFlight.current = true;
    void command('volume_set', volumeDraft).then(sent => { if (sent) lastVolume.current = volumeDraft; }).finally(() => { volumeInFlight.current = false; });
  }

  function status(state: AndroidDisplaySource['connectionState']) {
    return t(`android_displays.state.${state}`);
  }

  function metadataLine(display: AndroidDisplaySource) {
    return [display.metadata.manufacturer, display.metadata.model].filter(Boolean).join(' · ') || t('android_displays.unknown_model');
  }

  return <div className="flex min-w-0 flex-col gap-6">
    <SectionHeader level="view" title={t('android_displays.title')} subtitle={t('android_displays.subtitle')} icon={MonitorSmartphone}
      action={<Button onClick={() => { setShowAdd(true); setSelectedId(null); setIssue(null); setNotice(null); }}><Plus className="h-4 w-4" />{t('android_displays.add')}</Button>} />

    {homes.length > 1 && <SearchableSelectField label={t('android_displays.home')} value={homeId}
      options={homes.map(home => ({ value: home.id, label: home.name ?? home.id }))}
      onChange={value => { setHomeId(value); setSelectedId(null); setShowAdd(false); }} className="max-w-sm" />}

    {issue && <AlertBanner variant="warning" message={t(`android_displays.errors.${issue}`)} />}
    {notice && <AlertBanner variant="success" message={notice} />}

    {showAdd && <Card className="p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-section-title font-bold">{t('android_displays.add')}</h2>
        <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setIssue(null); }}>{t('common.cancel')}</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
        <Input label={t('android_displays.name')} value={name} maxLength={100} onChange={event => setName(event.target.value)} />
        <Input label={t('android_displays.ip')} value={host} inputMode="decimal" placeholder="192.168.1.37" onChange={event => { setHost(event.target.value); setTest(null); }} />
        <Input label={t('android_displays.port')} value={port} inputMode="numeric" onChange={event => { setPort(event.target.value); setTest(null); }} />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => void runTest()} isLoading={busy === 'test'} disabled={!homeId || !!busy}>{t('android_displays.test')}</Button>
        <Button onClick={() => void adopt()} isLoading={busy === 'adopt'} disabled={!canAdopt}>{t('android_displays.adopt')}</Button>
      </div>
      {testIsCurrent && <div className="mt-5 rounded-control bg-muted/40 p-4" role="status">
        <p className="font-semibold">{t('android_displays.test_result')}: {status(test.connectionState)}</p>
        <p className="mt-1 text-caption text-muted-foreground">{[test.metadata.manufacturer, test.metadata.model].filter(Boolean).join(' · ') || t('android_displays.unknown_model')}</p>
        <div className="mt-3 grid gap-2 text-caption sm:grid-cols-2">
          <p>{t('android_displays.android')}: {test.metadata.androidVersion ?? '—'}</p>
          <p>{t('android_displays.resolution')}: {test.metadata.resolution ?? '—'}</p>
          <p>{t('android_displays.density')}: {test.metadata.densityDpi ? `${test.metadata.densityDpi} DPI` : '—'}</p>
          <p>{t('android_displays.screen')}: {t(`android_displays.screen_state.${test.metadata.screenState}`)}</p>
        </div>
      </div>}
    </Card>}

    {loading ? <LoadingState label={t('common.loading')} className="min-h-empty-sm" /> : !homeId ?
      <AlertBanner variant="warning" message={t('android_displays.no_home')} /> : displays.length === 0 ?
      <Card className="px-6 py-10 text-center"><MonitorSmartphone className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
        <h2 className="font-bold">{t('android_displays.empty')}</h2><p className="mt-1 text-caption text-muted-foreground">{t('android_displays.empty_hint')}</p></Card> :
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.5fr)]">
        <div className="flex flex-col gap-3">{displays.map(display => {
          const device = deviceById.get(display.deviceId);
          return <Button key={display.deviceId} type="button" variant="ghost" size="sm" onClick={() => { setSelectedId(display.deviceId); setShowAdd(false); setIssue(null); setNotice(null); }}
            className={`!block h-auto w-full min-w-0 rounded-card border p-4 text-left transition-colors ${selectedId === display.deviceId ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2"><strong className="min-w-0 break-words">{device?.name ?? t('android_displays.unnamed')}</strong>
              <StatusPill variant={display.connectionState === 'online' ? 'success' : display.connectionState === 'identity_mismatch' ? 'danger' : 'warning'}>{status(display.connectionState)}</StatusPill></div>
            <p className="mt-2 break-words text-caption text-muted-foreground">{metadataLine(display)}</p>
            <p className="mt-1 break-words text-caption text-muted-foreground">{display.adbHost} · Android {display.metadata.androidVersion ?? '—'} · {device?.roomId ? roomNames.get(device.roomId) ?? t('android_displays.unassigned') : t('android_displays.unassigned')}</p>
          </Button>;
        })}</div>
        {selected ? <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="break-words text-section-title font-bold">{deviceById.get(selected.deviceId)?.name ?? t('android_displays.unnamed')}</h2>
            <p className="mt-1 text-caption text-muted-foreground">{metadataLine(selected)}</p></div><StatusPill variant={selected.connectionState === 'online' ? 'success' : 'warning'}>{status(selected.connectionState)}</StatusPill></div>
          <dl className="mt-5 grid gap-x-5 gap-y-3 text-caption sm:grid-cols-2">
            {[[t('android_displays.ip'), `${selected.adbHost}:${selected.adbPort}`], [t('android_displays.android'), selected.metadata.androidVersion ?? '—'],
              [t('android_displays.screen'), t(`android_displays.screen_state.${selected.metadata.screenState}`)],
              [t('android_displays.room'), roomNames.get(deviceById.get(selected.deviceId)?.roomId ?? '') ?? t('android_displays.unassigned')],
              [t('android_displays.last_seen'), selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleString() : '—']].map(([label, value]) =>
              <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refresh()} isLoading={busy === 'refresh'} disabled={!!busy}><RefreshCw className="h-4 w-4" />{t('android_displays.refresh')}</Button>
            <Button variant="outline" onClick={() => setInspectorId(selected.deviceId)}>{t('android_displays.assign_room')}</Button>
          </div>
          <div className="mt-6 border-t border-border pt-5"><h3 className="mb-3 font-semibold">{t('android_displays.controls')}</h3>
            <div className="flex flex-wrap gap-2"><Button onClick={() => void command('navigate_home')} disabled={selected.connectionState !== 'online' || !!busy}><Home className="h-4 w-4" />{t('android_displays.go_home')}</Button>
              <Button variant="secondary" onClick={() => void command('navigate_back')} disabled={selected.connectionState !== 'online' || !!busy}><ArrowLeft className="h-4 w-4" />{t('android_displays.back')}</Button></div>
            <div className="mt-5 max-w-md"><label htmlFor="display-volume" className="text-caption font-semibold">{t('android_displays.volume')}: {volumeDraft}</label>
              <RangeInput id="display-volume" min={0} max={100} value={volumeDraft} disabled={selected.connectionState !== 'online' || !!busy}
                onValueChange={setVolumeDraft} onValueCommit={commitVolume}
                onKeyUp={() => { if (volumeTimer.current) clearTimeout(volumeTimer.current); volumeTimer.current = setTimeout(commitVolume, 450); }}
                className="mt-2" /></div>
          </div>
          <details className="mt-6 border-t border-border pt-4 text-caption text-muted-foreground"><summary className="cursor-pointer font-semibold">{t('android_displays.technical')}</summary>
            <p className="mt-2 break-all">Android ID: {selected.metadata.androidId ?? '—'}</p></details>
        </Card> : <Card className="flex min-h-52 items-center justify-center p-6 text-center text-muted-foreground"><div><ArrowRight className="mx-auto mb-2 h-5 w-5" />{t('android_displays.select')}</div></Card>}
      </div>}

    {inspectorId && <DeviceInspector deviceId={inspectorId} rooms={roomsByHome[homeId] ?? []} onClose={() => setInspectorId(null)}
      onUpdate={device => { upsertDevice(device); }} onDeleted={() => { setInspectorId(null); setDisplays(current => current.filter(display => display.deviceId !== inspectorId)); }} />}
  </div>;
}
