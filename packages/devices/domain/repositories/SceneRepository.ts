import { Scene } from '../Scene';

export interface SceneRepository {
  findSceneById(id: string): Promise<Scene | null>;
  findScenesByHomeId(homeId: string): Promise<Scene[]>;
  saveScene(scene: Scene): Promise<void>;
  deleteScene(id: string): Promise<void>;
}
