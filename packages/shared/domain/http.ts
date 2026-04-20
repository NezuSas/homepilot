import * as http from 'http';
import { UserRole } from '../../auth/domain/User';

/**
 * Common user context attached to authenticated requests.
 */
export interface RequestUser {
  id: string;
  username: string;
  role: UserRole;
}

/**
 * Specialized IncomingMessage for HomePilot.
 * Avoids constant 'as any' casting for decorated properties.
 */
export interface HomePilotRequest extends http.IncomingMessage {
  /**
   * User context injected by AuthGuard.
   */
  user?: RequestUser;

  /**
   * Raw string body captured by Fastify before hijack.
   */
  _fastifyParsedBody?: string;

  /**
   * Optional URL parameters (if handled by router)
   */
  params?: Record<string, string>;

  /**
   * Query string parameters
   */
  query?: Record<string, string | string[] | undefined>;
}
