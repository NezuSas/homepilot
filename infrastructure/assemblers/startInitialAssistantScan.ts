/**
 * startInitialAssistantScan.ts
 *
 * Dispara el escaneo inicial del asistente para cada hogar al arrancar.
 * Es fire-and-forget: el bootstrap no espera su resultado ni propaga sus errores.
 */
import type { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import type { AssistantService } from '../../packages/assistant/application/AssistantService';

export interface InitialAssistantScanDeps {
  homeRepository: SQLiteHomeRepository;
  assistantService: AssistantService;
}

export function startInitialAssistantScan(deps: InitialAssistantScanDeps): void {
  const initialScan = async () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const allHomes = await deps.homeRepository.findAll();
      for (const h of allHomes) {
        await deps.assistantService.scan(h.id, 'system_boot');
      }
      console.log(`[Assistant] Initial system scan completed for ${allHomes.length} homes.`);
    } catch (e) {
      console.error('[Assistant] Initial scan failed:', e);
    }
  };
  initialScan();
}
