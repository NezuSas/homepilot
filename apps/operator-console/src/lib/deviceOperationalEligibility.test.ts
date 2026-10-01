import { isDeviceOperational, isFindingOperational } from './deviceOperationalEligibility';
import type { AssistantFinding } from '../stores/useAssistantStore';

const rooms = [{ id: 'office', homeId: 'home' }];
const devices = [{ id: 'assigned', homeId: 'home', roomId: 'office' }, { id: 'pending', homeId: 'home', roomId: null }];
const finding: AssistantFinding = { id: 'f', type: 'habit_pattern_detected', severity: 'medium', title: '', description: '',
  relatedEntityType: 'device', relatedEntityId: 'pending', actions: [], metadata: {}, score: 1, status: 'open' };

describe('Feature: Operational room eligibility (AC60)', () => {
  it('requires an existing room of the same home, not just a roomId', () => {
    expect(isDeviceOperational(devices[0], rooms)).toBe(true);
    expect(isDeviceOperational(devices[1], rooms)).toBe(false);
    expect(isDeviceOperational({ ...devices[0], roomId: 'deleted' }, rooms)).toBe(false);
    expect(isDeviceOperational({ ...devices[0], homeId: 'other-home' }, rooms)).toBe(false);
  });
  it('keeps configuration alerts while excluding operational recommendations for unassigned devices', () => {
    expect(isFindingOperational(finding, devices, rooms)).toBe(false);
    expect(isFindingOperational({ ...finding, type: 'device_missing_room' }, devices, rooms)).toBe(true);
    expect(isFindingOperational({ ...finding, type: 'new_device_available' }, devices, rooms)).toBe(true);
    expect(isFindingOperational({ ...finding, relatedEntityId: 'assigned' }, devices, rooms)).toBe(true);
    expect(isFindingOperational({ ...finding, relatedEntityType: 'room', relatedEntityId: 'deleted' }, devices, rooms)).toBe(false);
  });
  it('checks every action target and does not mutate inventory or historical bindings', () => {
    const original = JSON.stringify(devices);
    expect(isFindingOperational({ ...finding, relatedEntityId: 'assigned', actions: [{ type: 'configure_automation', label: '', payload: { targetDeviceId: 'pending' } }] }, devices, rooms)).toBe(false);
    expect(isFindingOperational({ ...finding, relatedEntityId: null, metadata: { deviceIds: ['assigned', 'pending'] } }, devices, rooms)).toBe(false);
    expect(JSON.stringify(devices)).toBe(original);
  });
});
