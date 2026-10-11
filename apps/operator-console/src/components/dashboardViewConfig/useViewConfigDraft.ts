import { useEffect, useState } from 'react';
import type { DashboardViewConfigTabData, ViewColumns, ViewConfigTab } from './viewConfigModel';

/** Editable draft of the view settings, re-synced from the tab whenever the modal opens. */
export function useViewConfigDraft(isOpen: boolean, tab: DashboardViewConfigTabData) {
  const [activeTab, setActiveTab] = useState<ViewConfigTab>('settings');
  const [draftTitle, setDraftTitle] = useState(tab.title);
  const [maxColumns, setMaxColumns] = useState<ViewColumns>(tab.maxColumns ?? 4);
  const [backgroundOpacity, setBackgroundOpacity] = useState(tab.backgroundOpacity ?? 50);
  const [backgroundImg, setBackgroundImg] = useState<string | null>(tab.background || null);
  const [allowedUsers, setAllowedUsers] = useState<string[]>(tab.visibility?.users || []);
  const [iconQuery, setIconQuery] = useState(tab.icon || '');
  const [isDefaultTab, setIsDefaultTab] = useState(tab.isDefault ?? false);

  // Sync state with props when modal opens or tab changes
  useEffect(() => {
    if (!isOpen) return;
    setDraftTitle(tab.title);
    setMaxColumns(tab.maxColumns ?? 4);
    setBackgroundOpacity(tab.backgroundOpacity ?? 50);
    setBackgroundImg(tab.background || null);
    setAllowedUsers(tab.visibility?.users || []);
    setIconQuery(tab.icon || '');
    setIsDefaultTab(tab.isDefault ?? false);
    setActiveTab('settings');
  }, [isOpen, tab]);

  return {
    activeTab, setActiveTab,
    draftTitle, setDraftTitle,
    maxColumns, setMaxColumns,
    backgroundOpacity, setBackgroundOpacity,
    backgroundImg, setBackgroundImg,
    allowedUsers, setAllowedUsers,
    iconQuery, setIconQuery,
    isDefaultTab, setIsDefaultTab,
  };
}
