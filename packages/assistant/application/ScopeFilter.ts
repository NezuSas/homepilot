import { Device } from '../../devices/domain/types';
import { DeviceCommandV1 } from '../../devices/domain/commands';
import { resolveCapabilitiesForDevice } from '../../devices/domain/CapabilityResolver';
import { validateDeviceCommand } from '../../devices/domain/CommandCapabilityValidator';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';

/**
 * ScopeFilter
 *
 * Single source of truth for "which devices does a command actually apply to
 * right now" — availability, capability, semantic category (lights vs.
 * generic switches), and whether a command would actually change the current
 * state. Extracted from AssistantConversationService so every fast path
 * (global bulk, room bulk, ticket-accept revalidation, draft creation, state
 * queries) shares one implementation instead of copies that can drift apart.
 */
export class ScopeFilter {
  public isDeviceAvailable(device: Device): boolean {
    return device.lastKnownState?.state !== 'unavailable';
  }

  public supportsCommand(device: Device, command: DeviceCommandV1): boolean {
    // A. Priority: Capability Validation
    const validation = validateDeviceCommand(device, { name: command, params: {} });
    if (validation.valid) return true;

    // B. Fallback: Known controllable domain types if capabilities missing/incomplete
    const type = device.type.toLowerCase();
    const CONTROLLABLE_TYPES = ['light', 'switch', 'outlet', 'dimmer'];
    const isKnownType = CONTROLLABLE_TYPES.includes(type);

    if (isKnownType && ['turn_on', 'turn_off', 'toggle'].includes(command)) {
      return true;
    }

    const COVER_COMMANDS = ['open', 'close', 'stop', 'set_position'];
    if (type === 'cover' && COVER_COMMANDS.includes(command)) {
      return true;
    }

    return false;
  }

  public isLightEntity(device: Device): boolean {
    // Priority 1: User-assigned semantic classification (overrides hardware type)
    if (device.semanticType === 'light') return true;
    if (device.semanticType != null && device.semanticType !== 'unknown') {
      // Any other explicit semanticType means it's NOT a light
      return false;
    }

    // Priority 2: Capability-based detection
    const caps = resolveCapabilitiesForDevice(device);
    if (caps.some(c => c.type === 'light' || c.type === 'dimmer')) return true;

    // Priority 3: Hardware device.type fallback
    if (['light', 'dimmer'].includes(device.type.toLowerCase())) return true;

    // Priority 4: Conservative fallback for HA switches with an explicit light name.
    // Manual semantic classification above always takes precedence.
    const normalizedName = normalizeAssistantPrompt(device.name);
    return /^(luz|luces|lampara|lamparas|foco|focos)(\s|$)/.test(normalizedName);
  }

  public isControllableForBulk(device: Device, command: DeviceCommandV1, bulkType: 'all' | 'lights'): boolean {
    if (!this.isDeviceAvailable(device)) return false;
    if (!this.supportsCommand(device, command)) return false;

    // Exclude sensors/cameras even if they somehow report turn_on/off support
    const type = device.type.toLowerCase();
    if (['sensor', 'binary_sensor', 'camera'].includes(type)) return false;

    // Exclude covers/blinds/curtains for turn_on/turn_off
    if (['cover', 'blind', 'curtain', 'shutter'].includes(type) && (command === 'turn_on' || command === 'turn_off')) {
      return false;
    }

    if (bulkType === 'lights' && !this.isLightEntity(device)) return false;

    return true;
  }

  /**
   * Whether sending `command` to `device` would actually change its state.
   * An unknown/non-binary state (e.g. "unavailable", "open", "playing", or no
   * lastKnownState at all) is never assumed to already satisfy the target —
   * only a state we can positively confirm matches the target is excluded.
   * This keeps bulk actions ("apaga todo") from silently skipping devices
   * whose state simply wasn't reported cleanly.
   */
  public requiresBulkStateChange(device: Device, command: DeviceCommandV1): boolean {
    const state = device.lastKnownState;
    const isOn = state?.on === true || state?.state === 'on' || state?.power === 'on';
    const isOff = state?.on === false || state?.state === 'off' || state?.power === 'off';

    if (command === 'turn_off') return !isOff;
    if (command === 'turn_on') return !isOn;
    return false;
  }

  public isControllableDevice(device: Device, command: DeviceCommandV1): boolean {
    if (!this.isDeviceAvailable(device)) return false;

    // Always exclude pure sensors/cameras — these are never controllable
    const type = device.type.toLowerCase();
    if (['sensor', 'binary_sensor', 'camera'].includes(type)) return false;

    return this.supportsCommand(device, command);
  }
}
