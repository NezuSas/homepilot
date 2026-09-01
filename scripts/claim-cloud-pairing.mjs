import { chmodSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const [cloudUrl, code] = process.argv.slice(2);
if (!cloudUrl || !code) throw new Error('Uso: node scripts/claim-cloud-pairing.mjs <https://accounts.nezuecuador.com> <codigo>');
const response = await fetch(new URL('/directory/edge-pairing/claim', cloudUrl), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
const value = await response.json();
if (!response.ok) throw new Error(value.error || 'EDGE_PAIRING_FAILED');
const config = { url: value.gatewayUrl, token: value.token, homeId: value.homeId, edgeId: value.edgeId };
if (typeof config.url !== 'string' || !config.url.startsWith('wss://') || typeof config.token !== 'string') throw new Error('EDGE_PAIRING_INVALID_RESPONSE');
const path = resolve(process.env.HOMEPILOT_CLOUD_CONFIG_PATH || './data/cloud-gateway.json');
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const temporary = path + '.tmp'; writeFileSync(temporary, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 }); chmodSync(temporary, 0o600); renameSync(temporary, path); protectForCurrentUser(path);
console.log('HomePilot Edge quedó vinculado. La configuración se guardó protegida.');
function protectForCurrentUser(file) { if (process.platform !== 'win32') return; const account = process.env.USERNAME; if (!account) throw new Error('No se pudo determinar el usuario de Windows para proteger la configuración.'); const result = spawnSync('icacls', [file, '/inheritance:r', '/grant:r', `${account}:(R,W)`, '/grant:r', 'SYSTEM:(F)', '/c'], { stdio: 'ignore' }); if (result.status !== 0) throw new Error('No se pudieron aplicar ACL privadas al material de pairing.'); }
