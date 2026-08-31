import { isAllowedCloudDeviceCommand, isGatewayOperationAllowed, localGatewayPrincipal } from './CloudGatewayAuthorizationPolicy';

describe('CloudGatewayAuthorizationPolicy', () => {
  it('maps Cloud roles to the least-privileged local principals', () => {
    expect(localGatewayPrincipal('owner')).toBe('parent');
    expect(localGatewayPrincipal('member')).toBe('read-only');
  });

  it('keeps member access read-only and never exposes Edge administration', () => {
    expect(isGatewayOperationAllowed('member', 'dashboard.read')).toBe(true);
    expect(isGatewayOperationAllowed('member', 'device.command')).toBe(false);
    expect(isGatewayOperationAllowed('owner', 'device.command')).toBe(true);
  });

  it('allows only basic device controls', () => {
    expect(isAllowedCloudDeviceCommand('turn_on')).toBe(true);
    expect(isAllowedCloudDeviceCommand('camera.stream')).toBe(false);
    expect(isAllowedCloudDeviceCommand('create_user')).toBe(false);
  });
});
