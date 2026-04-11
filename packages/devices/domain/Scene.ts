export interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off';
}

export interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  actions: SceneAction[];
  createdAt: string;
  updatedAt: string;
}
