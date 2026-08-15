import { useEffect, useState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from './ui/Button';

interface DirectoryLink { directoryAccountId: string; createdAt: string; }

export function DirectorySsoLinksSection() {
  const [links, setLinks] = useState<DirectoryLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch(`${API_BASE_URL}/api/v1/auth/sso/links`)
      .then(async (response) => response.ok ? response.json() as Promise<{ links: DirectoryLink[] }> : { links: [] })
      .then((result) => { if (active) setLinks(result.links); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const unlink = async (directoryAccountId: string) => {
    setRemoving(directoryAccountId);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/auth/sso/links/${encodeURIComponent(directoryAccountId)}`, { method: 'DELETE' });
      if (response.ok) setLinks((current) => current.filter((link) => link.directoryAccountId !== directoryAccountId));
    } finally { setRemoving(null); }
  };

  return <section className="rounded-2xl border border-border bg-muted/30 p-4">
    <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><h3 className="text-body font-bold">Vínculos del Directorio</h3></div>
    {loading ? <p className="mt-2 text-label text-muted-foreground">Cargando vínculos…</p> : links.length === 0 ? <p className="mt-2 text-label text-muted-foreground">Esta cuenta no tiene vínculos externos.</p> : <ul className="mt-3 space-y-2">{links.map((link) => <li key={link.directoryAccountId} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2"><span className="min-w-0 truncate text-label font-medium">Cuenta del Directorio vinculada</span><Button variant="secondary" size="sm" isLoading={removing === link.directoryAccountId} onClick={() => void unlink(link.directoryAccountId)}><Unlink className="h-3.5 w-3.5" />Desvincular</Button></li>)}</ul>}
  </section>;
}