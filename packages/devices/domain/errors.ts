/**
 * Errores inmutables del dominio Device.
 */

export class DeviceDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidDeviceExternalIdError extends DeviceDomainError {
  constructor() {
    super('Invalid Device externalId: must be a non-empty string.');
  }
}

export class InvalidDeviceNameError extends DeviceDomainError {
  constructor() {
    super('Invalid Device name: must be a non-empty string.');
  }
}

export class InvalidDeviceTypeError extends DeviceDomainError {
  constructor() {
    super('Invalid Device type: must be a non-empty string.');
  }
}

export class InvalidDeviceVendorError extends DeviceDomainError {
  constructor() {
    super('Invalid Device vendor: must be a non-empty string.');
  }
}

export class InvalidTopologyReferenceError extends DeviceDomainError {
  constructor(reference: string) {
    super(`Invalid Topology Reference: ${reference} must be a non-empty string.`);
  }
}

export class DeviceAlreadyAssignedError extends DeviceDomainError {
  constructor(deviceId: string) {
    super(`Device ${deviceId} is already assigned to a room and cannot be reassigned or mutated in Inbox state.`);
  }
}

export class InvalidDeviceCommandError extends DeviceDomainError {
  constructor(command: string) {
    super(`Command '${command}' is not supported by the strictly guarded V1 definitions.`);
  }
}
export class UnsupportedCommandError extends DeviceDomainError {
  constructor(deviceType: string, command: string) {
    super(`Command '${command}' is not supported by device type '${deviceType}'.`);
  }
}
