import {
  isAttentionQuery,
  isCompanyQuery,
  isConversationContextQuery,
  isDateTimeQuery,
  isDomesticRecommendationPrompt,
  isDomesticSkillFollowUpPrompt,
  isEquivalenceQuery,
  isGreeting,
  isHelpQuery,
  isHomeSummaryQuery,
  isLikelyHomeControlPrompt,
  isNameQuery,
  isPresentation,
  isRecentActivityQuery,
  isScopeQuery,
  isWellnessQuery
} from '../application/conversation/generalQueryIntents';
import {
  containsWord,
  isDetailFollowUp,
  isInventoryCountQuery,
  isListAutomationsIntent,
  isListScenesIntent,
  isListTimersIntent,
  isManagementIntent,
  isPointStateQuery,
  isSensorReadingQuery,
  isStateQuery
} from '../application/conversation/stateQueryIntents';
import { resolveRoomAlias, resolveRoomName, resolveRoomReference } from '../application/conversation/roomAliasResolution';
import { createTestDevice, createTestRoom } from './test_helpers';

describe('Conversation intent predicates', () => {
  describe('general conversation', () => {
    it('classifies identity, help, scope, greeting and wellness prompts', () => {
      expect(isNameQuery('como te llamas')).toBe(true);
      expect(isHelpQuery('necesito ayuda')).toBe(true);
      expect(isPresentation('quien eres')).toBe(true);
      expect(isScopeQuery('what are your limits')).toBe(true);
      expect(isGreeting('hola')).toBe(true);
      expect(isGreeting('holaa')).toBe(false);
      expect(isWellnessQuery('como estas hoy')).toBe(true);
      expect(isCompanyQuery('que es nezu')).toBe(true);
      expect(isNameQuery('enciende la luz')).toBe(false);
    });

    it('classifies informational home queries', () => {
      expect(isDateTimeQuery('que hora es')).toBe(true);
      expect(isHomeSummaryQuery('dame un resumen de la casa')).toBe(true);
      expect(isAttentionQuery('which devices need attention')).toBe(true);
      expect(isRecentActivityQuery('que cambio recientemente')).toBe(true);
      expect(isConversationContextQuery('repite tu ultima respuesta')).toBe(true);
      expect(isEquivalenceQuery('cuarto es lo mismo que estancia')).toBe(true);
      expect(isEquivalenceQuery('es lo mismo que')).toBe(false);
    });

    it('classifies domestic skill follow-ups and home-control prompts', () => {
      expect(isDomesticSkillFollowUpPrompt('que mas hay')).toBe(true);
      expect(isDomesticRecommendationPrompt('que mas hay')).toBe(false);
      expect(isDomesticRecommendationPrompt('cual recomiendas')).toBe(true);
      expect(isLikelyHomeControlPrompt('prende la luz')).toBe(true);
      expect(isLikelyHomeControlPrompt('dime un chiste')).toBe(false);
      // Subjunctive and infinitive requests are still about the home.
      expect(isLikelyHomeControlPrompt('quiero que se prenda la sala 3')).toBe(true);
      expect(isLikelyHomeControlPrompt('que se apague la sala 3')).toBe(true);
      expect(isLikelyHomeControlPrompt('necesito encender la luz')).toBe(true);
    });
  });

  describe('state, listing and management', () => {
    it('matches whole words only', () => {
      expect(containsWord('luces encendidas', 'luces')).toBe(true);
      expect(containsWord('luces encendidas', 'luz')).toBe(false);
    });

    it('separates state, inventory and point-state questions', () => {
      expect(isStateQuery('que luces estan encendidas')).toBe(true);
      expect(isStateQuery('enciende esa')).toBe(false);
      expect(isInventoryCountQuery('cuantas luces hay')).toBe(true);
      expect(isInventoryCountQuery('how many devices')).toBe(true);
      expect(isPointStateQuery('esta encendida la luz de la sala')).toBe(true);
      expect(isPointStateQuery('que luces estan encendidas')).toBe(false);
      expect(isDetailFollowUp('dame detalle')).toBe(true);
      expect(isSensorReadingQuery('cual es la temperatura')).toBe(true);
      expect(isSensorReadingQuery('enciende la luz')).toBe(false);
    });

    it('recognizes listing and management intents', () => {
      expect(isListScenesIntent('que escenas tengo')).toBe(true);
      expect(isListTimersIntent('lista los temporizadores')).toBe(true);
      expect(isListAutomationsIntent('muestra las rutinas')).toBe(true);
      expect(isManagementIntent('renombra la escena cine')).toBe(true);
      expect(isManagementIntent('renombra el archivo')).toBe(false);
    });
  });

  describe('room alias resolution', () => {
    const rooms = [
      createTestRoom({ id: 'r1', name: 'Sala' }),
      createTestRoom({ id: 'r2', name: 'Cocina' })
    ];

    it('resolves an exact room name and reports unknown rooms', () => {
      expect(resolveRoomAlias('sala', rooms, [], 'u1', {})).toEqual(expect.objectContaining({ status: 'resolved', rooms: [rooms[0]] }));
      expect(resolveRoomAlias('terraza', rooms, [], 'u1', {}).status).toBe('not_found');
    });

    it('resolves a room reference from a state phrase', () => {
      const devices = [createTestDevice({ id: 'd1', roomId: 'r2' })];
      const resolution = resolveRoomReference('como esta la cocina', rooms, devices, 'u1', {});
      expect(resolution.status).toBe('resolved');
      expect(resolution.rooms).toEqual([rooms[1]]);
      expect(resolveRoomReference('nada', rooms, [], 'u1', {})).toEqual({ status: 'not_found', rooms: [] });
    });

    it('names rooms for display, including the unassigned and unknown cases', () => {
      const roomMap = new Map([['r1', 'Sala']]);
      expect(resolveRoomName('r1', roomMap, 'es')).toBe('Sala');
      expect(resolveRoomName(null, roomMap, 'en')).toBe('No room');
      expect(resolveRoomName(null, roomMap, 'es')).toBe('Sin estancia');
      jest.spyOn(console, 'debug').mockImplementation(() => undefined);
      expect(resolveRoomName('missing', roomMap, 'es')).toBe('Estancia no encontrada');
      jest.restoreAllMocks();
    });
  });
});
