import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { handleError } from '../core/errorHandler';
import { 
  createAutomationRuleUseCase, 
  listAutomationRulesUseCase, 
  deleteAutomationRuleUseCase 
} from '../../application';
import { enableAutomationRuleUseCase } from '../../application/usecases/automation/EnableAutomationRuleUseCase';
import { disableAutomationRuleUseCase } from '../../application/usecases/automation/DisableAutomationRuleUseCase';
import { updateAutomationRuleUseCase, UpdateAutomationRuleRequest } from '../../application/usecases/automation/UpdateAutomationRuleUseCase';
import { AutomationRuleRepository } from '../../domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { IdGenerator } from '../../../shared/domain/types';
import { AutomationTrigger, AutomationAction } from '../../domain/automation/types';
import { isValidCommand } from '../../domain/commands';

/**
 * Controller agnóstico para la gestión de Reglas de Automatización V1.
 * Traduce las solicitudes HTTP AuthenticatedHttpRequest al lenguaje de Casos de Uso del Dominio.
 * Cubre el CRUD original y el ciclo de vida completo: enable, disable, update.
 */
export class AutomationController {
  constructor(
    private readonly automationRuleRepository: AutomationRuleRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly topologyPort: TopologyReferencePort,
    private readonly idGenerator: IdGenerator
  ) {}

  /**
   * POST /homes/:homeId/rules
   * Crea una nueva regla IF-THEN validando el ownership del hogar.
   */
  async createRule(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const homeId = req.params?.homeId;
      if (!homeId || homeId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid homeId parameter.' }
        };
      }

      // Narrowing estructural para evitar 'any'
      const body = req.body as Record<string, unknown> | null | undefined;
      if (!body || typeof body !== 'object') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid request body.' } };
      }

      const { name, trigger, action } = body;
      if (typeof name !== 'string' || name.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid field: name.' } };
      }

      if (!trigger || typeof trigger !== 'object') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid field: trigger.' } };
      }
      const t = trigger as Record<string, unknown>;
      const tDeviceId = t.deviceId;
      const tStateKey = t.stateKey;
      const tExpectedValue = t.expectedValue;

      if (typeof tDeviceId !== 'string' || typeof tStateKey !== 'string') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid trigger structure.' } };
      }

      if (
        typeof tExpectedValue !== 'string' &&
        typeof tExpectedValue !== 'number' &&
        typeof tExpectedValue !== 'boolean'
      ) {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'expectedValue must be string, number or boolean.' }
        };
      }

      const triggerFinal: AutomationTrigger = {
        deviceId: tDeviceId,
        stateKey: tStateKey,
        expectedValue: tExpectedValue
      };

      if (!action || typeof action !== 'object') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid field: action.' } };
      }
      const a = action as Record<string, unknown>;
      const aDeviceId = a.deviceId;
      const aCommand = a.command;

      if (typeof aDeviceId !== 'string' || typeof aCommand !== 'string' || !isValidCommand(aCommand)) {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid action structure or command.' } };
      }

      const actionFinal: AutomationAction = {
        targetDeviceId: aDeviceId,
        command: aCommand
      };

      const rule = await createAutomationRuleUseCase(
        {
          homeId,
          userId: req.userId,
          name: name.trim(),
          trigger: triggerFinal,
          action: actionFinal
        },
        {
          automationRuleRepository: this.automationRuleRepository,
          deviceRepository: this.deviceRepository,
          topologyReferencePort: this.topologyPort,
          idGenerator: this.idGenerator
        }
      );

      return { statusCode: 201, body: rule };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * GET /homes/:homeId/rules
   * Lista todas las reglas de un hogar específico del cual el usuario es dueño.
   */
  async listRules(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const homeId = req.params?.homeId;
      if (!homeId || homeId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid homeId parameter.' }
        };
      }

      const rules = await listAutomationRulesUseCase(homeId, req.userId, {
        automationRuleRepository: this.automationRuleRepository,
        topologyReferencePort: this.topologyPort
      });

      return { statusCode: 200, body: rules };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * DELETE /rules/:ruleId
   * Elimina una regla específica validando ownership del hogar padre.
   */
  async deleteRule(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const ruleId = req.params?.ruleId;
      if (!ruleId || ruleId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid ruleId parameter.' }
        };
      }

      await deleteAutomationRuleUseCase(ruleId, req.userId, {
        automationRuleRepository: this.automationRuleRepository,
        topologyReferencePort: this.topologyPort
      });

      return { statusCode: 204 };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * PATCH /rules/:ruleId/enable
   * Habilita una regla desactivada. Operación idempotente.
   */
  async enableRule(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const ruleId = req.params?.ruleId;
      if (!ruleId || ruleId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid ruleId parameter.' }
        };
      }

      const rule = await enableAutomationRuleUseCase(ruleId, req.userId, {
        automationRuleRepository: this.automationRuleRepository,
        topologyReferencePort: this.topologyPort
      });

      return { statusCode: 200, body: rule };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * PATCH /rules/:ruleId/disable
   * Deshabilita una regla activa. Operación idempotente.
   */
  async disableRule(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const ruleId = req.params?.ruleId;
      if (!ruleId || ruleId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid ruleId parameter.' }
        };
      }

      const rule = await disableAutomationRuleUseCase(ruleId, req.userId, {
        automationRuleRepository: this.automationRuleRepository,
        topologyReferencePort: this.topologyPort
      });

      return { statusCode: 200, body: rule };
    } catch (error) {
      return handleError(error);
    }
  }

  /**
   * PATCH /rules/:ruleId
   * Actualización parcial (PATCH semántico) de name, trigger y/o action.
   * Si el body no contiene ningún campo reconocido → 400.
   */
  async updateRule(req: AuthenticatedHttpRequest): Promise<HttpResponse> {
    try {
      const ruleId = req.params?.ruleId;
      if (!ruleId || ruleId.trim() === '') {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Missing or invalid ruleId parameter.' }
        };
      }

      const body = req.body as Record<string, unknown> | null | undefined;
      if (!body || typeof body !== 'object') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid request body.' } };
      }

      // Acumulador mutable local — el tipo final se convierte al interface readonly al pasarlo
      let patchName: string | undefined;
      let patchTrigger: AutomationTrigger | undefined;
      let patchAction: AutomationAction | undefined;

      // Narrowing de name
      if ('name' in body) {
        if (typeof body.name !== 'string') {
          return { statusCode: 400, body: { error: 'Bad Request', message: 'Field name must be a string.' } };
        }
        patchName = body.name;
      }

      // Narrowing de trigger
      if ('trigger' in body) {
        if (!body.trigger || typeof body.trigger !== 'object') {
          return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid trigger structure.' } };
        }
        const t = body.trigger as Record<string, unknown>;

        if (typeof t.deviceId !== 'string' || typeof t.stateKey !== 'string') {
          return { statusCode: 400, body: { error: 'Bad Request', message: 'trigger.deviceId and stateKey must be strings.' } };
        }
        if (
          typeof t.expectedValue !== 'string' &&
          typeof t.expectedValue !== 'number' &&
          typeof t.expectedValue !== 'boolean'
        ) {
          return {
            statusCode: 400,
            body: { error: 'Bad Request', message: 'trigger.expectedValue must be string, number or boolean.' }
          };
        }

        patchTrigger = {
          deviceId: t.deviceId,
          stateKey: t.stateKey,
          expectedValue: t.expectedValue
        };
      }

      // Narrowing de action
      if ('action' in body) {
        if (!body.action || typeof body.action !== 'object') {
          return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid action structure.' } };
        }
        const a = body.action as Record<string, unknown>;

        if (typeof a.deviceId !== 'string' || typeof a.command !== 'string' || !isValidCommand(a.command)) {
          return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid action.command value.' } };
        }

        patchAction = {
          targetDeviceId: a.deviceId,
          command: a.command
        };
      }

      // Rechazar bodies vacíos sin campos reconocidos
      if (patchName === undefined && patchTrigger === undefined && patchAction === undefined) {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Body must contain at least one updatable field: name, trigger, action.' }
        };
      }

      // Construir patch final tipado a partir del acumulador
      const patch: UpdateAutomationRuleRequest = {
        ...(patchName !== undefined && { name: patchName }),
        ...(patchTrigger !== undefined && { trigger: patchTrigger }),
        ...(patchAction !== undefined && { action: patchAction })
      };

      const rule = await updateAutomationRuleUseCase(ruleId, req.userId, patch, {
        automationRuleRepository: this.automationRuleRepository,
        deviceRepository: this.deviceRepository,
        topologyReferencePort: this.topologyPort
      });

      return { statusCode: 200, body: rule };
    } catch (error) {
      return handleError(error);
    }
  }
}
