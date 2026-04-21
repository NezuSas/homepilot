import type { DashboardTemplate } from './types';

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'overview',
    name: 'Dashboard Overview',
    description: 'Vista general del hogar con control de energía y actividad.',
    widgets: [
      {
        id: 'energy-main',
        type: 'energy_snapshot',
        config: {
          layout: { x: 0, y: 0, w: 4, h: 6 },
          binding: { entityId: '', entityType: 'energy' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { variant: 'glass', title: 'Energía Real', showTitle: true }
        }
      },
      {
        id: 'activity-feed-1',
        type: 'activity_feed',
        config: {
          layout: { x: 4, y: 0, w: 4, h: 6 },
          binding: { entityId: 'system', entityType: 'system' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { variant: 'glass', title: 'Actividad Reciente', showTitle: true }
        }
      },
      {
        id: 'system-health-1',
        type: 'system_status',
        config: {
          layout: { x: 8, y: 0, w: 4, h: 6 },
          binding: { entityId: 'server', entityType: 'system' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { variant: 'glass', title: 'Servidor', showTitle: true }
        }
      },
      {
        id: 'assistant-main',
        type: 'assistant_insight',
        config: {
          layout: { x: 0, y: 6, w: 12, h: 4 },
          binding: { entityId: 'ai', entityType: 'assistant' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { variant: 'solid', title: 'Inteligencia Nezu', showTitle: true }
        }
      }
    ]
  },
  {
    id: 'entryway-control',
    name: 'Control de Acceso',
    description: 'Optimizado para tablets en la entrada o cocina.',
    widgets: [
      {
        id: 'w-ent-1',
        type: 'device_control',
        config: {
          layout: { x: 0, y: 0, w: 4, h: 6 },
          binding: { entityId: '', entityType: 'device' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { title: 'Cerradura', variant: 'solid', showTitle: true }
        }
      },
      {
        id: 'w-ent-2',
        type: 'scene_shortcut',
        config: {
          layout: { x: 4, y: 0, w: 4, h: 3 },
          binding: { entityId: '', entityType: 'scene' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { title: 'Llegada', variant: 'radiant', showTitle: true }
        }
      },
      {
        id: 'w-ent-3',
        type: 'scene_shortcut',
        config: {
          layout: { x: 4, y: 3, w: 4, h: 3 },
          binding: { entityId: '', entityType: 'scene' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { title: 'Salida', variant: 'glass', showTitle: true }
        }
      },
      {
        id: 'w-ent-4',
        type: 'activity_feed',
        config: {
          layout: { x: 8, y: 0, w: 4, h: 6 },
          binding: { entityId: 'system', entityType: 'system' },
          visibility: { rules: [], defaultState: 'show' },
          appearance: { title: 'Eventos de Seguridad', variant: 'glass', showTitle: true }
        }
      }
    ]
  }
];
