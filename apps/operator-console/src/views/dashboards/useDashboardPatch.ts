import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TFunction } from 'i18next';
import type { Dashboard } from './types';
import { saveDashboard } from './dashboardOperations';
import { DashboardEditSession } from './DashboardEditSession';

interface DashboardPatchInput {
  active: Dashboard | null;
  isEditing: boolean;
  isOwner: boolean;
  isBusy: boolean;
  t: TFunction;
  setActive: (dashboard: Dashboard) => void;
  setError: (message: string) => void;
  publishDashboards: (update: (current: Dashboard[]) => Dashboard[]) => Dashboard[];
}

/** Undoable, auto-saving edit session for the active dashboard, plus the Ctrl/Cmd+Z shortcuts. */
export function useDashboardPatch({ active, isEditing, isOwner, isBusy, t, setActive, setError, publishDashboards }: DashboardPatchInput) {
  const editSession = useRef<DashboardEditSession<Dashboard> | null>(null);
  const activeRef = useRef(active);
  useLayoutEffect(() => { activeRef.current = active; }, [active]);
  const [editStatus, setEditStatus] = useState({ pending: false, canUndo: false, canRedo: false });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    const session = editSession.current;
    if (session && !session.pending && session.value !== active) {
      editSession.current = null;
      setEditStatus({ pending: false, canUndo: false, canRedo: false });
    }
  }, [active]);

  const patch = (id: string, update: Partial<Dashboard> | ((current: Dashboard) => Partial<Dashboard>)) => {
    const current = activeRef.current;
    if (!current || current.id !== id || isBusy) return Promise.resolve(false);
    if (!editSession.current || editSession.current.value !== current) {
      editSession.current = new DashboardEditSession(current,
        value => saveDashboard(id, { title: value.title, tabs: value.tabs }, t('dashboards.error_save')),
        (value, session) => {
          if (!mounted.current) return;
          publishDashboards(catalog => catalog.map(dashboard => dashboard.id === id ? value : dashboard));
          if (activeRef.current?.id === id) {
            activeRef.current = value;
            setActive(value);
            setEditStatus({ pending: session.pending, canUndo: session.canUndo, canRedo: session.canRedo });
          }
        },
        error_ => { if (mounted.current) setError(error_ instanceof Error ? error_.message : t('dashboards.error_save')); });
    }
    setError('');
    return editSession.current.edit(value => ({ ...value, ...(typeof update === 'function' ? update(value) : update) }));
  };

  useEffect(() => {
    if (!isEditing || !isOwner) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
      const session = editSession.current;
      if (!session || session.value !== activeRef.current) return;
      event.preventDefault();
      void (event.shiftKey ? session.redo() : session.undo());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing, isOwner]);

  return { patch, editSession, editStatus };
}
