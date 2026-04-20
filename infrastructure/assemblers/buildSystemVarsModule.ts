/**
 * buildSystemVarsModule.ts
 *
 * Assembler: Construcción e inicialización del módulo de variables de sistema.
 * Asegura que se establezca la zona horaria del appliance si no existe o es por defecto.
 */
import { SystemVariableService } from '../../packages/system-vars/application/SystemVariableService';
import type { SqliteSystemVariableRepository } from '../../packages/system-vars/infrastructure/SqliteSystemVariableRepository';
import { randomUUID } from 'crypto';

export interface SystemVarsAssembly {
  systemVariableService: SystemVariableService;
}

export interface SystemVarsModuleDeps {
  systemVariableRepository: SqliteSystemVariableRepository;
}

export async function buildSystemVarsModule(deps: SystemVarsModuleDeps): Promise<SystemVarsAssembly> {
  const { systemVariableRepository } = deps;

  const systemVariableService = new SystemVariableService(
    systemVariableRepository,
    { generate: () => randomUUID() }
  );

  // -- SYSTEM TIMEZONE INITIALIZATION (PORTABILITY) --
  // On first boot, if no system_timezone exists (or if it's trapped in UTC due to container defaults),
  // persist America/Guayaquil to establish a stable local appliance authority.
  const existingTz = await systemVariableService.get('global', null, 'system_timezone');
  const needsReset = !existingTz || existingTz.value === 'UTC';
  
  if (needsReset) {
    const targetTz = 'America/Guayaquil';
    await systemVariableService.set({
      scope: 'global',
      name: 'system_timezone',
      value: targetTz,
      valueType: 'string',
      description: 'Appliance local timezone (auto-initialized)'
    });
    console.log(`[Bootstrap] ${!existingTz ? 'Initialized' : 'Corrected'} appliance timezone authority to: ${targetTz}`);
  }

  return { systemVariableService };
}
