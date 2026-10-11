import { DASHBOARD_ICON_DEFAULTS } from '../components/dashboardIconRegistry';
import { normalizeKind } from './sectionCardKinds';
import type { SectionCardIcon, SectionCardKind } from './sectionCardTypes';

export function getCatalogLabelKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'info_time':
    case 'info_weather':
    case 'info_sensor':
      return 'dashboard.editor.sections.section_card_information';
    case 'light':
      return 'dashboard.editor.sections.section_card_light';
    case 'cover':
      return 'dashboard.editor.sections.section_card_cover';
    case 'camera':
      return 'dashboard.editor.sections.section_card_camera';
    case 'sensor':
      return 'dashboard.editor.sections.section_card_sensor';
    case 'media':
      return 'dashboard.editor.sections.section_card_media';
    case 'action':
      return 'dashboard.editor.sections.section_card_action';
    case 'room':
      return 'dashboard.editor.sections.section_card_room';
    case 'scene':
      return 'dashboard.editor.sections.section_card_scene';
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'dashboard.editor.sections.section_card_clock';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant';
    case 'device':
    default:
      return 'dashboard.editor.sections.section_card_device';
  }
}

export function getCatalogDescriptionKey(kind: SectionCardKind) {
  switch (normalizeKind(kind)) {
    case 'info_time':
    case 'info_weather':
    case 'info_sensor':
      return 'dashboard.editor.sections.section_card_information_desc';
    case 'light':
      return 'dashboard.editor.sections.section_card_light_desc';
    case 'cover':
      return 'dashboard.editor.sections.section_card_cover_desc';
    case 'camera':
      return 'dashboard.editor.sections.section_card_camera_desc';
    case 'sensor':
      return 'dashboard.editor.sections.section_card_sensor_desc';
    case 'media':
      return 'dashboard.editor.sections.section_card_media_desc';
    case 'action':
      return 'dashboard.editor.sections.section_card_action_desc';
    case 'room':
      return 'dashboard.editor.sections.section_card_room_desc';
    case 'scene':
      return 'dashboard.editor.sections.section_card_scene_desc';
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return 'dashboard.editor.sections.section_card_clock_desc';
    case 'energy':
      return 'dashboard.editor.sections.section_card_energy_desc';
    case 'assistant':
      return 'dashboard.editor.sections.section_card_assistant_desc';
    case 'device':
    default:
      return 'dashboard.editor.sections.section_card_device_desc';
  }
}

export function getDefaultIcon(kind: SectionCardKind): SectionCardIcon {
  switch (normalizeKind(kind)) {
    case 'info_time':
      return DASHBOARD_ICON_DEFAULTS.clock;
    case 'info_weather':
    case 'info_sensor':
      return DASHBOARD_ICON_DEFAULTS.sensor;
    case 'light':
      return DASHBOARD_ICON_DEFAULTS.light;
    case 'cover':
      return DASHBOARD_ICON_DEFAULTS.cover;
    case 'camera':
      return DASHBOARD_ICON_DEFAULTS.camera;
    case 'sensor':
      return DASHBOARD_ICON_DEFAULTS.sensor;
    case 'media':
      return DASHBOARD_ICON_DEFAULTS.media;
    case 'action':
      return DASHBOARD_ICON_DEFAULTS.action;
    case 'room':
      return DASHBOARD_ICON_DEFAULTS.room;
    case 'scene':
      return DASHBOARD_ICON_DEFAULTS.scene;
    case 'clock_digital':
    case 'clock_analog':
    case 'clock_premium':
    case 'clock_minimal':
      return DASHBOARD_ICON_DEFAULTS.clock;
    case 'energy':
      return DASHBOARD_ICON_DEFAULTS.energy;
    case 'assistant':
      return DASHBOARD_ICON_DEFAULTS.assistant;
    case 'device':
    default:
      return DASHBOARD_ICON_DEFAULTS.device;
  }
}
