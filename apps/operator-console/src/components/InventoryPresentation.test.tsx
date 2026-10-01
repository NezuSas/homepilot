import { renderToStaticMarkup } from 'react-dom/server';
import { InboxDeviceTile } from './InboxDeviceTile';
import { UserAccessCard } from './UsersTable';
jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const noop = () => {};
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
