import { readFileSync } from 'node:fs';
import type { CloudGatewayConnectorConfig } from '../application/EdgeDeviceContract';
export type { CloudGatewayConnectorConfig } from '../application/EdgeDeviceContract';

/** Reads the existing provisioned Edge identity without changing its storage format. */
export function readCloudEdgeConfig(): CloudGatewayConnectorConfig | null {
  const provisioned = readProvisionedConfig();
  const url = provisioned?.url ?? process.env.HOMEPILOT_CLOUD_GATEWAY_URL?.trim();
  const token = provisioned?.token ?? process.env.HOMEPILOT_CLOUD_EDGE_TOKEN?.trim();
  const homeId = provisioned?.homeId ?? process.env.HOMEPILOT_CLOUD_HOME_ID?.trim();
  const edgeId = provisioned?.edgeId ?? process.env.HOMEPILOT_CLOUD_EDGE_ID?.trim();
  if (!url || !token || !homeId || !edgeId) return null;
  return { url, token, homeId, edgeId };
}

function readProvisionedConfig(): CloudGatewayConnectorConfig | null {
  try {
    const raw = JSON.parse(readFileSync(process.env.HOMEPILOT_CLOUD_CONFIG_PATH ?? './data/cloud-gateway.json', 'utf8')) as Partial<CloudGatewayConnectorConfig>;
    return typeof raw.url === 'string' && typeof raw.token === 'string' && typeof raw.homeId === 'string' && typeof raw.edgeId === 'string' ? raw as CloudGatewayConnectorConfig : null;
  } catch {
    return null;
  }
}
