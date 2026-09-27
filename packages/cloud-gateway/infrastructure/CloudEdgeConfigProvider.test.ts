import { readFileSync } from 'node:fs';
import { readCloudEdgeConfig } from './CloudEdgeConfigProvider';

jest.mock('node:fs', () => ({ readFileSync: jest.fn() }));

const mockedReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const environmentKeys = [
  'HOMEPILOT_CLOUD_CONFIG_PATH',
  'HOMEPILOT_CLOUD_GATEWAY_URL',
  'HOMEPILOT_CLOUD_EDGE_TOKEN',
  'HOMEPILOT_CLOUD_HOME_ID',
  'HOMEPILOT_CLOUD_EDGE_ID',
] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));

beforeEach(() => {
  for (const key of environmentKeys) delete process.env[key];
  mockedReadFileSync.mockReset();
});

afterAll(() => {
  for (const key of environmentKeys) {
    const original = originalEnvironment[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe('CloudEdgeConfigProvider', () => {
  it('reuses the existing provisioned gateway file without rotating the Edge token', () => {
    const provisioned = { url: 'wss://directory.example.test/gateway/edge', token: 'existing-token', homeId: 'home-1', edgeId: 'edge-1' };
    mockedReadFileSync.mockReturnValue(JSON.stringify(provisioned));
    expect(readCloudEdgeConfig()).toEqual(provisioned);
    expect(mockedReadFileSync).toHaveBeenCalledWith('./data/cloud-gateway.json', 'utf8');
    expect(readCloudEdgeConfig()).toEqual(provisioned);
  });

  it('preserves the prior environment fallback when no provisioned file exists', () => {
    mockedReadFileSync.mockImplementation(() => { throw new Error('missing'); });
    process.env.HOMEPILOT_CLOUD_GATEWAY_URL = 'wss://directory.example.test/gateway/edge';
    process.env.HOMEPILOT_CLOUD_EDGE_TOKEN = 'existing-token';
    process.env.HOMEPILOT_CLOUD_HOME_ID = 'home-1';
    process.env.HOMEPILOT_CLOUD_EDGE_ID = 'edge-1';
    expect(readCloudEdgeConfig()).toEqual({
      url: 'wss://directory.example.test/gateway/edge',
      token: 'existing-token',
      homeId: 'home-1',
      edgeId: 'edge-1',
    });
  });

  it('fails closed for incomplete cloud configuration', () => {
    mockedReadFileSync.mockReturnValue(JSON.stringify({ url: 'wss://directory.example.test/gateway/edge' }));
    expect(readCloudEdgeConfig()).toBeNull();
  });
});
