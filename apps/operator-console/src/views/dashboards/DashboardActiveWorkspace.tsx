import type { TFunction } from 'i18next';
import { DashboardTabsNav } from '../../components/DashboardTabsNav';
import { DashboardTitleBar } from '../../components/DashboardTitleBar';
import { Button } from '../../components/ui/Button';
import { DashboardCanvas } from './DashboardCanvas';
import type { Dashboard, DashboardTab, DashboardWidget, DashboardWidgetConfig, WidgetType } from './types';

interface DashboardActiveWorkspaceProps {
  active: Dashboard;
  activeTab?: DashboardTab;
  visibleTabs: DashboardTab[];
  isOwner: boolean;
  isEditing: boolean;
  editingTitle: boolean;
  draftTitle: string;
  isAddingTab: boolean;
  selectedWidgetId: string | null;
  isTransferring: boolean;
  t: TFunction;
  onOpenMobileMenu?: () => void;
  onDraftTitleChange: (title: string) => void;
  onStartEditingTitle: () => void;
  onCancelEditingTitle: () => void;
  onConfirmTitle: () => void;
  onDeleteDashboard: () => void;
  onToggleEditing: () => void;
  onCreateDashboard: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onOpenHistory: () => void;
  onSelectTab: (index: number) => void;
  onConfigureTab: (index: number) => void;
  onStartAddingTab: () => void;
  onAddTab: (title: string) => void;
  onCancelAddingTab: () => void;
  onAddWidget: (type: WidgetType, size?: { w: number; h: number }) => void;
  onSelectWidget: (id: string) => void;
  onLayoutChange: (widgets: DashboardWidget[]) => void;
  onWidgetConfigChange: (widgetId: string, config: Partial<DashboardWidgetConfig>) => void;
  onSelectCanvasTab: (tabId: string) => void;
}

/** Visual dashboard surface; request lifecycle and persistence stay in DashboardsView. */
export function DashboardActiveWorkspace({
  active,
  activeTab,
  visibleTabs,
  isOwner,
  isEditing,
  editingTitle,
  draftTitle,
  isAddingTab,
  selectedWidgetId,
  isTransferring,
  t,
  onOpenMobileMenu,
  onDraftTitleChange,
  onStartEditingTitle,
  onCancelEditingTitle,
  onConfirmTitle,
  onDeleteDashboard,
  onToggleEditing,
  onCreateDashboard,
  onExport,
  onImport,
  onOpenHistory,
  onSelectTab,
  onConfigureTab,
  onStartAddingTab,
  onAddTab,
  onCancelAddingTab,
  onAddWidget,
  onSelectWidget,
  onLayoutChange,
  onWidgetConfigChange,
  onSelectCanvasTab,
}: DashboardActiveWorkspaceProps) {
  return <div className="flex min-w-0 flex-col">
    <div className="homepilot-dashboard-chrome sticky top-0 z-40">
      {isOwner && (
        <DashboardTitleBar
          title={active.title}
          draftTitle={draftTitle}
          isEditingTitle={editingTitle}
          isEditingDashboard={isEditing}
          onDraftTitleChange={onDraftTitleChange}
          onStartEditingTitle={onStartEditingTitle}
          onCancelEditingTitle={onCancelEditingTitle}
          onConfirmTitle={onConfirmTitle}
          onDelete={onDeleteDashboard}
          deleteLabel={t('dashboards.delete')}
          renameLabel={t('dashboards.rename')}
          editLabel={t('dashboards.action_edit')}
          doneLabel={t('common.done')}
          newLabel={t('dashboards.action_new')}
          moreLabel={t('common.more')}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          onToggleEditing={onToggleEditing}
          onCreate={onCreateDashboard}
          onExport={onExport}
          onImport={onImport}
          exportLabel={t('dashboards.transfer.export')}
          importLabel={t('dashboards.transfer.import')}
          historyLabel={t('dashboards.history.action')}
          onOpenHistory={onOpenHistory}
          isTransferring={isTransferring}
        />
      )}
      <DashboardTabsNav
        tabs={visibleTabs}
        activeTabIdx={visibleTabs.findIndex(tab => tab.id === activeTab?.id)}
        onOpenMobileMenu={onOpenMobileMenu}
        isEditing={isEditing && isOwner}
        isAddingTab={isAddingTab}
        placeholder={t('dashboards.placeholder_tab_title')}
        addLabel={t('dashboards.action_add_tab')}
        configureLabel={t('dashboards.view_config.configure_view')}
        onSelectTab={onSelectTab}
        onConfigureTab={onConfigureTab}
        onStartAddingTab={isOwner ? onStartAddingTab : undefined}
        onAddTab={onAddTab}
        onCancelAddingTab={onCancelAddingTab}
      />
    </div>

    {activeTab ? (
      <div className="homepilot-dashboard-content relative flex w-full min-w-0 flex-col gap-5 px-2 py-4 sm:px-3 sm:py-6 md:px-4">
        {activeTab.widgets.length === 0 && !(isEditing && isOwner) ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-panel border border-dashed border-primary/25 bg-primary/[0.03] p-8 text-center">
            <p className="text-section-title font-semibold text-foreground">{t('dashboards.widgets_empty')}</p>
            <p className="mt-2 max-w-lg text-caption text-muted-foreground">{t('dashboards.widgets_empty_hint')}</p>
            {isOwner && <Button className="mt-5" onClick={onToggleEditing}>{t('dashboards.add_first_widget')}</Button>}
          </div>
        ) : (
          <DashboardCanvas
            widgets={activeTab.widgets}
            isEditing={isEditing && isOwner}
            onAddTitleClick={() => onAddWidget('dashboard_title')}
            selectedWidgetId={selectedWidgetId}
            onWidgetClick={(id) => {
              if (isOwner && isEditing) onSelectWidget(id);
            }}
            onLayoutChange={onLayoutChange}
            onWidgetConfigChange={onWidgetConfigChange}
            onAddSectionClick={() => onAddWidget('section')}
            tabs={visibleTabs.map(tab => ({ id: tab.id, title: tab.title, icon: tab.icon }))}
            currentTabId={activeTab.id}
            onSelectTab={onSelectCanvasTab}
          />
        )}
      </div>
    ) : (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-panel border border-dashed border-primary/25 bg-primary/[0.03] p-8 text-center">
        <p className="text-section-title font-semibold text-foreground">{t('common.no_content_yet')}</p>
      </div>
    )}
  </div>;
}
