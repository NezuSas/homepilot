import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import net from 'node:net';

const args = process.argv.slice(2);
const desktop = args.includes('--desktop');

if (args.length > 1 || (args.length === 1 && !desktop)) {
  console.error('Usage: npm run verify:mqtt-runtime [-- --desktop]');
  process.exit(2);
}

const composeFiles = desktop
  ? ['-f', 'docker-compose.yml', '-f', 'docker-compose.ha-companion.desktop.yml']
  : ['-f', 'docker-compose.yml'];
const requiredFiles = desktop
  ? ['docker-compose.yml', 'docker-compose.ha-companion.desktop.yml']
  : ['docker-compose.yml'];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`MQTT runtime verification failed: missing ${file}.`);
    process.exit(1);
  }
}

const docker = (parameters) => execFileSync('docker', parameters, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const canConnect = () => new Promise((resolve) => {
  const socket = net.createConnection({ host: '127.0.0.1', port: 1883 });
  const finish = (value) => {
    socket.removeAllListeners();
    socket.destroy();
    resolve(value);
  };
  socket.setTimeout(3000);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
});

try {
  const containerId = docker(['compose', ...composeFiles, 'ps', '-q', 'homepilot-mqtt']);
  if (!containerId) throw new Error('homepilot-mqtt is not created. Start only that service before verifying it.');

  const deadline = Date.now() + 45_000;
  let health = 'unknown';
  while (Date.now() < deadline) {
    const [container] = JSON.parse(docker(['inspect', containerId]));
    health = container.State.Health?.Status ?? container.State.Status;
    if (health === 'healthy' && await canConnect()) {
      console.log(`MQTT runtime verification passed (${desktop ? 'Docker Desktop' : 'Linux'}): broker is healthy and 127.0.0.1:1883 accepts TCP.`);
      process.exit(0);
    }
    if (container.State.Status !== 'running') break;
    await delay(1500);
  }
  throw new Error(`homepilot-mqtt did not become healthy (last state: ${health}).`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MQTT runtime verification failed: ${message}`);
  process.exit(1);
}
