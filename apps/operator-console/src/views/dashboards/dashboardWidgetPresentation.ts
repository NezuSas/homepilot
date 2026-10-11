import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import type { CardGridOptions } from './types';
import { getCardGridHeight } from './widgets/cardGridResize';

/** Border and tint applied to a widget with a custom accent color. */
export function getWidgetAccentStyle(accentColor: string | undefined): CSSProperties {
  return accentColor
    ? {
        borderColor: accentColor,
        backgroundColor: `${accentColor}12`, // 7% opacity tint
        borderWidth: '2px',
        borderStyle: 'solid' as const,
      }
    : {};
}

/** Root style of a widget node; clock widgets size themselves from their grid footprint. */
export function getWidgetRootStyle(accentStyle: CSSProperties, clockGrid: CardGridOptions | null, hasClockEditTools: boolean): CSSProperties {
  return {
    ...accentStyle,
    containerType: clockGrid && !hasClockEditTools ? 'size' : 'inline-size',
    ...(clockGrid ? { containerName: hasClockEditTools ? undefined : 'clock-card', borderWidth: 0, width: `calc(${Number(clockGrid.columns) / 12 * 100}% - ${8 - Number(clockGrid.columns) / 12 * 8}px)`, height: hasClockEditTools ? 'auto' : getCardGridHeight(clockGrid.rows), minHeight: 0, ...(hasClockEditTools ? { backgroundColor: 'transparent' } : {}) } : {}),
  };
}

/** Style of the content wrapper; with clock edit tools it becomes the clock's own size container. */
export function getWidgetContentStyle(clockGrid: CardGridOptions | null, hasClockEditTools: boolean): CSSProperties | undefined {
  return clockGrid ? {
    borderRadius: 'inherit',
    ...(hasClockEditTools ? { containerType: 'size', containerName: 'clock-card', height: getCardGridHeight(clockGrid.rows), flexShrink: 0 } : {}),
  } : undefined;
}

interface WidgetFrameState {
  isSection: boolean;
  isCamera: boolean;
  isDevice: boolean;
  isEditing: boolean;
  isSelected: boolean;
  hasClockEditTools: boolean;
  accentColor: string | undefined;
  variant: string | undefined;
}

export function getWidgetFrameClass({ isSection, isCamera, isDevice, isEditing, isSelected, hasClockEditTools, accentColor, variant }: WidgetFrameState): string {
  return cn(
    "homepilot-dashboard-widget relative h-full w-full min-h-0 overflow-visible transition-[transform,box-shadow,background-color,border-color] duration-300 group @container touch-manipulation",
    hasClockEditTools && "flex flex-col gap-2",
    // Editing restores the section boundary without changing its inner card grid.
    isSection
      ? (isEditing
        ? "homepilot-dashboard-section rounded-section outline outline-2 outline-dashed outline-offset-[-2px] outline-border/70 hover:outline-primary/70"
        : "homepilot-dashboard-section rounded-2xl border-transparent")
      : isCamera
        ? "rounded-2xl border-transparent bg-transparent shadow-none"
        : "rounded-section sm:rounded-panel",

    // --- Variant Application (non-section, non-camera) ---
    !isSection && !isCamera && !accentColor && isDevice && "bg-card border border-border/60 shadow-xl",
    !isSection && !isCamera && !accentColor && !isDevice && variant === 'glass' && "bg-background/40 backdrop-blur-3xl border border-white/5 shadow-xl",
    !isSection && !isCamera && !accentColor && !isDevice && (variant === 'solid' || !variant) && "bg-card border border-border/60",
    !isSection && !isCamera && !accentColor && variant === 'radiant' && "bg-gradient-to-br from-card to-primary/5 border border-primary/20 shadow-lg shadow-primary/5",
    !isSection && !isCamera && !accentColor && variant === 'outline' && "bg-transparent border-2 border-border/60",
    !isSection && !isCamera && !accentColor && variant === 'flat' && "bg-muted/30 border-transparent",
    // ---------------------------

    isEditing && !isSection && "ring-2 ring-transparent hover:ring-primary/20",
    isEditing && isSelected && !isSection && "ring-primary shadow-xl shadow-primary/10 scale-[1.005]",
    isEditing && isSection && isSelected && "outline-primary bg-primary/5 shadow-primary-ring",
    !isEditing && !isSection && "hover:shadow-lg hover:border-primary/20"
  );
}
