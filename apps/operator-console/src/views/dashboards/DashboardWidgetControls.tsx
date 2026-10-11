import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, MoreVertical, Copy, GripVertical, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from '../../components/ui/IconButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ActionMenu } from '../../components/ui/ActionMenu';

interface TitleEditControlsProps {
  isMenuOpen: boolean;
  menuPosition: { top: number; right: number } | null;
  onEdit: () => void;
  onToggleMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onCloseMenu: () => void;
  onDelete: () => void;
}

/** Hover overlay with the edit button and actions menu of a dashboard title widget. */
export function TitleEditControls({ isMenuOpen, menuPosition, onEdit, onToggleMenu, onCloseMenu, onDelete }: TitleEditControlsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-section bg-background/45 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      />
      <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <IconButton
          icon={Pencil}
          label={t('common.edit')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          variant="default"
          size="md"
          className="pointer-events-auto bg-background/95 backdrop-blur-md hover:text-primary"
        />
      </div>
      <div className="pointer-events-none absolute right-2 top-2 z-30 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <IconButton
          icon={MoreVertical}
          label={t('dashboard.editor.sections.card_actions')}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu(event);
          }}
          variant="default"
          size="md"
          className="bg-background/95 backdrop-blur-md hover:text-primary"
        />
      </div>
      {isMenuOpen && menuPosition && createPortal(
        <>
          <div className="fixed inset-0 z-40" aria-hidden="true" onPointerDown={onCloseMenu} />
          <Card
            variant="elevated"
            radius="panel"
            role="menu"
            aria-label={t('dashboard.editor.sections.card_actions')}
            style={menuPosition}
            onPointerDown={(event) => event.stopPropagation()}
            className="fixed z-50 min-w-36 p-1.5"
          >
            <Button
              role="menuitem"
              variant="ghost"
              size="sm"
              onClick={() => {
                onCloseMenu();
                onEdit();
              }}
              className="w-full justify-start"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('common.edit')}
            </Button>
            <div role="separator" className="my-1 border-t border-border/65" />
            <Button
              role="menuitem"
              variant="ghost"
              size="sm"
              onClick={() => {
                onCloseMenu();
                onDelete();
              }}
              className="w-full justify-start text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('common.delete')}
            </Button>
          </Card>
        </>,
        document.body,
      )}
    </>
  );
}

interface WidgetEditToolbarProps {
  isSection: boolean;
  hasClockEditTools: boolean;
  canDrag: boolean;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: DraggableSyntheticListeners;
  onEditSection: () => void;
  onConfigure: (event: MouseEvent<HTMLButtonElement>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

/** Floating toolbar of a widget in edit mode: section menu, drag grip, configure and delete. */
export function WidgetEditToolbar({ isSection, hasClockEditTools, canDrag, dragHandleAttributes, dragHandleListeners, onEditSection, onConfigure, onDuplicate, onDelete }: WidgetEditToolbarProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* A selected section exposes only its direct manipulation tools. */}
      <div data-clock-edit-tools={hasClockEditTools ? '' : undefined} className={cn("pointer-events-auto z-30 flex items-center", hasClockEditTools ? "relative order-first justify-end" : "absolute", !hasClockEditTools && (isSection ? "-top-5 right-3" : "right-2 top-2"))}>
        <div className={cn("flex items-center gap-1 rounded-xl border border-border/50 bg-background/95 p-1 shadow-lg backdrop-blur-md", hasClockEditTools && "max-w-full flex-wrap justify-end")}>
          {isSection && <ActionMenu compact label={t('dashboards.edit_session.section_actions')} items={[
            { label: t('common.edit'), icon: Pencil, onSelect: onEditSection },
            { label: t('dashboards.edit_session.duplicate'), icon: Copy, onSelect: () => onDuplicate?.(), disabled: !onDuplicate },
            { label: t('common.delete'), icon: Trash2, onSelect: () => onDelete?.(), disabled: !onDelete, danger: true },
          ]} />}
          {/* The grip reorders the section without capturing its card controls. */}
          {!isSection && canDrag && (
            <IconButton
              icon={GripVertical}
              label={t('common.reorder')}
              variant="ghost"
              size="sm"
              {...dragHandleAttributes}
              {...dragHandleListeners}
              className="touch-none cursor-grab text-muted-foreground/50 active:cursor-grabbing hover:text-primary"
            />
          )}
          {!isSection && canDrag && <div className="mx-0.5 h-4 w-px bg-border/40" />}
          {!isSection && (
            <IconButton
              icon={Pencil}
              label={t('common.configure')}
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onConfigure(event);
              }}
              className="hover:bg-primary/10 hover:text-primary"
            />
          )}
          {!isSection && onDelete && <div className="mx-0.5 h-4 w-px bg-border/40" />}
          {!isSection && onDelete && (
            <IconButton
              icon={Trash2}
              label={t('common.delete')}
              variant="ghost"
              size="sm"
              onClick={(event) => { event.stopPropagation(); onDelete(); }}
              className="text-danger hover:bg-danger/10 hover:text-danger"
            />
          )}
        </div>
      </div>
    </>
  );
}
