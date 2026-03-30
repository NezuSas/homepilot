import { AuthenticatedHttpRequest, HttpResponse } from '../../../topology/api/core/http';
import { handleError } from '../core/errorHandler';
import { 
  createAutomationRuleUseCase, 
  listAutomationRulesUseCase, 
  deleteAutomationRuleUseCase 
} from '../../application';
import { AutomationRuleRepository } from '../../domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from '../../application/ports/TopologyReferencePort';
import { IdGenerator } from '../../../shared/domain/types';
import { AutomationTrigger, AutomationAction } from '../../domain/automation/types';
import { isValidCommand } from '../../domain/commands';

/**
 * Controller agnóstico para la gestión de Reglas de Automatización V1.
 * Traduce las solicitudes HTTP AuthenticatedHttpRequest al lenguaje de Casos de Uso del Dominio.
 * Alineado estrictamente con el Spec V1: /homes/:homeId/rules
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

      // 1. Narrowing estructural contra 'unknown' para evitar 'any'
      const body = req.body as Record<string, unknown> | null | undefined;
      if (!body || typeof body !== 'object') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid request body.' } };
      }

      // 2. Validación de campos de primer nivel
      const { name, trigger, action } = body;
      if (typeof name !== 'string' || name.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid field: name.' } };
      }

      // 3. Validación y Narrowing del Trigger
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
      
      // Validación estricta del tipo de expectedValue según Spec
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

      // 4. Validación y Narrowing de la Acción
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
        targetDeviceId: aDeviceId, // Mapeo semántico Payload (deviceId) -> Dominio (targetDeviceId)
        command: aCommand
      };

      // 5. Ejecución del Caso de Uso (Lógica de Negocio y Zero-Trust)
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

      return {
        statusCode: 201,
        body: rule
      };
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

      return {
        statusCode: 200,
        body: rules
      };
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

      return {
        statusCode: 204
      };
    } catch (error) {
      return handleError(error);
    }
  }
}
