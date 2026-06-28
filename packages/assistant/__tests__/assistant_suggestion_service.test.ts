import { AssistantSuggestionService } from '../application/AssistantSuggestionService';
import { 
  createMockAssistantLearningService, 
  createMockDeviceRepository,
  createTestDevice
} from './test_helpers';

describe('AssistantSuggestionService Patterns', () => {
  let service: AssistantSuggestionService;
  let mockLearning: any;
  let mockDeviceRepo: any;

  beforeEach(() => {
    mockLearning = createMockAssistantLearningService();
    mockDeviceRepo = createMockDeviceRepository();
    service = new AssistantSuggestionService(mockLearning, mockDeviceRepo);
  });

  describe('Alias Suggestion', () => {
    it('should suggest an alias after 2 similar corrections', async () => {
      mockLearning.getRecentCorrections.mockResolvedValue([
        { id: '1', prompt: 'lampara', correction: 'lámpara', createdAt: new Date().toISOString() },
        { id: '2', prompt: 'lampara', correction: 'lámpara', createdAt: new Date().toISOString() }
      ]);

      const suggestion = await service.getSuggestion('u1', 'es');
      expect(suggestion?.type).toBe('alias_suggestion');
      expect(suggestion?.metadata.alias).toBe('lampara');
    });
  });

  describe('Scene Suggestion', () => {
    it('should suggest a scene after 3 repeated device clusters in the same room', async () => {
      const now = new Date();
      const events = [
        // Cluster 1
        { eventType: 'device_used', entityId: 'd1', roomId: 'r1', createdAt: new Date(now.getTime() - 1000).toISOString() },
        { eventType: 'device_used', entityId: 'd2', roomId: 'r1', createdAt: new Date(now.getTime() - 500).toISOString() },
        // Cluster 2
        { eventType: 'device_used', entityId: 'd1', roomId: 'r1', createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() },
        { eventType: 'device_used', entityId: 'd2', roomId: 'r1', createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 500).toISOString() },
        // Cluster 3
        { eventType: 'device_used', entityId: 'd1', roomId: 'r1', createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString() },
        { eventType: 'device_used', entityId: 'd2', roomId: 'r1', createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000 + 500).toISOString() },
      ];

      mockLearning.getEventsInTimeRange.mockResolvedValue(events);
      mockLearning.getRecentCorrections.mockResolvedValue([]);
      mockDeviceRepo.findDeviceById.mockImplementation((id: string) => Promise.resolve(createTestDevice({ id, homeId: 'home-1' })));
      
      const suggestion = await service.getSuggestion('u1', 'es');
      expect(suggestion?.type).toBe('scene_suggestion');
      expect(suggestion?.metadata.deviceIds).toContain('d1');
      expect(suggestion?.metadata.deviceIds).toContain('d2');
    });
  });

  describe('Automation Suggestion', () => {
    it('should suggest an automation after 3 usages at similar times', async () => {
      const events = [
        { eventType: 'device_used', entityId: 'd1', createdAt: '2026-04-20T22:05:00Z' },
        { eventType: 'device_used', entityId: 'd1', createdAt: '2026-04-21T22:10:00Z' },
        { eventType: 'device_used', entityId: 'd1', createdAt: '2026-04-22T21:55:00Z' },
      ];

      mockLearning.getEventsInTimeRange.mockResolvedValue(events);
      mockLearning.getRecentCorrections.mockResolvedValue([]);
      mockDeviceRepo.findDeviceById.mockResolvedValue(createTestDevice({ id: 'd1', name: 'Luz', homeId: 'home-1' }));

      const suggestion = await service.getSuggestion('u1', 'es');
      const expectedHour = new Date('2026-04-20T22:05:00Z').getHours();
      expect(suggestion?.type).toBe('automation_suggestion');
      expect(suggestion?.metadata.deviceId).toBe('d1');
      expect(suggestion?.metadata.hour).toBe(expectedHour);
    });
  });

  it('does not turn unassigned devices into a repetitive conversation suggestion', async () => {
    mockLearning.getRecentCorrections.mockResolvedValue([]);
    mockLearning.getEventsInTimeRange.mockResolvedValue([]);
    mockDeviceRepo.findAll.mockResolvedValue([
      createTestDevice({ id: 'unassigned-1', roomId: null })
    ]);

    const suggestion = await service.getSuggestion('u1', 'es');

    expect(suggestion).toBeNull();
  });

  describe('Suppression', () => {
    it('should not suggest if recently rejected (24h)', async () => {
      mockLearning.getRecentCorrections.mockResolvedValue([
        { id: '1', prompt: 'a', correction: 'b' },
        { id: '2', prompt: 'a', correction: 'b' }
      ]);

      mockLearning.getEventsInTimeRange.mockResolvedValue([
        { eventType: 'suggestion_rejected', metadata: { suggestionId: 'alias_a_b', type: 'alias_suggestion' }, createdAt: new Date().toISOString() }
      ]);

      const suggestion = await service.getSuggestion('u1', 'es');
      expect(suggestion).toBeNull();
    });

    it('should not suggest if recently postponed (within 2h)', async () => {
      mockLearning.getRecentCorrections.mockResolvedValue([
        { id: '1', prompt: 'a', correction: 'b' },
        { id: '2', prompt: 'a', correction: 'b' }
      ]);

      mockLearning.getEventsInTimeRange.mockResolvedValue([
        { eventType: 'suggestion_postponed', metadata: { suggestionId: 'alias_a_b', type: 'alias_suggestion' }, createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
      ]);

      const suggestion = await service.getSuggestion('u1', 'es');
      expect(suggestion).toBeNull();
    });
    
    it('should suggest again if postponed more than 2h ago', async () => {
        mockLearning.getRecentCorrections.mockResolvedValue([
          { id: '1', prompt: 'a', correction: 'b' },
          { id: '2', prompt: 'a', correction: 'b' }
        ]);
  
        mockLearning.getEventsInTimeRange.mockResolvedValue([
          { eventType: 'suggestion_postponed', metadata: { suggestionId: 'alias_a_b', type: 'alias_suggestion' }, createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
        ]);
  
        const suggestion = await service.getSuggestion('u1', 'es');
        expect(suggestion).not.toBeNull();
      });
  });
});
