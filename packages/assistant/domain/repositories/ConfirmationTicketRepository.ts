import { ConfirmationTicket } from '../ConfirmationTicket';

/**
 * Puerto de Salida (Outbound Port) para la persistencia de tickets de confirmación.
 */
export interface ConfirmationTicketRepository {
  create(ticket: ConfirmationTicket): Promise<void>;

  /**
   * Returns the most recent non-consumed, non-expired ticket for a user, or null.
   */
  findActiveByUserId(userId: string): Promise<ConfirmationTicket | null>;

  /**
   * Atomically marks a ticket as consumed. Returns false (no-op) if the ticket
   * does not exist, was already consumed, or has expired — guaranteeing a
   * ticket can never be acted upon twice.
   */
  consume(id: string): Promise<boolean>;

  /**
   * Best-effort cleanup of expired tickets. Safe to call periodically; never
   * required for correctness since findActiveByUserId already excludes expired rows.
   */
  deleteExpired(): Promise<void>;
}
