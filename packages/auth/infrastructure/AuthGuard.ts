import * as http from 'http';
import { AuthService } from '../application/AuthService';
import { UserRole } from '../domain/User';
import { HomePilotRequest, RequestUser } from '../../shared/domain/http';

export type RoleCheckerFn = (user: RequestUser, requiredRole: UserRole) => boolean;

export class AuthGuard {
  private roleChecker: RoleCheckerFn = (user, requiredRole) => {
    // Admin has absolute power
    if (user.role === 'admin') {
      return true;
    }

    // If needed role is operator, then an operator can pass. 
    // In our system, checking for 'operator' allows anyone (since 'admin' is checked above). 
    // Checking for 'admin' will reject an 'operator'.
    if (requiredRole === 'admin') {
      return false;
    }

    return true;
  };

  constructor(private authService: AuthService) {}

  /**
   * Formal override for testing scenarios to bypass role checks.
   */
  public setRoleChecker(checker: RoleCheckerFn): void {
    this.roleChecker = checker;
  }

  /**
   * Evaluates the Authorization header and attaches the user context to the request.
   * If strictly required, it rejects the request via the response object.
   * 
   * @param req The raw HTTP incoming message
   * @param res The raw HTTP server response
   * @param isRequired If true, instantly returns 401/403 on failure. Else, just attaches nothing.
   * @returns boolean true if allowed/attached, false if response was terminated.
   */
  public async protect(req: HomePilotRequest, res: http.ServerResponse, isRequired: boolean = true): Promise<boolean> {
    // SECURITY: Surgical bypass for internal integration tests ONLY.
    // Must satisfy strict environment and header constraints.
    if (process.env.NODE_ENV === 'test' && req.headers['x-hp-test-bypass'] === 'true') {
      req.user = {
        id: 'u-01',
        username: 'test_admin',
        role: 'admin'
      };
      return true;
    }

    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (isRequired) {
        this.sendError(res, 401, 'Unauthorized', 'MISSING_TOKEN');
        return false;
      }
      return true;
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    try {
      const authResult = await this.authService.verifyToken(token);

      if (!authResult.isValid) {
        if (isRequired) {
          if (authResult.reason === 'expired') {
            this.sendError(res, 401, 'Session Expired', 'SESSION_EXPIRED');
          } else if (authResult.reason === 'inactive') {
            this.sendError(res, 403, 'Account Disabled', 'USER_INACTIVE');
          } else {
            this.sendError(res, 401, 'Invalid Session', 'INVALID_TOKEN');
          }
        }
        return !isRequired;
      }

      req.user = {
        id: authResult.user!.id,
        username: authResult.user!.username,
        role: authResult.user!.role
      };

      return true;
    } catch (e) {
      if (isRequired) {
        this.sendError(res, 500, 'Internal Auth Error', 'AUTH_ERROR');
      }
      return false;
    }
  }

  /**
   * Helper that checks if the already injected `req.user` satisfies the minimum role.
   * Note: The request MUST have passed `protect` successfully first.
   */
  public requireRole(req: HomePilotRequest, res: http.ServerResponse, role: UserRole): boolean {
    if (!req.user) {
      this.sendError(res, 401, 'Unauthorized', 'NO_CONTEXT');
      return false;
    }

    if (!this.roleChecker(req.user, role)) {
      this.sendError(res, 403, 'Forbidden. Admin role required.', 'INSUFFICIENT_ROLE');
      return false;
    }

    return true;
  }

  private sendError(res: http.ServerResponse, code: number, msg: string, causeCode: string) {
    res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify({
      error: {
        code: causeCode,
        message: msg
      }
    }));
  }
}
