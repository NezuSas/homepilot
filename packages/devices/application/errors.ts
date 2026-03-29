/**
 * Errores estructurales interceptables por el middleware/Gateway API en su periferia exterior.
 */
export class DeviceApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DeviceNotFoundError extends DeviceApplicationError {
  constructor(identifier: string) {
    super(`Device with identifier ${identifier} was not found.`);
  }
}

export class ForbiddenOwnershipError extends DeviceApplicationError {
  constructor(message: string) {
    super(message);
  }
}

export class DeviceConflictError extends DeviceApplicationError {
  constructor(externalId: string, homeId: string) {
    super(`Device with externalId ${externalId} already exists in Home ${homeId}.`);
  }
}

export class TopologyResourceNotFoundError extends DeviceApplicationError {
  constructor(resourceType: string, resourceId: string) {
    super(`Topology resource ${resourceType} with id ${resourceId} was not found.`);
  }
}

export class DevicePendingStateError extends DeviceApplicationError {
  constructor(deviceId: string) {
    super(`Device ${deviceId} is currently in PENDING state and cannot accept operational commands.`);
  }
}

export class DispatchIntegrationError extends DeviceApplicationError {
  constructor(deviceId: string, reason: string) {
    super(`Gateway failed to dispatch command for device ${deviceId}. Reason: ${reason}`);
  }
}
