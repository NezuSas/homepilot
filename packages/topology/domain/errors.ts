/**
 * Clase base para errores del dominio de topología.
 */
export class TopologyDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TopologyDomainError';
  }
}

/**
 * Error al proveer un nombre de hogar inválido o vacío.
 */
export class InvalidHomeNameError extends TopologyDomainError {
  constructor() {
    super('The Home name cannot be empty.');
    this.name = 'InvalidHomeNameError';
  }
}

/**
 * Error al proveer un identificador de usuario inválido o vacío.
 */
export class InvalidUserIdError extends TopologyDomainError {
  constructor() {
    super('The User ID cannot be empty.');
    this.name = 'InvalidUserIdError';
  }
}

/**
 * Error al proveer un nombre de habitación inválido o vacío.
 */
export class InvalidRoomNameError extends TopologyDomainError {
  constructor() {
    super('The Room name cannot be empty.');
    this.name = 'InvalidRoomNameError';
  }
}

/**
 * Error al proveer un identificador de hogar padre inválido o vacío.
 */
export class InvalidHomeIdError extends TopologyDomainError {
  constructor() {
    super('The Home ID cannot be empty.');
    this.name = 'InvalidHomeIdError';
  }
}
