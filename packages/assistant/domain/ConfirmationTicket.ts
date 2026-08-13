/**
 * ConfirmationTicket
 *
 * A single-use, TTL-bound confirmation for a bulk/multi-device assistant action.
 * Replaces the legacy `pendingBulkAction` blob stored inside assistant_memory:
 * the ticket lives in its own table, cannot be consumed twice (`consumedAt`),
 * and its expiry is enforced by the repository query, not by application code
 * re-deriving a TTL from a stored timestamp.
 */
export type ConfirmationTicketCommand = 'turn_on' | 'turn_off' | 'toggle';

export interface ConfirmationTicket {
  readonly id: string;
  readonly userId: string;
  readonly homeId: string;
  readonly command: ConfirmationTicketCommand;
  readonly bulkType?: 'all' | 'lights';
  readonly deviceIds: string[];
  readonly originalPrompt: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
}
