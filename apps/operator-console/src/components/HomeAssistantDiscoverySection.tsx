import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Loader2, RadioTower, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from './ui/Button';
import { SearchFilterBar } from './ui/SearchFilterBar';

interface HaEntityCandidate {
  entityId: string;
  state: string;
  friendlyName: string;
  domain: string;
}

interface HomeAssistantDiscoverySectionProps {
  onImported: () => void;
}

const API_URL = `${API_BASE_URL}/api/v1`;

export const HomeAssistantDiscoverySection: React.FC<HomeAssistantDiscoverySectionProps> = ({ onImported }) => {
  const { t } = useTranslation();
  const [entities, setEntities] = useState<HaEntityCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');

  const uniqueDomains = Array.from(new Set(entities.map((entity) => entity.domain))).sort();
  const domainOptions = [
    { value: 'all', label: t('inbox.filters.all', { defaultValue: 'Todos' }) },
    ...uniqueDomains.map((domain) => ({ value: domain, label: domain })),
  ];

  const filteredEntities = entities.filter((entity) => {
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch = entity.friendlyName.toLowerCase().includes(normalizedQuery)
      || entity.entityId.toLowerCase().includes(normalizedQuery);
    const matchesDomain = domainFilter === 'all' || entity.domain === domainFilter;
    return matchesSearch && matchesDomain;
  });

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/ha/entities?mode=all`);
      if (!res.ok) throw new Error(t('inbox.discovery.fetch_failed'));
      setEntities(await res.json());
      setShowDiscovery(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('inbox.discovery.discovery_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (entity: HaEntityCandidate) => {
    setImportingId(entity.entityId);
    try {
      const res = await apiFetch(`${API_URL}/ha/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: entity.entityId }),
      });
      if (res.ok) {
        onImported();
        setEntities((prev) => prev.filter((current) => current.entityId !== entity.entityId));
      } else if (res.status === 409) {
        setError(t('inbox.discovery.already_imported'));
        setEntities((prev) => prev.filter((current) => current.entityId !== entity.entityId));
      } else {
        const data = await res.json();
        const msg = data.error?.message || (typeof data.error === 'string' ? data.error : 'Import failed');
        setError(`Error: ${msg}`);
      }
    } catch {
      setError(t('inbox.discovery.import_failed'));
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
          <RadioTower className="w-4 h-4" /> {t('inbox.discovery.bridge_title')}
        </h3>
        <Button
          variant="secondary"
          onClick={showDiscovery ? () => setShowDiscovery(false) : fetchCandidates}
          disabled={loading}
          className="text-[10px] font-black uppercase tracking-widest px-4 h-9"
          isLoading={loading}
        >
          {showDiscovery ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 rotate-180" /> {t('inbox.discovery.close_button', { defaultValue: 'Close Discovery' })}
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" /> {t('inbox.discovery.discover_button')}
            </>
          )}
        </Button>
      </div>

      {showDiscovery && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-300">
          {entities.length > 0 && (
            <SearchFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder={t('inbox.discovery.search_placeholder', 'Buscar entidades...')}
              activeFilter={domainFilter}
              onFilterChange={setDomainFilter}
              options={domainOptions}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEntities.map((entity) => (
              <div key={entity.entityId} className="p-4 bg-card border border-border rounded-xl flex flex-col gap-3 group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <RadioTower className="w-8 h-8" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-mono opacity-40 uppercase truncate" title={entity.entityId}>{entity.entityId}</span>
                  <span className="text-xs font-black truncate" title={entity.friendlyName}>{entity.friendlyName}</span>
                </div>
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/20">
                  <span className="px-2 py-0.5 bg-muted rounded text-[9px] font-bold uppercase">{entity.domain}</span>
                  <button
                    onClick={() => handleImport(entity)}
                    disabled={importingId === entity.entityId}
                    className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1 bg-primary/10 px-2 py-1.5 rounded disabled:opacity-50 transition-all hover:bg-primary/20"
                  >
                    {importingId === entity.entityId ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                    {t('common.import')}
                  </button>
                </div>
              </div>
            ))}
            {filteredEntities.length === 0 && !loading && (
              <div className="col-span-full py-8 text-center border-2 border-dashed rounded-xl opacity-40">
                <p className="text-[10px] font-black uppercase tracking-widest">{t('inbox.discovery.no_entities', { defaultValue: 'No entities found' })}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-[10px] text-destructive bg-destructive/5 p-2 rounded-lg border border-destructive/20 text-center uppercase font-bold">{error}</p>}
    </div>
  );
};
