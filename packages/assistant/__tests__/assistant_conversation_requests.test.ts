import {
  extractConditionalRoutineRequest,
  extractDraftName,
  extractRelativeTimerDelaySeconds,
  extractRoutineDays,
  extractRoutineTime,
  formatTimerRemaining,
  getRoutineScheduleLabel,
  isDraftCreation,
  normalizeConditionalDeviceReference
} from '../application/conversation/draftRequestParsing';
import {
  extractRoomCreationName,
  extractRoomDeletionName,
  extractRoomRenameRequest,
  isRoomCreationFollowUp,
  isRoomCreationIntent,
  isRoomDeletionIntent,
  isRoomQuery,
  isRoomRenameIntent
} from '../application/conversation/roomIntents';
import {
  extractTargetPhrase,
  isBulkFastPath,
  isRoomBulkFastPath,
  isRoomCoverFastPath,
  isRoomSingularLightFastPath,
  isSingularLightRequest,
  isVagueLightCommand
} from '../application/conversation/fastPathMatching';

describe('Conversation request parsing', () => {
  describe('draft and routine requests', () => {
    it('detects draft creation and extracts its name, time and days', () => {
      expect(isDraftCreation('crea una escena para dormir')).toBe(true);
      expect(isDraftCreation('enciende la luz')).toBe(false);
      expect(extractDraftName('crea una rutina llamada Noche en la sala', false)).toBe('Noche');
      expect(extractDraftName('crea una escena llamada Cine', false)).toBeNull();
      expect(extractRoutineTime('apaga todo a las 10 pm')).toBe('22:00');
      expect(extractRoutineTime('apaga todo at 7:30')).toBe('07:30');
      expect(extractRoutineTime('apaga todo')).toBeNull();
      expect(extractRoutineDays('de lunes a viernes')).toEqual([1, 2, 3, 4, 5]);
      expect(extractRoutineDays('every day')).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(extractRoutineDays('mañana')).toBeUndefined();
    });

    it('labels the schedule only for the weekday and daily presets', () => {
      expect(getRoutineScheduleLabel([1, 2, 3, 4, 5], 'es')).toBe('de lunes a viernes');
      expect(getRoutineScheduleLabel([1, 2, 3, 4, 5], 'en')).toBe('on weekdays');
      expect(getRoutineScheduleLabel([0, 1, 2, 3, 4, 5, 6], 'en')).toBe('every day');
      expect(getRoutineScheduleLabel([1, 3], 'es')).toBeUndefined();
      expect(getRoutineScheduleLabel(undefined, 'es')).toBeUndefined();
    });

    it('extracts conditional routines in Spanish and English', () => {
      expect(extractConditionalRoutineRequest('cuando se encienda la tv, apaga la luz')).toEqual({
        expectedValue: 'on',
        sourceName: 'la tv',
        command: 'turn_off',
        targetName: 'la luz'
      });
      expect(extractConditionalRoutineRequest('when the tv turns on, turn off the light')).toEqual({
        sourceName: 'the tv',
        expectedValue: 'on',
        command: 'turn_off',
        targetName: 'the light'
      });
      expect(extractConditionalRoutineRequest('enciende la luz')).toBeNull();
      expect(normalizeConditionalDeviceReference('La Luz')).toBe('luz');
    });

    it('extracts relative timer delays and formats the remaining time', () => {
      expect(extractRelativeTimerDelaySeconds('en 5 minutos')).toBe(300);
      expect(extractRelativeTimerDelaySeconds('dentro de media hora')).toBe(1800);
      expect(extractRelativeTimerDelaySeconds('in 2 hours')).toBe(7200);
      expect(extractRelativeTimerDelaySeconds('0 minutos')).toBeNull();
      expect(extractRelativeTimerDelaySeconds('mañana')).toBeNull();
      expect(formatTimerRemaining(30, 'es')).toBe('1 minuto');
      expect(formatTimerRemaining(3600, 'en')).toBe('1 hour');
      expect(formatTimerRemaining(5400, 'es')).toBe('1 hora y 30 minutos');
    });
  });

  describe('room management prompts', () => {
    it('classifies room creation, rename and deletion without capturing draft requests', () => {
      expect(isRoomQuery('que estancias tengo')).toBe(true);
      expect(isRoomCreationIntent('crea una estancia garaje')).toBe(true);
      expect(isRoomCreationIntent('crea una escena en la estancia')).toBe(false);
      expect(isRoomRenameIntent('renombra la estancia sala a living')).toBe(true);
      expect(isRoomDeletionIntent('elimina la estancia garaje')).toBe(true);
      expect(isRoomDeletionIntent('elimina la escena')).toBe(false);
    });

    it('recognizes the room creation follow-up only after a room inventory', () => {
      const inventory = { lastQueryType: 'room_inventory' as const, entities: [], timestamp: '' };
      expect(isRoomCreationFollowUp('puedo agregar otra', inventory)).toBe(true);
      expect(isRoomCreationFollowUp('puedo agregar otra', null)).toBe(false);
    });

    it('extracts room names from creation, rename and deletion prompts', () => {
      expect(extractRoomCreationName('crea una estancia llamada Garaje')).toBe('Garaje');
      expect(extractRoomCreationName('crea una nueva estancia')).toBeNull();
      expect(extractRoomRenameRequest('renombra la estancia Sala a Living')).toEqual({ currentName: 'Sala', newName: 'Living' });
      expect(extractRoomRenameRequest('rename the room Sala to Living')).toEqual({ currentName: 'Sala', newName: 'Living' });
      expect(extractRoomRenameRequest('renombra algo')).toBeNull();
      expect(extractRoomDeletionName('elimina la estancia Garaje.')).toBe('Garaje');
      expect(extractRoomDeletionName('delete the room Garage')).toBe('Garage');
      expect(extractRoomDeletionName('hola')).toBeNull();
    });
  });

  describe('fast-path matchers', () => {
    it('extracts the target phrase after a command verb', () => {
      expect(extractTargetPhrase('Prende la luz de la sala')).toBe('la luz de la sala');
      expect(extractTargetPhrase('apaga')).toBe('');
      expect(extractTargetPhrase('la luz')).toBe('la luz');
    });

    it('parses room-scoped bulk requests and rejects exclusions and missing rooms', () => {
      expect(isRoomBulkFastPath('apaga todas las luces en sala')).toEqual({ command: 'turn_off', roomName: 'sala', bulkType: 'lights' });
      expect(isRoomBulkFastPath('turn on everything in kitchen')).toEqual({ command: 'turn_on', roomName: 'kitchen', bulkType: 'all' });
      expect(isRoomBulkFastPath('apaga todo menos la sala')).toBeNull();
      expect(isRoomBulkFastPath('apaga todas las luces')).toBeNull();
    });

    it('parses singular light and cover requests by room', () => {
      expect(isSingularLightRequest('prende la luz de la sala')).toBe(true);
      expect(isRoomSingularLightFastPath('prende luz sala')).toEqual({ command: 'turn_on', roomName: 'sala' });
      expect(isRoomSingularLightFastPath('prende lux sala')).toBeNull();
      expect(isRoomCoverFastPath('abre la persiana de la sala')).toEqual({ command: 'open', roomName: 'sala' });
      expect(isRoomCoverFastPath('close the blinds in office')).toEqual({ command: 'close', roomName: 'office' });
      expect(isRoomCoverFastPath('abre la puerta')).toBeNull();
    });

    it('parses global bulk requests and vague light commands', () => {
      expect(isBulkFastPath('apaga todas las luces')).toEqual({ command: 'turn_off', bulkType: 'lights' });
      expect(isBulkFastPath('apaga todo')).toEqual({ command: 'turn_off', bulkType: 'all' });
      expect(isBulkFastPath('apaga todo menos la sala')).toBeNull();
      expect(isBulkFastPath('prende y apaga todo')).toBeNull();
      expect(isVagueLightCommand('prende la luz', 'es')).toEqual({ command: 'turn_on' });
      expect(isVagueLightCommand('turn off lights', 'en')).toEqual({ command: 'turn_off' });
      expect(isVagueLightCommand('turn off lights', 'es')).toBeNull();
    });
  });
});
