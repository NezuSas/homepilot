import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const [cloudUrl, code, suppliedEdgeHostname] = process.argv.slice(2);
if (!cloudUrl || !code) throw new Error('Uso: node scripts/claim-cloud-pairing.mjs <https://accounts.nezuecuador.com> <codigo> [https://homepilot-casa.nezuecuador.com]');
const edgeHostname = suppliedEdgeHostname ?? discoverCloudflaredHostname();
const response = await fetch(new URL('/directory/edge-pairing/claim', cloudUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code, edgeHostname }),
});
const value = await response.json();
if (!response.ok) throw new Error(value.error || 'EDGE_PAIRING_FAILED');
const config = { url: value.gatewayUrl, token: value.token, homeId: value.homeId, edgeId: value.edgeId };
if (typeof config.url !== 'string' || !config.url.startsWith('wss://') || typeof config.token !== 'string') throw new Error('EDGE_PAIRING_INVALID_RESPONSE');
const path = resolve(process.env.HOMEPILOT_CLOUD_CONFIG_PATH || './data/cloud-gateway.json');
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const temporary = path + '.tmp'; writeFileSync(temporary, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 }); chmodSync(temporary, 0o600); renameSync(temporary, path); protectForCurrentUser(path);
console.log('HomePilot Edge quedó vinculado. La configuración se guardó protegida.');

function discoverCloudflaredHostname() {
  const candidates = [process.env.CLOUDFLARED_CONFIG, '/etc/cloudflared/config.yml', resolve(homedir(), '.cloudflared/config.yml')]
    .filter((path) => typeof path === 'string' && existsSync(path));
  const hostnames = candidates.flatMap((path) => readFileSync(path, 'utf8').match(/^\s*(?:-\s*)?hostname:\s*([^\s#]+)\s*$/gm) ?? [])
    .map((line) => line.replace(/^\s*(?:-\s*)?hostname:\s*/, '').trim())
    .map((hostname) => hostname.startsWith('https://') ? hostname : `https://${hostname}`)
    .map((hostname) => new URL(hostname).origin)
    .filter((hostname) => new URL(hostname).hostname.endsWith('.nezuecuador.com'));
  const homepilotHosts = hostnames.filter((hostname) => /^homepilot(?:[-.]|$)/.test(new URL(hostname).hostname));
  const selected = homepilotHosts.length === 1 ? homepilotHosts[0] : hostnames.length === 1 ? hostnames[0] : null;
  if (!selected) throw new Error('No se pudo identificar una única URL Cloudflare de HomePilot. Usa el tercer argumento solo durante la instalación.');
  return selected;
}

function protectForCurrentUser(file) { if (process.platform !== 'win32') return; const account = process.env.USERNAME; if (!account) throw new Error('No se pudo determinar el usuario de Windows para proteger la configuración.'); const result = spawnSync('icacls', [file, '/inheritance:r', '/grant:r', `${account}:(R,W)`, '/grant:r', 'SYSTEM:(F)', '/c'], { stdio: 'ignore' }); if (result.status !== 0) throw new Error('No se pudieron aplicar ACL privadas al material de pairing.'); }