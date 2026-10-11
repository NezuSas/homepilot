import { ConfirmationTicket } from '../../domain/ConfirmationTicket';
import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import type { AssistantConversationResponse, ExecutedCommandResult } from './conversationTypes';
import { formatMultiCommandSummary } from './responseMessages';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Accept and reject flows for persisted bulk action confirmation tickets. */
export class BulkConfirmationHandler extends ConversationCollaborator {
  public async handleBulkActionAccept(userId: string, language: string, ticket: ConfirmationTicket): Promise<AssistantConversationResponse> {
    const memory = await this.deps.memoryService.getShortTermMemory(userId);
    const allowedCommands = ['turn_on', 'turn_off', 'toggle'];
    if (!allowedCommands.includes(ticket.command)) {
      console.warn(`[ASSISTANT_BULK_EXECUTION_INVALID] {"command":"${ticket.command}"}`);
      return {
        type: 'error',
        message: language === 'en' ? "Invalid command for bulk action." : "Comando inválido para acción en lote."
      };
    }

    // Single-use guarantee: an already-consumed or expired ticket cannot be replayed
    // (e.g. a late "sí", or the same confirmation answered twice in a race).
    const consumed = this.deps.confirmationTicketRepository ? await this.deps.confirmationTicketRepository.consume(ticket.id) : false;
    if (!consumed) {
      console.warn(`[ASSISTANT_BULK_CONFIRMATION_ALREADY_CONSUMED] ${JSON.stringify({ ticketId: ticket.id })}`);
      return {
        type: 'answer',
        message: language === 'en'
          ? "That confirmation is no longer available. Please ask again."
          : "Esa confirmación ya no está disponible. Pídemelo de nuevo."
      };
    }

    // Revalidate permissions: the home this ticket was issued for must still be authorized
    // for this user (e.g. access could have been revoked between proposal and confirmation).
    try {
      await this.deps.permissionGate.assertHomeAuthorized(userId, ticket.homeId);
    } catch {
      console.warn(`[ASSISTANT_BULK_CONFIRMATION_HOME_REVOKED] ${JSON.stringify({ userId, homeId: ticket.homeId })}`);
      await this.modules.session.clearPendingAction(userId);
      return {
        type: 'error',
        message: language === 'en' ? "You're no longer authorized for that action." : "Ya no tienes autorización para esa acción."
      };
    }

    // Revalidate scope: re-check availability/capability/current-state against the CURRENT
    // device state, restricted to the originally proposed device set. A device that changed
    // state, lost its capability, or disappeared in the meantime is dropped rather than
    // blindly re-executed on stale information.
    const command = ticket.command as DeviceCommandV1;
    const currentDevices = await this.deps.permissionGate.getAuthorizedDevices(userId);
    const stillEligible = currentDevices.filter(d => {
      if (!ticket.deviceIds.includes(d.id)) return false;
      if (ticket.command === 'toggle') return this.deps.scopeFilter.isControllableDevice(d, command);
      return this.deps.scopeFilter.isControllableForBulk(d, command, ticket.bulkType || 'all') && this.deps.scopeFilter.requiresBulkStateChange(d, command);
    });

    if (stillEligible.length === 0) {
      await this.modules.session.clearPendingAction(userId);
      return {
        type: 'answer',
        message: language === 'en'
          ? "Nothing to do — those devices are already in the requested state."
          : "No hay nada que hacer: esos dispositivos ya estaban en el estado solicitado."
      };
    }

    const skippedCount = ticket.deviceIds.length - stillEligible.length;

    console.info(`[ASSISTANT_BULK_EXECUTION_APPROVED] ${JSON.stringify({ count: stillEligible.length, originalCount: ticket.deviceIds.length, command: ticket.command })}`);
    const correlationId = `bulk-${Date.now()}`;
    const results: ExecutedCommandResult[] = [];
    const entities = [];

    for (const device of stillEligible) {
      const result = await this.modules.commands.executeAuthorizedCommand(userId, device.id, command, ticket.originalPrompt, correlationId);
      results.push({ action: { deviceId: device.id, command }, deviceName: device.name, result });
      entities.push({ id: device.id, name: device.name, type: device.type, roomId: device.roomId });
    }

    await this.modules.session.clearPendingAction(userId);

    // Save to memory so user can say "apágalas" later
    await this.deps.memoryService.saveShortTermMemory(userId, {
      lastQueryType: 'command',
      entities,
      timestamp: new Date().toISOString()
    });

    let summary = formatMultiCommandSummary(results, language, ticket.bulkType);
    if (skippedCount > 0) {
      summary += language === 'en'
        ? ` (${skippedCount} device(s) were already in the requested state and were skipped.)`
        : ` (${skippedCount} dispositivo(s) ya estaban en el estado solicitado y se omitieron.)`;
    }

    return await this.modules.session.attachSuggestionIfNeeded({
      type: 'execution',
      message: summary,
      execution: {
        sceneId: 'bulk_action',
        status: (() => {
          const successCount = results.filter(r => r.result.status === 'success').length;
          if (successCount === results.length) return 'success';
          return successCount === 0 ? 'failed' : 'partial';
        })(),
        actions: results.flatMap(r => r.result.actions)
      }
    }, userId, language, memory, 'multi_command');
  }

  public async handleBulkActionReject(userId: string, language: 'es' | 'en', ticket: ConfirmationTicket): Promise<AssistantConversationResponse> {
    console.info(`[ASSISTANT_BULK_EXECUTION_CANCELLED] ${JSON.stringify({ count: ticket.deviceIds.length, command: ticket.command })}`);
    if (this.deps.confirmationTicketRepository) await this.deps.confirmationTicketRepository.consume(ticket.id);
    await this.modules.session.clearPendingAction(userId);
    return {
      type: 'answer',
      message: getAssistantResponseText('action.cancelled', language, {})
    };
  }
}
