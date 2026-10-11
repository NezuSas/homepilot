import { useState } from 'react';
import type { TFunction } from 'i18next';
import { generateId } from '../../utils/generateId';
import type { Dashboard, DashboardTab, DashboardWidget, DashboardWidgetConfig, WidgetType } from './types';
import { configureTab, createDefaultWidgetConfig, insertWidget, updateWidgetConfig, type TabConfigFields } from './dashboardMutations';

type DashboardPatch = (id: string, update: Partial<Dashboard> | ((current: Dashboard) => Partial<Dashboard>)) => Promise<boolean>;

interface DashboardActionsInput {
  active: Dashboard | null;
  activeTabIdx: number;
  draftTitle: string;
  t: TFunction;
  patch: DashboardPatch;
  setActiveTabIdx: (index: number) => void;
  setAddingTab: (adding: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  setSelectedWidgetId: (id: string | null) => void;
  setTabPendingDelete: (index: number | null) => void;
}

/** Dashboard mutations triggered by the editor: rename, tabs, widgets and layout. */
export function useDashboardActions({
  active, activeTabIdx, draftTitle, t, patch, setActiveTabIdx, setAddingTab, setIsEditing, setSelectedWidgetId, setTabPendingDelete,
}: DashboardActionsInput) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRenameConfirm = async () => {
    if (!active || !draftTitle.trim()) return;
    await patch(active.id, { title: draftTitle.trim() });
  };

  const handleAddTab = async (title: string) => {
    if (!active || !title.trim()) return;
    setAddingTab(false);
    const newTabId = generateId();
    const saved = await patch(active.id, current => ({ tabs: [...current.tabs, { id: newTabId, title: title.trim(), widgets: [] }] }));
    if (saved) {
      setActiveTabIdx(active.tabs.length);
      setIsEditing(true);
    }
  };

  const handleSaveTabConfig = async (tabIdx: number, fields: TabConfigFields) => {
    if (!active) return;
    const tabId = active.tabs[tabIdx]?.id;
    await patch(active.id, current => ({ tabs: configureTab(current.tabs, current.tabs.findIndex(tab => tab.id === tabId), fields) }));
  };

  const handleDeleteTab = async (tabIdx: number) => {
    if (!active) return;
    const tabId = active.tabs[tabIdx]?.id;
    setIsDeleting(true);
    const saved = await patch(active.id, current => ({ tabs: current.tabs.filter(tab => tab.id !== tabId) }));
    if (saved) setActiveTabIdx(Math.max(0, activeTabIdx - 1));
    setTabPendingDelete(null);
    setIsDeleting(false);
  };

  const handleAddWidget = async (type: WidgetType, size?: { w: number; h: number }) => {
    if (!active || active.tabs.length === 0) return;

    const currentTab = active.tabs[activeTabIdx];

    const isDashboardTitle = type === 'dashboard_title';
    const isSection = type === 'section';

    const existingTitle = currentTab.widgets.find(widget => widget.type === 'dashboard_title');
    if (isDashboardTitle && existingTitle) {
      setSelectedWidgetId(existingTitle.id);
      return;
    }

    const defaultConfig = createDefaultWidgetConfig(type, size, {
      titleArea: t('dashboard.editor.sections.title_area'),
      newSection: t('dashboard.editor.sections.new_section'),
      titlePlaceholder: t('dashboard.editor.sections.title_placeholder'),
      subtitlePlaceholder: t('dashboard.editor.sections.subtitle_placeholder'),
    });

    const widgetId = generateId();

    const saved = await patch(active.id, current => ({ tabs: insertWidget(current.tabs, current.tabs.findIndex(tab => tab.id === currentTab.id), { id: widgetId, type, config: defaultConfig }) }));

    if (saved && !isSection) {
      setSelectedWidgetId(widgetId);
    }
  };

  const handleLayoutChange = async (updatedWidgets: DashboardWidget[], sectionLayout?: NonNullable<DashboardTab['sectionLayout']>) => {
    if (!active) return;
    const tabId = active.tabs[activeTabIdx]?.id;
    await patch(active.id, current => ({ tabs: current.tabs.map(tab =>
      tab.id !== tabId ? tab : { ...tab, widgets: updatedWidgets, sectionLayout: sectionLayout ?? tab.sectionLayout }
    ) }));
  };

  const handleUpdateWidgetConfig = async (widgetId: string, newConfig: Partial<DashboardWidgetConfig>) => {
    if (!active) return;
    const tabId = active.tabs[activeTabIdx]?.id;
    await patch(active.id, current => ({ tabs: updateWidgetConfig(current.tabs, current.tabs.findIndex(tab => tab.id === tabId), widgetId, newConfig) }));
  };

  return {
    isDeleting, handleRenameConfirm, handleAddTab, handleSaveTabConfig, handleDeleteTab,
    handleAddWidget, handleLayoutChange, handleUpdateWidgetConfig,
  };
}
