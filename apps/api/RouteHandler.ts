import * as http from 'http';
import { HomePilotRequest } from '../../packages/shared/domain/http';
import { BootstrapContainer } from '../../bootstrap';

/**
 * RouteHandler interface for modular API route handling.
 * Each domain-specific handler implements this interface.
 * Returns true if the handler claimed and processed the request.
 */
export interface RouteHandler {
  handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean>;
}
