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

      const body = req.body as Record<string, unknown> | null | undefined;
      if (!body || typeof body !== 'object') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Invalid request body.' } };
      }

      const { name, trigger, action } = body;
      if (typeof name !== 'string' || name.trim() === '') {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid field: name.' } };
      }

      if (!trigger || typeof trigger !== 'object' || !('type' in (trigger as any))) {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid trigger: must include type.' } };
      }

      if (!action || typeof action !== 'object' || !('type' in (action as any))) {
        return { statusCode: 400, body: { error: 'Bad Request', message: 'Missing or invalid action: must include type.' } };
      }

      const rule = await createAutomationRuleUseCase(
        {
          homeId,
          userId: req.userId,
          name: name.trim(),
          trigger: trigger as AutomationTrigger,
          action: action as AutomationAction
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

      const { name, trigger, action } = body;

      if (name === undefined && trigger === undefined && action === undefined) {
        return {
          statusCode: 400,
          body: { error: 'Bad Request', message: 'Body must contain at least one updatable field: name, trigger, action.' }
        };
      }

      const patch: UpdateAutomationRuleRequest = {
        ...(typeof name === 'string' && { name }),
        ...(trigger !== undefined && typeof trigger === 'object' && 'type' in (trigger as any) && { trigger: trigger as AutomationTrigger }),
        ...(action !== undefined && typeof action === 'object' && 'type' in (action as any) && { action: action as AutomationAction })
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
