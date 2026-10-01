import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Keep the named typography scale from tailwind.config.js separate from text colors.
// Otherwise text-body-compact is treated as a color and discards text-primary-foreground.
const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [
        'nano', 'micro', 'label', 'caption', 'body-compact', 'body', 'body-lg',
        'card-title', 'section-title', 'panel-title', 'view-title', 'display-title',
        'hero-title', 'hero-title-lg', 'widget-title-fluid', 'widget-title-compact-fluid',
        'widget-title-small-fluid', 'dashboard-section-title-fluid', 'widget-caption-fluid',
        'widget-body-fluid', 'widget-body-lg-fluid', 'widget-metric-fluid',
        'sensor-percentage-value-fluid', 'sensor-value-fluid', 'sensor-title-fluid',
        'clock-caption-fluid', 'clock-label-fluid', 'clock-micro-fluid', 'clock-seconds-fluid',
        'clock-period-fluid', 'clock-time-2xl-fluid', 'clock-time-xl-fluid', 'clock-time-lg-fluid',
        'clock-time-md-fluid', 'clock-analog-label-fluid', 'clock-analog-time-fluid',
        'clock-minimal-label-fluid', 'clock-minimal-time-fluid', 'clock-digital-label-fluid',
        'clock-digital-body-fluid', 'clock-digital-micro-fluid',
      ] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return mergeClasses(clsx(inputs))
}
