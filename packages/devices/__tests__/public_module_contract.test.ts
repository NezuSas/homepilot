import * as applicationExports from '../application';
import * as apiExports from '../api';
import * as controllerExports from '../api/controllers';
import * as domainExports from '../domain';
import * as eventExports from '../domain/events';
import * as repositoryExports from '../domain/repositories';
import * as persistenceExports from '../infrastructure/repositories';

describe('Device module public contracts', () => {
  it('exposes the application use cases and automation engine through the application boundary', () => {
    expect(applicationExports).toEqual(expect.objectContaining({
      discoverDeviceUseCase: expect.any(Function),
      listPendingInboxUseCase: expect.any(Function),
      assignDeviceUseCase: expect.any(Function),
      executeDeviceCommandUseCase: expect.any(Function),
      syncDeviceStateUseCase: expect.any(Function),
      getDeviceStateUseCase: expect.any(Function),
      getDeviceActivityHistoryUseCase: expect.any(Function),
      AutomationEngine: expect.any(Function),
      createAutomationRuleUseCase: expect.any(Function),
      listAutomationRulesUseCase: expect.any(Function),
      deleteAutomationRuleUseCase: expect.any(Function),
    }));
  });

  it('exposes the device API controllers through their intended boundaries', () => {
    expect(apiExports).toEqual(expect.objectContaining({
      IntegrationsController: expect.any(Function),
      InboxController: expect.any(Function),
      DeviceController: expect.any(Function),
      CommandController: expect.any(Function),
    }));
    expect(controllerExports).toEqual(expect.objectContaining({
      IntegrationsController: expect.any(Function),
      InboxController: expect.any(Function),
      DeviceController: expect.any(Function),
      CommandController: expect.any(Function),
      StateIngestionController: expect.any(Function),
      ObservabilityController: expect.any(Function),
      AutomationController: expect.any(Function),
    }));
  });

  it('exposes the domain factories, events, repositories, and durable repositories', () => {
    expect(domainExports).toEqual(expect.objectContaining({
      createDiscoveredDevice: expect.any(Function),
      assignDeviceToRoom: expect.any(Function),
      createAutomationRule: expect.any(Function),
      updateAutomationRule: expect.any(Function),
    }));
    expect(eventExports).toEqual(expect.objectContaining({
      InMemoryDeviceEventPublisher: expect.any(Function),
      createDeviceAssignedToRoomEvent: expect.any(Function),
      createDeviceDiscoveredEvent: expect.any(Function),
    }));
    expect(repositoryExports).toEqual({});
    expect(persistenceExports).toEqual(expect.objectContaining({
      InMemoryDeviceRepository: expect.any(Function),
      InMemoryActivityLogRepository: expect.any(Function),
      InMemoryAutomationRuleRepository: expect.any(Function),
      SQLiteDeviceRepository: expect.any(Function),
      SQLiteActivityLogRepository: expect.any(Function),
      SQLiteAutomationRuleRepository: expect.any(Function),
    }));
  });
});