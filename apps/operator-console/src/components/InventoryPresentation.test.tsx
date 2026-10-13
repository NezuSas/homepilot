import { renderToStaticMarkup } from 'react-dom/server';
import { InboxDeviceTile } from './InboxDeviceTile';
import { UserAccessCard } from './UsersTable';
import { DeviceInspectorInfoTab, DeviceInspectorLogsTab } from './DeviceInspectorTabs';
jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }));
const noop = () => {};
it('keeps configuration and a discreet removal control without the internal home card', () => {
  const html = renderToStaticMarkup(<DeviceInspectorInfoTab device={{ id: 'd', externalId: 'ha:light.desk', homeId: 'local-home', roomId: null, lastKnownState: null, name: 'Luz', type: 'light', status: 'ASSIGNED', integrationSource: 'home-assistant', capabilities: [{ type: 'light', name: 'Light', commands: [{ name: 'turn_on' }] }] }} rooms={[]} unavailable={false} isOnline={true} isActionLoading={false} isRefreshing={false} error={null} configurationOnly onSemanticTypeChange={noop} onInvertStateChange={noop} onCommand={noop} onRefresh={noop} onMove={noop} onUnassign={noop} onDelete={noop} />);
  expect(html).not.toContain('local-home');
  expect(html).toContain('ha:light.desk');
  expect(html).toContain('Turn On');
  expect(html).toContain('common.delete');
  expect(html).not.toContain('actions.force_on');
});
it('translates the known HA synchronization record without rewriting stored descriptions', () => {
  const html = renderToStaticMarkup(<DeviceInspectorLogsTab logs={[{ timestamp: '2026-10-01T12:00:00Z', deviceId: 'd', type: 'STATE_CHANGED', description: 'Device synchronized from Home Assistant WebSocket', data: {} }]} />);
  expect(html).toContain('audit_logs.messages.DEVICE_SYNC');
  expect(html).not.toContain('Device synchronized from Home Assistant WebSocket');
});
describe('Feature: Compact inventory and access (AC55, AC56)', () => {
  it('keeps pending assignment and explicit configuration, without native-local or operational controls', () => {
    const html = renderToStaticMarkup(<InboxDeviceTile device={{ id: 'd', homeId: 'h', roomId: null, lastKnownState: null, name: 'Luz', type: 'light', status: 'PENDING', integrationSource: 'sonoff' }} rooms={[]} onInspect={noop} />);
    expect(html).toContain('inbox.choose_room');
    expect(html).toContain('inbox.assign');
    expect(html).toContain('inbox.manage_device');
    expect(html).not.toMatch(/native_local|aria-pressed|device_states.on|device_states.off/);
  });
  it('prevents assigning an unavailable device even if rendered outside the filtered list', () => {
    const html = renderToStaticMarkup(<InboxDeviceTile device={{ id: 'd', homeId: 'h', roomId: null, name: 'Luz', type: 'light', status: 'PENDING', lastKnownState: { state: 'unavailable' } }} rooms={[]} />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  const labels = { identity: 'Identidad', access: 'Rol', status: 'Estado', controls: 'Controles', active: 'Activo', suspended: 'Suspendido', live: 'Sesión activa', moreActions: 'Más acciones', suspendTitle: 'Suspender', restoreTitle: 'Restaurar', revokeTitle: 'Revocar sesiones', resetPasswordTitle: 'Restablecer contraseña', editAccessTitle: 'Editar acceso', swapRoleTitle: () => 'Cambiar rol' };
  const cardProps = {
    getRoleLabel: (role: string) => (role === 'guest' ? 'Invitado' : 'Familiar'),
    getRoleDescription: (role: string) => `desc-${role}`,
    getAccessText: () => 'Toda la casa',
    getExpiry: () => null,
    onEditAccess: noop,
  };
  const user = { id: 'u', username: 'ana', displayName: 'Ana', avatarDataUri: null, role: 'parent' as const, isActive: true, hasActiveSessions: false, createdAt: '', updatedAt: '' };
  it.each(['u', 'other'].flatMap(currentUserId => [false, true].map(hasActiveSessions => ({ currentUserId, hasActiveSessions }))))('retains security controls and current-user password protection for $currentUserId with active sessions=$hasActiveSessions', ({ currentUserId, hasActiveSessions }) => {
    const html = renderToStaticMarkup(<UserAccessCard user={{ ...user, hasActiveSessions }} labels={labels} roleOptions={[{ value: 'parent', label: 'Familiar' }]} {...cardProps} currentUserId={currentUserId} onToggleActive={noop} onChangeRole={noop} onRevokeSessions={noop} onResetPassword={noop} />);
    expect(html).toContain('Ana');
    expect(html).toContain('aria-label="Rol"');
    // The security actions live in one labelled menu; the live session shows as a dot on the photo.
    expect(html).toContain('aria-label="Más acciones"');
    expect(html.includes('aria-label="Sesión activa"')).toBe(hasActiveSessions);
  });

  it('shows what a limited guest can reach, when the access ends, and offers to edit it', () => {
    const guest = { ...user, role: 'guest' as const, accessScope: 'rooms' as const, roomIds: ['sala'], expiresAt: '2026-10-20T00:00:00.000Z' };
    const html = renderToStaticMarkup(<UserAccessCard user={guest} labels={labels} roleOptions={[{ value: 'guest', label: 'Invitado' }]} {...cardProps}
      getAccessText={() => 'Solo: Sala'} getExpiry={() => ({ text: 'Vence el 20 de octubre de 2026', expired: false })}
      currentUserId="other" onToggleActive={noop} onChangeRole={noop} onRevokeSessions={noop} onResetPassword={noop} />);

    expect(html).toContain('Solo: Sala');
    expect(html).toContain('Vence el 20 de octubre de 2026');
    expect(html).toContain('desc-guest');
    expect(html).toContain('Editar acceso');
    expect(html).not.toContain('text-danger');
  });

  it('marks an expired account in the danger tone', () => {
    const html = renderToStaticMarkup(<UserAccessCard user={{ ...user, role: 'guest' as const }} labels={labels} roleOptions={[{ value: 'guest', label: 'Invitado' }]} {...cardProps}
      getExpiry={() => ({ text: 'Acceso vencido', expired: true })} currentUserId="other" onToggleActive={noop} onChangeRole={noop} onRevokeSessions={noop} onResetPassword={noop} />);

    expect(html).toContain('Acceso vencido');
    expect(html).toContain('text-danger');
  });

  it.each(['admin', 'parent'] as const)('does not offer room access editing for the %s role', (role) => {
    const html = renderToStaticMarkup(<UserAccessCard user={{ ...user, role }} labels={labels} roleOptions={[{ value: 'parent', label: 'Familiar' }]} {...cardProps}
      currentUserId="other" onToggleActive={noop} onChangeRole={noop} onRevokeSessions={noop} onResetPassword={noop} />);

    expect(html).not.toContain('Editar acceso');
  });

});
