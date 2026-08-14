export interface NetworkProbePort {
  isReachable(host: string, port: number, timeoutMs: number): Promise<boolean>;
}
