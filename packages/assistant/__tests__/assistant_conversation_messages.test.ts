import {
  asAssistantStateRecord,
  firstAssistantText,
  formatMediaPlayerStatus,
  isMediaPlayerOff,
  isMediaPlayerUnavailable,
  readMediaPlayerVolume
} from '../application/conversation/mediaPlayerFormatting';
import {
  buildCommandSuccessMessage,
  formatMultiCommandSummary,
  formatStateDevicePreview,
  handleCompanyInfoQuery,
  handleConversationContext,
  handleEquivalenceQuery,
  withJarvisStyle
} from '../application/conversation/responseMessages';
import { createTestDevice } from './test_helpers';

describe('Conversation response builders', () => {
  describe('media player state readers', () => {
    it('reads availability, power and volume from the last known state', () => {
      const unavailable = createTestDevice({ lastKnownState: { state: 'unavailable' } });
      const off = createTestDevice({ lastKnownState: { state: 'off' } });
      const playing = createTestDevice({ lastKnownState: { state: 'playing', volume_level: 0.456 } });

      expect(isMediaPlayerUnavailable(unavailable)).toBe(true);
      expect(isMediaPlayerOff(off)).toBe(true);
      expect(isMediaPlayerOff(playing)).toBe(false);
      expect(readMediaPlayerVolume(playing)).toBe(46);
      expect(readMediaPlayerVolume(off)).toBeNull();
    });

    it('normalizes unknown state shapes defensively', () => {
      expect(asAssistantStateRecord(null)).toEqual({});
      expect(asAssistantStateRecord([1])).toEqual({});
      expect(asAssistantStateRecord({ a: 1 })).toEqual({ a: 1 });
      expect(firstAssistantText(undefined, '  ', ' Song ')).toBe('Song');
      expect(firstAssistantText(1, null)).toBeNull();
    });

    it('formats a single player without a list bullet', () => {
      const player = createTestDevice({ name: 'TV', lastKnownState: { state: 'unavailable' } });
      const message = formatMediaPlayerStatus([player], 'en', []);
      expect(message).toContain('TV');
      expect(message).not.toContain('•');
    });
  });

  describe('execution summaries', () => {
    const ok = (name: string) => ({
      action: { deviceId: name, command: 'turn_on' as const, targetName: name },
      deviceName: name,
      result: { sceneId: 's', status: 'success' as const, actions: [] }
    });
    const failed = (name: string) => ({
      action: { deviceId: name, command: 'turn_on' as const, targetName: name },
      deviceName: name,
      result: { sceneId: 's', status: 'failed' as const, actions: [{ deviceId: name, commandName: 'turn_on', status: 'failed' as const, error: 'offline' }] }
    });

    it('reports partial failures with the failing device and reason', () => {
      const message = formatMultiCommandSummary([ok('Sala'), failed('Cocina')], 'en');
      expect(message).toContain('Executed 1 of 2');
      expect(message).toContain('Cocina: offline');
    });

    it('builds a success message for a single command', () => {
      expect(buildCommandSuccessMessage('turn_on', 'Luz Sala', null, 'es')).toContain('Luz Sala');
    });
  });

  describe('static answers', () => {
    it('answers company and equivalence questions in the requested language', () => {
      expect(handleCompanyInfoQuery('es').type).toBe('answer');
      expect(handleEquivalenceQuery('en').type).toBe('answer');
    });

    it('answers a conversation-context query with or without memory', () => {
      expect(handleConversationContext(null, 'es').type).toBe('answer');
      expect(handleConversationContext({ lastQueryType: 'none', entities: [], timestamp: '' }, 'en').type).toBe('answer');
    });

    it('previews state devices with a bounded list', () => {
      const devices = Array.from({ length: 12 }, (_, index) => createTestDevice({ id: `d${index}`, name: `Luz ${index}` }));
      const preview = formatStateDevicePreview(devices, 'es');
      expect(preview).toContain('Luz 0');
      expect(preview).not.toContain('Luz 11');
    });

    it('applies the Jarvis style only to Spanish answers with a user name', () => {
      const response = { type: 'answer' as const, message: 'base' };
      const english = withJarvisStyle(response, { status: 'success', userName: ' Ana ' }, 'en');
      expect(english.message).toBe('base');
      expect(english.responseStyle?.userName).toBe('Ana');

      const anonymous = withJarvisStyle(response, { status: 'success' }, 'es');
      expect(anonymous.message).toBe('base');

      const spanish = withJarvisStyle(response, { status: 'success', userName: 'Ana' }, 'es');
      expect(spanish.message).not.toBe('base');
    });
  });
});
