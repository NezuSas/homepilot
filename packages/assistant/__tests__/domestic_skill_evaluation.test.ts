import { DomesticSkill, DomesticSkillResolver } from '../application/DomesticSkillResolver';
import { PermissionGate } from '../application/PermissionGate';
import {
  createMockAutomationRuleRepository,
  createMockDeviceRepository,
  createMockHomeRepository,
  createMockRoomRepository,
  createMockSceneRepository,
  createTestDevice,
  createTestHome,
  createTestRoom,
  createTestScene
} from './test_helpers';

describe('DomesticSkillResolver evaluation corpus', () => {
  function createEvaluationFixture() {
    const devices = createMockDeviceRepository();
    const rooms = createMockRoomRepository();
    const scenes = createMockSceneRepository();
    const homes = createMockHomeRepository({
      findHomesByUserId: jest.fn().mockResolvedValue([createTestHome({ id: 'home-1' })])
    });
    const gate = new PermissionGate(
      devices,
      rooms,
      scenes,
      createMockAutomationRuleRepository(),
      homes
    );

    rooms.findRoomsByHomeId.mockResolvedValue([createTestRoom({ id: 'living', name: 'Living Room' })]);
    devices.findAllByHomeId.mockResolvedValue([
      createTestDevice({ id: 'light-1', name: 'Reading light', roomId: 'living', lastKnownState: { on: true } }),
      createTestDevice({ id: 'cover-1', name: 'Living blind', roomId: 'living', type: 'cover' })
    ]);
    scenes.findScenesByHomeId.mockResolvedValue([
      createTestScene({ id: 'scene-movie', name: 'Movie night', roomId: 'living' }),
      createTestScene({ id: 'scene-night', name: 'Sleep well', roomId: 'living' })
    ]);

    return new DomesticSkillResolver(gate);
  }

  it.each([
    ['Dime algo interesante sobre mi casa', 'es', 'home_insight'],
    ['Tell me something interesting about my home', 'en', 'home_insight'],
    ['Quiero una sala acogedora', 'es', 'room_comfort'],
    ['Make the living room cozy', 'en', 'room_comfort'],
    ['¿Qué opciones tengo para la noche?', 'es', 'night_options'],
    ['What can I do tonight at home?', 'en', 'night_options'],
    ['¿Qué escena puedo usar para ver una película?', 'es', 'scene_discovery'],
    ['Quiero una experiencia de cine en el salón', 'es', 'room_comfort'],
    ['I want a calm movie experience in the living room', 'en', 'room_comfort'],
    ['¿Qué escenas tengo disponibles?', 'es', 'scene_inventory'],
    ['What scenes are available?', 'en', 'scene_inventory'],
    ['What scene can I use for a movie?', 'en', 'scene_discovery']
  ] satisfies ReadonlyArray<readonly [string, 'es' | 'en', DomesticSkill]>)
    ('classifies %s as %s without execution', async (prompt, language, expectedSkill) => {
      const resolver = createEvaluationFixture();

      const result = await resolver.resolve(prompt, 'user-1', language);

      expect(result).toEqual(expect.objectContaining({ skill: expectedSkill }));
      expect(result?.message).not.toContain('completed');
    });
});
