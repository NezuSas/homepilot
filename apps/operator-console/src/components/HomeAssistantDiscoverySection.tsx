import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, RadioTower, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from './ui/Button';
import { HaDiscoverySkeleton } from './ui/ComponentSkeletons';
import { SearchInput } from './ui/Input';
import { SearchableSelectField } from './ui/SearchableSelectField';
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
    <section className="flex flex-col gap-3" aria-labelledby="ha-discovery-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 id="ha-discovery-title" className="flex items-center gap-2 text-micro font-semibold uppercase tracking-control text-muted-foreground">
          <RadioTower className="h-4 w-4" /> {t('inbox.discovery.bridge_title')}
        </h3>
        <Button
          variant="secondary"
          onClick={toggleDiscovery}
          size="sm"
          className="w-full uppercase tracking-label sm:w-auto"
        >
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          {showDiscovery ? t('inbox.discovery.close_button') : t('inbox.discovery.discover_button')}
        </Button>
      </div>

      {showDiscovery && (
        <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-300">
          {loading && entities.length === 0 ? (
            <HaDiscoverySkeleton label={t('inbox.discovery.loading_entities')} />
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="w-full max-w-sm"><SearchInput value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder={t('inbox.discovery.search_placeholder')} /></div>
                <SearchableSelectField label={t('inbox.filters.type_label')} value={domainFilter} onChange={setDomainFilter} options={domainOptions} className="ml-auto w-40 max-w-full" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
                <span>{t('inbox.discovery.result_count', { visible: visibleEntities.length, total: filteredEntities.length })}</span>
                <Button variant="ghost" size="sm" onClick={() => { void fetchCandidates(); }} disabled={loading} className="gap-2">
                  <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                  {t('inbox.discovery.refresh_results')}
                </Button>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
                {visibleEntities.map((entity) => (
                  <article key={entity.entityId} className="flex min-w-0 items-center gap-3 rounded-control border border-border bg-card p-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="break-words text-body-compact font-semibold">{entity.friendlyName}</span>
                      <span className="break-all text-micro text-muted-foreground">{entity.entityId}</span>
                    </div>
                    <div className="ml-auto shrink-0">
                      <Button
                        type="button"
                        onClick={() => { void handleImport(entity); }}
                        disabled={importingId !== null}
                        variant="ghost"
                        size="lg"
                        isLoading={importingId === entity.entityId}
                        className="gap-1 bg-primary/10 uppercase tracking-control text-primary hover:bg-primary/20"
                      >
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        {t('common.import')}
                      </Button>
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
      {error && <p className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-center text-caption font-bold text-danger">{error}</p>}
    </section>
  );
};
