import * as net from 'net';
import type { NetworkProbePort } from '../application/ports/NetworkProbePort';

export class TcpNetworkProbe implements NetworkProbePort {
  public isReachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const done = (result: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(timeoutMs);
      socket.on('connect', () => done(true));
      socket.on('timeout', () => done(false));
      socket.on('error', () => done(false));
      socket.connect(port, host);
    });
  }
}
