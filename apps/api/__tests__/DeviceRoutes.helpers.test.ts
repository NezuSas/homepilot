import { hasValidIntegrationKey } from '../routes/device/deviceIntegrationKey';
import { mapActionExecuteError, mapAssignError, mapCommandError, mapDeviceReadError, mapHaImportError } from '../routes/device/deviceErrorMapping';
import { isAcceptedSemanticType, resolveDevicePatch, semanticTypeConflict } from '../routes/device/devicePatchRules';
import { buildHaEntityCatalog, parseHaEntityCatalogOptions } from '../routes/device/haEntityCatalog';
import { toControlCatalogView, toEffectiveActionsView } from '../routes/device/deviceSerialization';
import type { DeviceControlCatalog } from '../../../packages/cloud-gateway/application/DeviceControlCatalogProvider';
import type { EffectiveAction } from '../../../packages/cloud-gateway/application/EffectiveActionsResolver';
import type { HomeAssistantReconciliationState } from '../../../packages/integrations/home-assistant/application/ports/HomeAssistantStateReader';

describe('device route helpers', () => {
  describe('hasValidIntegrationKey', () => {
    const original = process.env.HOMEPILOT_INTEGRATION_API_KEY;
    afterEach(() => {
      if (original === undefined) delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
      else process.env.HOMEPILOT_INTEGRATION_API_KEY = original;
    });

    it('accepts only an exact key match', () => {
      process.env.HOMEPILOT_INTEGRATION_API_KEY = 'secret-key';
      expect(hasValidIntegrationKey({ 'x-homepilot-integration-key': 'secret-key' })).toBe(true);
      expect(hasValidIntegrationKey({ 'x-homepilot-integration-key': ['secret-key'] })).toBe(true);
      expect(hasValidIntegrationKey({ 'x-homepilot-integration-key': 'secret-kez' })).toBe(false);
      expect(hasValidIntegrationKey({ 'x-homepilot-integration-key': 'short' })).toBe(false);
      expect(hasValidIntegrationKey({})).toBe(false);
    });

    it('rejects everything when no key is configured', () => {
      delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
      expect(hasValidIntegrationKey({ 'x-homepilot-integration-key': 'anything' })).toBe(false);
    });
  });

  describe('error mapping', () => {
    it('maps assign errors', () => {
      expect(mapAssignError('DeviceNotFoundError', '')).toEqual({ status: 404, code: 'DEVICE_NOT_FOUND' });
      expect(mapAssignError('ForbiddenOwnershipError', '')).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(mapAssignError('Error', 'device already assigned')).toEqual({ status: 409, code: 'ALREADY_ASSIGNED' });
      expect(mapAssignError('Error', 'boom')).toEqual({ status: 500, code: 'ASSIGN_ERROR' });
    });

    it('maps command errors', () => {
      expect(mapCommandError('TopologyResourceNotFoundError')).toEqual({ status: 404, code: 'DEVICE_NOT_FOUND' });
      expect(mapCommandError('InvalidDeviceCommandError')).toEqual({ status: 400, code: 'INVALID_COMMAND' });
      expect(mapCommandError('DispatchIntegrationError')).toEqual({ status: 502, code: 'COMMAND_DISPATCH_FAILED' });
      expect(mapCommandError('Error')).toEqual({ status: 500, code: 'COMMAND_ERROR' });
    });

    it('maps action execution errors including IntentFlow variants', () => {
      expect(mapActionExecuteError('Error', 'INVALID_JSON')).toEqual({ status: 400, code: 'INVALID_COMMAND' });
      expect(mapActionExecuteError('IntentFlowCommandError', 'INTENTFLOW_COMMAND_FORBIDDEN')).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(mapActionExecuteError('IntentFlowCommandError', 'INTENTFLOW_COMMAND_DEVICE_UNAVAILABLE')).toEqual({ status: 400, code: 'DISPLAY_OFFLINE' });
      expect(mapActionExecuteError('IntentFlowCommandError', 'INTENTFLOW_COMMAND_CONFIRMATION_REQUIRED')).toEqual({ status: 409, code: 'COMMAND_CONFIRMATION_REQUIRED' });
      expect(mapActionExecuteError('IntentFlowCommandError', 'INTENTFLOW_COMMAND_ROUTE_MISMATCH')).toEqual({ status: 502, code: 'COMMAND_ROUTE_MISMATCH' });
      expect(mapActionExecuteError('IntentFlowCommandError', 'other')).toEqual({ status: 502, code: 'COMMAND_DISPATCH_FAILED' });
      expect(mapActionExecuteError('DirectoryTokenError', 'x')).toEqual({ status: 502, code: 'COMMAND_DISPATCH_FAILED' });
      expect(mapActionExecuteError('Error', 'x')).toEqual({ status: 500, code: 'COMMAND_ERROR' });
    });

    it('maps import and read errors', () => {
      expect(mapHaImportError('DEVICE_ALREADY_EXISTS')).toEqual({ status: 409, code: 'DEVICE_ALREADY_EXISTS' });
      expect(mapHaImportError('HOME_NOT_FOUND')).toEqual({ status: 404, code: 'HOME_NOT_FOUND' });
      expect(mapHaImportError('HA_ENTITY_NOT_FOUND')).toEqual({ status: 404, code: 'HA_ENTITY_NOT_FOUND' });
      expect(mapHaImportError('x')).toEqual({ status: 500, code: 'IMPORT_ERROR' });
      expect(mapDeviceReadError('DeviceNotFoundError')).toEqual({ status: 404, code: 'DEVICE_NOT_FOUND' });
      expect(mapDeviceReadError('ForbiddenOwnershipError')).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(mapDeviceReadError('Error')).toEqual({ status: 500, code: 'INTERNAL_ERROR' });
    });
  });

  describe('device patch rules', () => {
    it('validates semantic types', () => {
      expect(isAcceptedSemanticType(null)).toBe(true);
      expect(isAcceptedSemanticType('smart_display')).toBe(true);
      expect(isAcceptedSemanticType('scene')).toBe(false);
      expect(isAcceptedSemanticType(3)).toBe(false);
    });

    it('enforces Android Display semantic constraints', () => {
      expect(semanticTypeConflict('android-display', 'light')).toBe('Smart Display semantic type is fixed');
      expect(semanticTypeConflict('android-display', 'smart_display')).toBeNull();
      expect(semanticTypeConflict('ha', 'smart_display')).toBe('Smart Display semantic type requires Android Display');
      expect(semanticTypeConflict('ha', 'light')).toBeNull();
    });

    it('resolves name and invertState patches', () => {
      const device = { name: 'Lamp', invertState: false };
      expect(resolveDevicePatch(device, {})).toEqual({ name: 'Lamp', invertState: false, changed: false });
      expect(resolveDevicePatch(device, { name: '  ' })).toMatchObject({ name: 'Lamp', changed: false });
      expect(resolveDevicePatch(device, { name: ' Desk ', invertState: true })).toEqual({ name: 'Desk', invertState: true, changed: true });
    });
  });

  describe('Home Assistant entity catalog', () => {
    const states = [
      { entity_id: 'light.kitchen', state: 'on', attributes: { friendly_name: 'Kitchen' } },
      { entity_id: 'light.imported', state: 'off', attributes: {} },
      { entity_id: 'weather.home', state: 'unavailable', attributes: {} },
    ] as unknown as HomeAssistantReconciliationState[];

    it('parses mode and view options', () => {
      expect(parseHaEntityCatalogOptions('/api/v1/ha/entities?mode=all&view=summary')).toEqual({ isModeAll: true, isSummaryView: true });
      expect(parseHaEntityCatalogOptions(undefined)).toEqual({ isModeAll: false, isSummaryView: false });
    });

    it('excludes imported entities and unsupported domains unless mode=all', () => {
      const imported = new Set(['light.imported']);
      const supported = buildHaEntityCatalog(states, imported, { isModeAll: false, isSummaryView: false });
      expect(supported.map((e) => e.entityId)).toEqual(['light.kitchen']);
      expect(supported[0]).toMatchObject({ friendlyName: 'Kitchen', available: true, state: 'on', invertState: 0 });

      const all = buildHaEntityCatalog(states, imported, { isModeAll: true, isSummaryView: true });
      expect(all.map((e) => e.entityId)).toEqual(['light.kitchen', 'weather.home']);
      expect(all[1]).toMatchObject({ available: false });
      expect(all[0]).not.toHaveProperty('state');
    });
  });

  describe('serialization', () => {
    it('projects effective actions without internal fields', () => {
      const actions = [{
        key: 'home', displayName: 'Home', semanticAction: 'navigate_home', controlType: 'button',
        visibility: 'visible', safetyLevel: 'normal', requiresConfirmation: false, internal: 'x',
      }] as unknown as EffectiveAction[];
      const view = toEffectiveActionsView('dev-1', actions);
      expect(view.deviceId).toBe('dev-1');
      expect(view.actions[0]).not.toHaveProperty('internal');
      expect(view.actions[0].key).toBe('home');
    });

    it('omits the execution route from catalog commands', () => {
      const catalog = {
        deviceId: 'dev-1',
        plan: { id: 1, name: null, type: null },
        commands: [{
          key: 'k', displayName: 'K', implementationType: 'homepilot', controlType: 'button', visibility: 'visible',
          safetyLevel: 'normal', requiresConfirmation: false, executionRoute: 'homepilot',
          executableInHomePilot: true, dashboardEligible: true,
        }],
      } as unknown as DeviceControlCatalog;
      const view = toControlCatalogView(catalog);
      expect(view.commands[0]).not.toHaveProperty('executionRoute');
      expect(view.commands[0]).not.toHaveProperty('semanticAction');
      expect(view.deviceId).toBe('dev-1');
    });
  });
});
