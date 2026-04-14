import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { HomeAssistantClient } from '../../devices/infrastructure/adapters/HomeAssistantClient';
import { AssistantFinding, generateFindingFingerprint } from '../domain/AssistantFinding';
import { ContextAnalysisService, SystemContext } from './ContextAnalysisService';
import { FindingScorer } from './FindingScorer';

export class AssistantDetectionService {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly haClient: HomeAssistantClient,
    private readonly contextService: ContextAnalysisService
  ) {}

  public async scan(homeId: string): Promise<Partial<AssistantFinding>[]> {
    let findings: Partial<AssistantFinding>[] = [];

    // 0. Analyze Context
    const context = await this.contextService.analyzeContext(homeId);

    // 1. Detect different types
    findings.push(...await this.detectNewDevices(homeId));
    findings.push(...await this.detectMissingRooms(homeId));
    findings.push(...await this.detectTechnicalNames(homeId));
    findings.push(...await this.detectDuplicateNames(homeId));
    findings.push(...await this.detectSuggestions(context));

    // 2. Apply Scoring & Noise Control
    findings = findings.map(f => ({
      ...f,
      score: FindingScorer.calculateScore(f.type!, f.severity as any, f.metadata || {})
    }));

    // Noise Control: Filter out very low score findings if we have high-value ones
    const highValueCount = findings.filter(f => f.score! >= 70).length;
    if (highValueCount > 5) {
      // If we have many high-value findings, suppress low-value noise
      findings = findings.filter(f => f.score! >= 40);
    }

    return findings;
  }

  private async detectSuggestions(context: SystemContext): Promise<Partial<AssistantFinding>[]> {
    const suggestions: Partial<AssistantFinding>[] = [];

    // A. Automation Suggections (Motion + Light)
    for (const pair of context.insights.motionLightPairs) {
      suggestions.push({
        fingerprint: generateFindingFingerprint('automation_suggestion', pair.roomId, 'motion_light'),
        type: 'automation_suggestion',
        severity: 'medium',
        relatedEntityType: 'room',
        relatedEntityId: pair.roomId,
        actions: [
          { type: 'configure_automation', label: 'assistant.actions.configure', payload: { type: 'motion_light', roomId: pair.roomId } },
          { type: 'ignore', label: 'assistant.actions.ignore' }
        ],
        metadata: {
          subtype: 'motion_light',
          roomName: pair.roomName,
          sensorCount: pair.sensors.length,
          lightCount: pair.lights.length
        }
      });
    }

    // B. Scene Suggestions (Light + Cover)
    for (const pair of context.insights.lightCoverPairs) {
      suggestions.push({
        fingerprint: generateFindingFingerprint('scene_suggestion', pair.roomId, 'light_cover'),
        type: 'scene_suggestion',
        severity: 'low',
        relatedEntityType: 'room',
        relatedEntityId: pair.roomId,
        actions: [
          { type: 'configure_scene', label: 'assistant.actions.configure', payload: { type: 'night_mode', roomId: pair.roomId } },
          { type: 'ignore', label: 'assistant.actions.ignore' }
        ],
        metadata: {
          subtype: 'light_cover',
          roomName: pair.roomName,
          lightCount: pair.lights.length,
          coverCount: pair.covers.length
        }
      });
    }

    // C. Optimization Suggestions (Always-ON)
    for (const opt of context.insights.potentialOptimizations) {
      suggestions.push({
        fingerprint: generateFindingFingerprint('optimization_suggestion', opt.deviceId, opt.type),
        type: 'optimization_suggestion',
        severity: 'low',
        relatedEntityType: 'device',
        relatedEntityId: opt.deviceId,
        actions: [
          { type: 'configure_optimization', label: 'assistant.actions.configure', payload: { deviceId: opt.deviceId } },
          { type: 'ignore', label: 'assistant.actions.ignore' }
        ],
        metadata: {
          subtype: opt.type,
          deviceName: opt.deviceName,
          reason: opt.reason
        }
      });
    }

    return suggestions;
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
