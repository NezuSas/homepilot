import {
  inferCommandFromPrompt,
  isBulkActionAccept,
  isBulkActionReject,
  isConfirmation,
  isNegativeConfirmation,
  isPendingIntentConfirmationActive,
  isPositiveConfirmation,
  isSuggestionAccept,
  isSuggestionPostpone,
  isSuggestionReject,
  resolvePronounIntent,
  resolveSelectionFromMemory
} from '../application/conversation/confirmationReplies';
import {
  isClarificationKind,
  isIntent,
  isPendingSuggestion,
  isStringArray
} from '../application/conversation/conversationTypeGuards';

describe('Conversation replies and type guards', () => {
  describe('confirmation polarity', () => {
    it('classifies positive and negative replies in both languages', () => {
      expect(isPositiveConfirmation('si')).toBe(true);
      expect(isPositiveConfirmation('go ahead')).toBe(true);
      expect(isPositiveConfirmation('dale ahora')).toBe(true);
      expect(isNegativeConfirmation('cancela')).toBe(true);
      expect(isNegativeConfirmation('nope')).toBe(true);
      expect(isPositiveConfirmation('no')).toBe(false);
      expect(isNegativeConfirmation('si')).toBe(false);
    });

    it('treats either polarity as a confirmation reply and rejects unrelated text', () => {
      expect(isConfirmation('ok')).toBe(true);
      expect(isConfirmation('abortar')).toBe(true);
      expect(isConfirmation('okay entonces')).toBe(false);
      expect(isConfirmation('enciende la luz')).toBe(false);
    });

    it('recognizes suggestion and bulk action replies', () => {
      expect(isSuggestionAccept('crear')).toBe(true);
      expect(isSuggestionAccept('yes please')).toBe(true);
      expect(isSuggestionReject('no gracias')).toBe(true);
      expect(isSuggestionPostpone('mas tarde')).toBe(true);
      expect(isBulkActionAccept('confirmar')).toBe(true);
      expect(isBulkActionAccept('confirmar todo')).toBe(false);
      expect(isBulkActionReject('cancel')).toBe(true);
    });
  });

  describe('pending intent expiration', () => {
    it('accepts a fresh timestamp and rejects stale, future and invalid ones', () => {
      const intentAt = (offsetMs: number) => ({
        type: 'command' as const,
        deviceId: 'd1',
        command: 'turn_on' as const,
        prompt: 'x',
        timestamp: new Date(Date.now() + offsetMs).toISOString()
      });

      expect(isPendingIntentConfirmationActive(intentAt(-1_000))).toBe(true);
      expect(isPendingIntentConfirmationActive(intentAt(-301_000))).toBe(false);
      expect(isPendingIntentConfirmationActive(intentAt(60_000))).toBe(false);
      expect(isPendingIntentConfirmationActive({ ...intentAt(0), timestamp: 'not-a-date' })).toBe(false);
    });
  });

  describe('selection and command inference', () => {
    const options = [
      { id: 'a', label: 'Luz Sala' },
      { id: 'b', label: 'Luz Cocina' }
    ];

    it('resolves ordinals, exact labels and partial labels', () => {
      expect(resolveSelectionFromMemory('la segunda', options, 'es')).toBe('b');
      expect(resolveSelectionFromMemory('the first one', options, 'en')).toBe('a');
      expect(resolveSelectionFromMemory('a', options, 'es')).toBe('a');
      expect(resolveSelectionFromMemory('Luz Cocina', options, 'es')).toBe('b');
      expect(resolveSelectionFromMemory('cocina', options, 'es')).toBe('b');
      expect(resolveSelectionFromMemory('la tercera', options, 'es')).toBeNull();
      expect(resolveSelectionFromMemory('jardin', options, 'es')).toBeNull();
    });

    it('infers a device command from keywords and returns undefined otherwise', () => {
      expect(inferCommandFromPrompt('apaga la luz')).toBe('turn_off');
      expect(inferCommandFromPrompt('prende la luz')).toBe('turn_on');
      expect(inferCommandFromPrompt('cierra la cortina')).toBe('close');
      expect(inferCommandFromPrompt('open the blinds')).toBe('open');
      expect(inferCommandFromPrompt('hola')).toBeUndefined();
    });
  });

  describe('pronoun resolution', () => {
    const memoryWith = (entityIds: string[]) => ({
      lastQueryType: 'command' as const,
      entities: entityIds.map((id) => ({ id, name: `Luz ${id}`, type: 'device', roomId: null })),
      timestamp: new Date().toISOString()
    });

    it('returns null when the prompt has no pronoun command or no command context', async () => {
      expect(await resolvePronounIntent('hola', memoryWith(['d1']), 'es')).toBeNull();
      expect(await resolvePronounIntent('apagala', null, 'es')).toBeNull();
      expect(await resolvePronounIntent('apagala', { ...memoryWith(['d1']), lastQueryType: 'none' }, 'es')).toBeNull();
    });

    it('builds a command for a single remembered entity and a clarification for several', async () => {
      expect(await resolvePronounIntent('apagala', memoryWith(['d1']), 'es')).toEqual({
        type: 'command',
        deviceId: 'd1',
        command: 'turn_off',
        params: {},
        prompt: 'apagala'
      });

      expect(await resolvePronounIntent('prendela', memoryWith(['d1', 'd2']), 'es')).toEqual({
        type: 'clarificationRequired',
        options: [
          { id: 'd1', label: 'Luz d1', kind: 'device' },
          { id: 'd2', label: 'Luz d2', kind: 'device' }
        ]
      });
    });
  });

  describe('type guards', () => {
    it('validates pending suggestions, string arrays, intents and clarification kinds', () => {
      expect(isPendingSuggestion({ id: 's1', type: 'alias' })).toBe(true);
      expect(isPendingSuggestion({ id: 's1' })).toBe(false);
      expect(isPendingSuggestion(null)).toBe(false);

      expect(isStringArray(['a', 'b'])).toBe(true);
      expect(isStringArray(['a', 1])).toBe(false);
      expect(isStringArray('a')).toBe(false);

      expect(isIntent({ type: 'command', prompt: 'x' })).toBe(true);
      expect(isIntent({ type: 'other', prompt: 'x' })).toBe(false);
      expect(isIntent({ type: 'command' })).toBe(false);

      expect(isClarificationKind('alias_target')).toBe(true);
      expect(isClarificationKind('other')).toBe(false);
    });
  });
});
