import { getDashboardPath } from './useDashboardRoute';
import { isCloseSwipe } from './mobileSidebarSwipe';
import { EMPTY_LOCAL_PROFILE, readStoredProfile } from './storedProfile';
import { requiresVoiceConfirmation } from './assistantVoiceConfirmation';
import { REFRESH_TRIGGER_EVENTS } from './realtimeRefreshEvents';
import type { AssistantConversationResponse } from '../types/assistantConversation';

const storage = (value: string | null) => ({ getItem: () => value });

describe('Feature: app shell helpers extracted from App (modularization V1)', () => {
  describe('getDashboardPath', () => {
    it('opens the remembered tab only for the dashboard it belongs to', () => {
      const remembered = { dashboardId: 'd1', tabId: 't9' };
      expect(getDashboardPath('d1', remembered)).toBe('/dashboards/d1/t9');
      expect(getDashboardPath('d2', remembered)).toBe('/dashboards/d2');
      expect(getDashboardPath('d1', null)).toBe('/dashboards/d1');
    });
  });

  describe('isCloseSwipe', () => {
    it('closes on a mostly-horizontal swipe of at least 64px to the left', () => {
      expect(isCloseSwipe({ x: 200, y: 100 }, { x: 130, y: 110 })).toBe(true);
      expect(isCloseSwipe({ x: 200, y: 100 }, { x: 137, y: 100 })).toBe(false);
    });

    it('ignores rightward and mostly-vertical gestures', () => {
      expect(isCloseSwipe({ x: 100, y: 100 }, { x: 200, y: 100 })).toBe(false);
      expect(isCloseSwipe({ x: 200, y: 100 }, { x: 130, y: 260 })).toBe(false);
    });
  });

  describe('readStoredProfile', () => {
    it('reads the cached display name and avatar', () => {
      const raw = JSON.stringify({ displayName: 'Ana', avatarDataUri: 'data:image/png;base64,AA' });
      expect(readStoredProfile(storage(raw))).toEqual({ displayName: 'Ana', avatarDataUri: 'data:image/png;base64,AA' });
    });

    it('returns an empty profile when nothing usable is stored', () => {
      expect(readStoredProfile(storage(null))).toBe(EMPTY_LOCAL_PROFILE);
      expect(readStoredProfile(storage('{not json'))).toBe(EMPTY_LOCAL_PROFILE);
      expect(readStoredProfile(storage('{}'))).toEqual(EMPTY_LOCAL_PROFILE);
    });
  });

  describe('requiresVoiceConfirmation', () => {
    const clarification = (ids: string[]) => ({
      type: 'clarification',
      message: 'Confirmas?',
      clarification: { options: ids.map(id => ({ id })) },
    }) as unknown as AssistantConversationResponse;

    it('is true only for a confirm/cancel clarification', () => {
      expect(requiresVoiceConfirmation(clarification(['confirm', 'cancel']))).toBe(true);
      expect(requiresVoiceConfirmation(clarification(['confirm']))).toBe(false);
      expect(requiresVoiceConfirmation({ type: 'answer', message: 'ok' } as unknown as AssistantConversationResponse)).toBe(false);
    });
  });

  describe('REFRESH_TRIGGER_EVENTS', () => {
    it('refreshes on device and topology changes, not on unrelated events', () => {
      expect(REFRESH_TRIGGER_EVENTS).toContain('DeviceStateUpdatedEvent');
      expect(REFRESH_TRIGGER_EVENTS).toContain('RoomCreatedEvent');
      expect(REFRESH_TRIGGER_EVENTS).not.toContain('UserLoggedInEvent');
    });
  });
});
