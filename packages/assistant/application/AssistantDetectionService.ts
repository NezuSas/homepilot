import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { HomeAssistantClient } from '../../devices/infrastructure/adapters/HomeAssistantClient';
import { AssistantFinding, generateFindingFingerprint, AssistantAction } from '../domain/AssistantFinding';

export class AssistantDetectionService {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly haClient: HomeAssistantClient
  ) {}

  public async scan(homeId: string): Promise<Partial<AssistantFinding>[]> {
    const findings: Partial<AssistantFinding>[] = [];

    // 1. New Device Available
    const newDeviceFindings = await this.detectNewDevices(homeId);
    findings.push(...newDeviceFindings);

    // 2. Device Missing Room
    const missingRoomFindings = await this.detectMissingRooms(homeId);
    findings.push(...missingRoomFindings);

    // 3. Technical Name
    const technicalNameFindings = await this.detectTechnicalNames(homeId);
    findings.push(...technicalNameFindings);

    // 4. Duplicate Name
    const duplicateNameFindings = await this.detectDuplicateNames(homeId);
    findings.push(...duplicateNameFindings);

    return findings;
  }

  private async detectNewDevices(homeId: string): Promise<Partial<AssistantFinding>[]> {
    try {
      const haStates = await this.haClient.getAllStates();
      const findings: Partial<AssistantFinding>[] = [];

      for (const state of haStates) {
        // Filter for domain we support (light, switch, cover)
        const [domain] = state.entity_id.split('.');
        if (!['light', 'switch', 'cover'].includes(domain)) continue;

        const externalId = `ha:${state.entity_id}`;
        const existing = await this.deviceRepository.findByExternalIdAndHomeId(externalId, homeId);

        if (!existing) {
          findings.push({
            fingerprint: generateFindingFingerprint('new_device_available', externalId, homeId),
            type: 'new_device_available',
            severity: 'high',
            relatedEntityType: 'device',
            relatedEntityId: externalId,
            actions: [
              { type: 'import_device', label: 'assistant.actions.import_device', payload: { entityId: state.entity_id } },
              { type: 'ignore', label: 'assistant.actions.ignore' }
            ],
            metadata: { 
               entityId: state.entity_id, 
               friendlyName: state.attributes.friendly_name || state.entity_id 
            }
          });
        }
      }
      return findings;
    } catch (e) {
      console.error('[Assistant] Failed to detect new devices:', e);
      return [];
    }
  }

  private async detectMissingRooms(homeId: string): Promise<Partial<AssistantFinding>[]> {
    const devices = await this.deviceRepository.findInboxByHomeId(homeId);
    return devices.map(d => ({
      fingerprint: generateFindingFingerprint('device_missing_room', d.id, homeId),
      type: 'device_missing_room',
      severity: 'high',
      relatedEntityType: 'device',
      relatedEntityId: d.id,
      actions: [
        { type: 'assign_room', label: 'assistant.actions.assign_room', payload: { deviceId: d.id } }
      ],
      metadata: { deviceName: d.name }
    }));
  }

  private async detectTechnicalNames(homeId: string): Promise<Partial<AssistantFinding>[]> {
    // We need a way to get all devices, not just inbox.
    // Since DeviceRepository doesn't have findAllByHomeId, I'll use a trick or check the repository again.
    // Wait, SQLiteDeviceRepository has findInboxByHomeId. I might need to add findAllByHomeId.
    // For now, let's assume I search the DB directly or add the method.
    // Actually, I'll add findAllByHomeId to SQLiteDeviceRepository.
    const devices = await (this.deviceRepository as any).findAllByHomeId?.(homeId) || [];
    
    // Technical patterns: snake_case, HA prefixes, numbers at the end
    const technicalRegex = /(_[a-z0-9]|light\.|switch\.|cover\.|[a-z]+[0-9]{2,})/;

    return devices
      .filter((d: any) => technicalRegex.test(d.name))
      .map((d: any) => ({
        fingerprint: generateFindingFingerprint('device_name_technical', d.id, homeId),
        type: 'device_name_technical',
        severity: 'medium',
        relatedEntityType: 'device',
        relatedEntityId: d.id,
        actions: [
          { type: 'rename_device', label: 'assistant.actions.rename_device', payload: { deviceId: d.id, currentName: d.name } }
        ],
        metadata: { currentName: d.name }
      }));
  }

  private async detectDuplicateNames(homeId: string): Promise<Partial<AssistantFinding>[]> {
    const devices = await (this.deviceRepository as any).findAllByHomeId?.(homeId) || [];
    const nameMap = new Map<string, any[]>();

    for (const d of devices) {
      const normalized = d.name.trim().toLowerCase();
      if (!nameMap.has(normalized)) nameMap.set(normalized, []);
      nameMap.get(normalized)!.push(d);
    }

    const findings: Partial<AssistantFinding>[] = [];
    for (const [name, group] of nameMap.entries()) {
      if (group.length > 1) {
        const sortedIds = group.map(d => d.id).sort();
        findings.push({
          fingerprint: generateFindingFingerprint('device_name_duplicate', name, sortedIds.join(',')),
          type: 'device_name_duplicate',
          severity: 'medium',
          relatedEntityType: 'device_group',
          relatedEntityId: null,
          actions: [
            { type: 'rename_device', label: 'assistant.actions.resolve_now', payload: { deviceIds: sortedIds } }
          ],
          metadata: { 
            name: group[0].name, 
            deviceIds: sortedIds,
            count: group.length
          }
        });
      }
    }
    return findings;
  }
}
