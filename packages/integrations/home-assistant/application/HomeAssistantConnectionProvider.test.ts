import { HomeAssistantConnectionProvider } from './HomeAssistantConnectionProvider';
import type { HomeAssistantClientFactory, HomeAssistantClientPort } from './ports/HomeAssistantClientPort';

describe('HomeAssistantConnectionProvider', () => {
  const client = {} as HomeAssistantClientPort;
  const create = jest.fn<HomeAssistantClientPort, [string, string]>(() => client);
  const factory: HomeAssistantClientFactory = { create };

  beforeEach(() => jest.clearAllMocks());

  it('starts unconfigured and fails safely when a client is requested', () => {
    const provider = new HomeAssistantConnectionProvider(factory);

    expect(provider.hasClient()).toBe(false);
    expect(() => provider.getClient()).toThrow('Home Assistant Client not configured');
  });

  it('creates once per unique configuration and returns the active client', () => {
    const provider = new HomeAssistantConnectionProvider(factory);

    provider.reconfigure('http://ha:8123', 'token-a');
    provider.reconfigure('http://ha:8123', 'token-a');
    provider.reconfigure('http://ha:8123', 'token-b');

    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, 'http://ha:8123', 'token-a');
    expect(create).toHaveBeenNthCalledWith(2, 'http://ha:8123', 'token-b');
    expect(provider.hasClient()).toBe(true);
    expect(provider.getClient()).toBe(client);
  });

  it('clears the active client and permits a fresh configuration afterward', () => {
    const provider = new HomeAssistantConnectionProvider(factory);
    provider.reconfigure('http://ha:8123', 'token-a');
    provider.clear();

    expect(provider.hasClient()).toBe(false);
    expect(() => provider.getClient()).toThrow('Home Assistant Client not configured');

    provider.reconfigure('http://new-ha:8123', 'token-b');
    expect(create).toHaveBeenLastCalledWith('http://new-ha:8123', 'token-b');
  });
});