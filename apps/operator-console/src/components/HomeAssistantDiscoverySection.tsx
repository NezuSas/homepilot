import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, RadioTower, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from './ui/Button';
import { SearchFilterBar } from './ui/SearchFilterBar';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

interface HaEntityCandidate {
  entityId: string;
  friendlyName: string;
  domain: string;
  profile?: {
    displayName: string;
    category: string;
    supportedCommandCount: number;
  };
}

interface HomeAssistantDiscoverySectionProps {
  onImported: (device: SnapshotDevice) => void;
}

const API_URL = `${API_BASE_URL}/api/v1`;
const INITIAL_RESULT_LIMIT = 48;

const isHaEntityCandidate = (value: unknown): value is HaEntityCandidate => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.entityId === 'string'
    && typeof candidate.friendlyName === 'string'
    && typeof candidate.domain === 'string';
};

export const HomeAssistantDiscoverySection: React.FC<HomeAssistantDiscoverySectionProps> = ({ onImported }) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<HaEntityCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_RESULT_LIMIT);
  const requestControllerRef = useRef<AbortController | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLocaleLowerCase());

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  useEffect(() => {
    setVisibleLimit(INITIAL_RESULT_LIMIT);
  }, [deferredSearchQuery, domainFilter]);

  const domainOptions = useMemo(() => {
    const uniqueDomains = Array.from(new Set(entities.map((entity) => entity.domain))).sort();
    return [
      { value: 'all', label: t('inbox.filters.all') },
      ...uniqueDomains.map((domain) => ({ value: domain, label: domain.replaceAll('_', ' ') })),
    ];
  }, [entities, t]);

  const filteredEntities = useMemo(() => entities.filter((entity) => {
    const matchesSearch = !deferredSearchQuery
      || entity.friendlyName.toLocaleLowerCase().includes(deferredSearchQuery)
      || entity.entityId.toLocaleLowerCase().includes(deferredSearchQuery);
    const matchesDomain = domainFilter === 'all' || entity.domain === domainFilter;
    return matchesSearch && matchesDomain;
  }), [deferredSearchQuery, domainFilter, entities]);

  const visibleEntities = useMemo(
    () => filteredEntities.slice(0, visibleLimit),
    [filteredEntities, visibleLimit],
  );

  const fetchCandidates = async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setShowDiscovery(true);
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/ha/entities?mode=all&view=summary`, { signal: controller.signal });
      if (!res.ok) throw new Error(t('inbox.discovery.fetch_failed'));
      const payload = await res.json() as unknown;
      setEntities(Array.isArray(payload) ? payload.filter(isHaEntityCandidate) : []);
      setVisibleLimit(INITIAL_RESULT_LIMIT);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : t('inbox.discovery.discovery_error'));
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const toggleDiscovery = () => {
    if (showDiscovery) {
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      setLoading(false);
      setShowDiscovery(false);
      return;
    }
    if (entities.length > 0) {
      setShowDiscovery(true);
      return;
    }
    void fetchCandidates();
  };

  const handleImport = async (entity: HaEntityCandidate) => {
    setImportingId(entity.entityId);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/ha/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entity.entityId }),
      });
      if (res.ok) {
        const importedDevice = await res.json() as SnapshotDevice;
        onImported(importedDevice);
        setEntities((current) => current.filter((candidate) => candidate.entityId !== entity.entityId));
      } else if (res.status === 409) {
        setError(t('inbox.discovery.already_imported'));
        setEntities((current) => current.filter((candidate) => candidate.entityId !== entity.entityId));
      } else {
        const data = await res.json() as { error?: { message?: string } | string };
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        setError(message || t('inbox.discovery.import_failed'));
      }
    } catch {
      setError(t('inbox.discovery.import_failed'));
    } finally {
      setImportingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="ha-discovery-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="ha-discovery-title" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <RadioTower className="h-4 w-4" /> {t('inbox.discovery.bridge_title')}
        </h3>
        <Button
          variant="secondary"
          onClick={toggleDiscovery}
          className="h-10 w-full px-4 text-label font-black uppercase tracking-widest sm:w-auto"
        >
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          {showDiscovery ? t('inbox.discovery.close_button') : t('inbox.discovery.discover_button')}
        </Button>
      </div>

      {showDiscovery && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
          {loading && entities.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center gap-3 rounded-panel border border-border/60 bg-card/35 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              {t('inbox.discovery.loading_entities')}
            </div>
          ) : (
            <>
              <SearchFilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={t('inbox.discovery.search_placeholder')}
                activeFilter={domainFilter}
                onFilterChange={setDomainFilter}
                options={domainOptions}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
                <span>{t('inbox.discovery.result_count', { visible: visibleEntities.length, total: filteredEntities.length })}</span>
                <Button variant="ghost" size="sm" onClick={() => { void fetchCandidates(); }} disabled={loading} className="gap-2">
                  <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                  {t('inbox.discovery.refresh_results')}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleEntities.map((entity) => (
                  <article key={entity.entityId} className="group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4">
                    <RadioTower className="absolute right-2 top-2 h-8 w-8 opacity-5" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-micro uppercase text-muted-foreground" title={entity.entityId}>{entity.entityId}</span>
                      <span className="truncate text-body font-bold" title={entity.friendlyName}>{entity.friendlyName}</span>
                      {entity.profile && (
                        <span className="truncate text-caption text-muted-foreground">
                          {entity.profile.displayName} · {entity.profile.supportedCommandCount > 0
                            ? t('inbox.discovery.command_count', { count: entity.profile.supportedCommandCount })
                            : t('inbox.discovery.read_only')}
                        </span>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/20 pt-2">
                      <span className="rounded bg-muted px-2 py-0.5 text-micro font-bold uppercase">{entity.domain.replaceAll('_', ' ')}</span>
                      <button
                        type="button"
                        onClick={() => { void handleImport(entity); }}
                        disabled={importingId !== null}
                        className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1.5 text-label font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                      >
                        {importingId === entity.entityId ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                        {t('common.import')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {visibleEntities.length < filteredEntities.length && (
                <Button
                  variant="secondary"
                  onClick={() => setVisibleLimit((current) => current + INITIAL_RESULT_LIMIT)}
                  className="mx-auto min-w-48"
                >
                  {t('inbox.discovery.load_more', { count: Math.min(INITIAL_RESULT_LIMIT, filteredEntities.length - visibleEntities.length) })}
                </Button>
              )}

              {filteredEntities.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-border/60 py-8 text-center text-caption text-muted-foreground">
                  {t('inbox.discovery.no_entities')}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-center text-caption font-bold text-destructive">{error}</p>}
    </section>
  );
};
