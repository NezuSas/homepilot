import type { HomeAssistantReconciliationState } from '../../../../packages/integrations/home-assistant/application/ports/HomeAssistantStateReader';
import { getHomeAssistantDeviceProfile, listSupportedHomeAssistantDomains } from '../../../../packages/devices/domain/deviceProfiles';

export interface HaEntityCatalogOptions {
  readonly isModeAll: boolean;
  readonly isSummaryView: boolean;
}

/** Lee las opciones `mode=all` y `view=summary` de la URL de la solicitud. */
export function parseHaEntityCatalogOptions(requestUrl: string | undefined): HaEntityCatalogOptions {
  const searchParams = new URL(requestUrl || '/', 'http://homepilot.local').searchParams;
  return {
    isModeAll: searchParams.get('mode') === 'all',
    isSummaryView: searchParams.get('view') === 'summary',
  };
}

/**
 * Filtra los estados de Home Assistant (excluye entidades ya importadas y, salvo
 * `mode=all`, dominios no soportados) y los proyecta al formato de descubrimiento.
 */
export function buildHaEntityCatalog(
  allStates: ReadonlyArray<HomeAssistantReconciliationState>,
  existingEntityIds: ReadonlySet<string>,
  options: HaEntityCatalogOptions,
) {
  const { isModeAll, isSummaryView } = options;
  const supportedDomains = listSupportedHomeAssistantDomains();

  return allStates
    .filter((s) => {
      if (existingEntityIds.has(s.entity_id)) return false;

      const domain = s.entity_id.split('.')[0];
      if (isModeAll) return true;
      return supportedDomains.includes(domain);
    })
    .map((s) => {
      const profile = getHomeAssistantDeviceProfile(s.entity_id);
      const baseEntity = {
        entityId: s.entity_id,
        friendlyName: (s.attributes.friendly_name as string) || s.entity_id,
        domain: s.entity_id.split('.')[0],
        available: s.state !== 'unavailable' && s.state !== 'offline',
        profile: isSummaryView
          ? {
              displayName: profile.displayName,
              category: profile.category,
              supportedCommandCount: profile.supportedCommands.length,
            }
          : profile,
      };

      return isSummaryView
        ? baseEntity
        : {
            ...baseEntity,
            state: s.state,
            invertState: 0,
            attributes: s.attributes,
          };
    });
}
