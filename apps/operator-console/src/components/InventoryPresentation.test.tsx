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
    expect(html).toContain('common.unassigned');
    expect(html).toContain('common.save');
    expect(html).toContain('inbox.manage_device');
    expect(html).not.toMatch(/native_local|aria-pressed|device_states.on|device_states.off/);
  });
  it('prevents assigning an unavailable device even if rendered outside the filtered list', () => {
    const html = renderToStaticMarkup(<InboxDeviceTile device={{ id: 'd', homeId: 'h', roomId: null, name: 'Luz', type: 'light', status: 'PENDING', lastKnownState: { state: 'unavailable' } }} rooms={[]} />);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  const labels = { identity: 'Identidad', access: 'Rol', status: 'Estado', controls: 'Controles', active: 'Activo', suspended: 'Suspendido', live: 'Sesión activa', suspendTitle: 'Suspender', restoreTitle: 'Restaurar', revokeTitle: 'Revocar sesiones', resetPasswordTitle: 'Restablecer contraseña', swapRoleTitle: () => 'Cambiar rol' };
  const user = { id: 'u', username: 'ana', displayName: 'Ana', avatarDataUri: null, role: 'operator' as const, isActive: true, hasActiveSessions: false, createdAt: '', updatedAt: '' };
  it.each(['u', 'other'])('retains security controls and current-user password protection for %s', currentUserId => {
    const html = renderToStaticMarkup(<UserAccessCard user={user} labels={labels} roleOptions={[{ value: 'operator', label: 'Operador' }]} currentUserId={currentUserId} onToggleActive={noop} onChangeRole={noop} onRevokeSessions={noop} onResetPassword={noop} />);
    expect(html).toContain('Ana');
    expect(html).toContain('aria-label="Rol"');
    expect(html).toContain('aria-label="Suspender"');
    expect(html).toMatch(/aria-label="Revocar sesiones"[^>]*disabled=""/);
    expect(html.includes('aria-label="Restablecer contraseña"')).toBe(currentUserId !== user.id);
  });
});
