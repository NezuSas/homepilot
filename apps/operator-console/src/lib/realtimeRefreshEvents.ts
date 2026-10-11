export const REALTIME_REFRESH_DEBOUNCE_MS = 300;

/** Realtime events that change what the device snapshot and assistant findings show. */
export const REFRESH_TRIGGER_EVENTS: readonly string[] = [
  'DeviceDiscoveredEvent',
  'DeviceCommandDispatchedEvent',
  'DeviceStateUpdatedEvent',
  'HomeAssistantStateUpdatedEvent',
  'HomeCreatedEvent',
  'RoomCreatedEvent',
  'DeviceAssignedToRoomEvent',
];
