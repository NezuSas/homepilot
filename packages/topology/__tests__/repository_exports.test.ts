import * as repositoryExports from '../domain/repositories';
import * as topologyDomainExports from '../domain';
import * as topologyEventExports from '../domain/events';
import * as topologyApplicationExports from '../application';
import * as topologyApiExports from '../api';
import * as topologyControllerExports from '../api/controllers';
import * as persistenceExports from '../infrastructure/repositories';

describe('Topology repository module boundary', () => {
  it('loads the repository barrel without introducing runtime implementations', () => {
    expect(repositoryExports).toEqual({});
  });

  it('exposes the durable and in-memory persistence implementations from its public barrel', () => {
    expect(persistenceExports).toEqual(expect.objectContaining({
      InMemoryHomeRepository: expect.any(Function),
      InMemoryRoomRepository: expect.any(Function),
      SQLiteHomeRepository: expect.any(Function),
      SQLiteRoomRepository: expect.any(Function),
    }));
  });

  it('exposes the stable topology domain, application, and API contracts', () => {
    expect(topologyDomainExports).toEqual(expect.objectContaining({
      createHome: expect.any(Function),
      createRoom: expect.any(Function),
      renameRoom: expect.any(Function),
      createHomeCreatedEvent: expect.any(Function),
      createRoomCreatedEvent: expect.any(Function),
      createRoomRenamedEvent: expect.any(Function),
    }));
    expect(topologyEventExports).toEqual(expect.objectContaining({
      InMemoryEventPublisher: expect.any(Function),
      createHomeCreatedEvent: expect.any(Function),
      createRoomCreatedEvent: expect.any(Function),
      createRoomRenamedEvent: expect.any(Function),
    }));
    expect(topologyApplicationExports).toEqual(expect.objectContaining({
      createHomeUseCase: expect.any(Function),
      createRoomUseCase: expect.any(Function),
      deleteRoomUseCase: expect.any(Function),
      listHomesUseCase: expect.any(Function),
      listRoomsUseCase: expect.any(Function),
      renameRoomUseCase: expect.any(Function),
    }));
    expect(topologyApiExports).toEqual(expect.objectContaining({
      HomeController: expect.any(Function),
      RoomController: expect.any(Function),
      handleError: expect.any(Function),
    }));
    expect(topologyControllerExports).toEqual(expect.objectContaining({
      HomeController: expect.any(Function),
      RoomController: expect.any(Function),
    }));
  });
});