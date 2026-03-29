/**
 * Clase base para errores generados explícitamente por la Capa de Aplicación.
 */
export class TopologyApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopologyApplicationError';
  }
}

/**
 * Error lanzado cuando no se provee el contexto mínimo de ejecución
 * (ej. ausencia de identificador de usuario).
 */
export class InvalidContextError extends TopologyApplicationError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidContextError';
  }
}

/**
 * Error lanzado cuando no se encuentra un recurso referenciado lógicamente
 * requerido por el caso de uso.
 */
export class NotFoundError extends TopologyApplicationError {
  constructor(resourceName: string, id: string) {
    super(`${resourceName} with ID ${id} was not found.`);
    this.name = 'NotFoundError';
  }
}

/**
 * Error lanzado cuando el usuario no cumple con el alineamiento lógico de ownership
 * contra un recurso existente en persistencia.
 */
export class ForbiddenError extends TopologyApplicationError {
  constructor() {
    super(`Access denied to the requested resource.`);
    this.name = 'ForbiddenError';
  }
}
