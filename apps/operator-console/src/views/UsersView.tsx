import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import {
  SELECTABLE_ROLES,
  canRestrictAccess,
  defaultAccessFor,
  describeAccess,
  describeExpiry,
  resolveExpiry,
  type HouseholdRole,
} from '../lib/userAccess';
import { UserCreateForm, type UserRole } from '../components/UserCreateForm';
import { UserAccessFields, type AccessRoom, type UserAccessValue } from '../components/UserAccessFields';
import { UserAccessModal } from '../components/UserAccessModal';
import { UsersErrorBanner } from '../components/UsersErrorBanner';
import { UsersHeader } from '../components/UsersHeader';
import { UsersSkeleton } from '../components/ui/ComponentSkeletons';
import { useInitialLoading } from '../components/ui/useInitialLoading';
import { UsersProtectionNote } from '../components/UsersProtectionNote';
import { UsersTable, type PublicUserDto } from '../components/UsersTable';
import { ResetUserPasswordModal } from '../components/ResetUserPasswordModal';
import ConfirmModal from '../components/ConfirmModal';

interface UsersViewProps {
  currentUserId: string | null;
}

interface PendingUserAction {
  confirmMessage: string;
  execute: () => Promise<Response>;
}

const DEFAULT_ROLE: HouseholdRole = 'parent';

function startingAccess(role: HouseholdRole): UserAccessValue {
  const { scope, preset } = defaultAccessFor(role);
  return { scope, roomIds: [], preset, customDate: '' };
}

export function UsersView({ currentUserId }: UsersViewProps) {
  const { t, i18n } = useTranslation();
  const [users, setUsers] = useState<PublicUserDto[]>([]);
  const [rooms, setRooms] = useState<AccessRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoading = useInitialLoading(loading);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(DEFAULT_ROLE);
  const [newAccess, setNewAccess] = useState<UserAccessValue>(() => startingAccess(DEFAULT_ROLE));
  const [createError, setCreateError] = useState('');
  const [createAccessError, setCreateAccessError] = useState('');
  const [passwordResetUser, setPasswordResetUser] = useState<PublicUserDto | null>(null);
  const [accessUser, setAccessUser] = useState<PublicUserDto | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  const roleOptions = SELECTABLE_ROLES.map(role => ({ value: role, label: t(`users.roles.${role}`), description: t(`users.role_descriptions.${role}`) }));
  const roomNames = useMemo(() => new Map(rooms.map(room => [room.id, room.name])), [rooms]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/users`);
      if (!res.ok) {
        throw new Error(t('users.errors.fetch_failed'));
      }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('common.errors.unknown'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Users are loaded once when this screen opens.

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`${API_BASE_URL}/api/v1/rooms`, { signal: controller.signal })
      .then(response => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        if (controller.signal.aborted || !Array.isArray(data)) return;
        setRooms((data as { id: string; name: string }[]).map(room => ({ id: room.id, name: room.name })));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewUsername('');
    setNewPassword('');
    setNewRole(DEFAULT_ROLE);
    setNewAccess(startingAccess(DEFAULT_ROLE));
    setCreateError('');
    setCreateAccessError('');
  };

  const handleNewRoleChange = (role: UserRole) => {
    setNewRole(role);
    setNewAccess(startingAccess(role));
    setCreateAccessError('');
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    setCreateAccessError('');
    if (newPassword.length < 8) {
      setCreateError(t('change_password.error_length'));
      return;
    }

    const restricted = canRestrictAccess(newRole);
    const expiresAt = restricted ? resolveExpiry(newAccess.preset, newAccess.customDate) : null;
    if (expiresAt === undefined) {
      setCreateAccessError(t('users.access.expiry_past'));
      return;
    }

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          passwordPlain: newPassword,
          role: newRole,
          ...(restricted ? { accessScope: newAccess.scope, roomIds: newAccess.scope === 'rooms' ? newAccess.roomIds : [], expiresAt } : {}),
        })
      });
      if (!res.ok) {
        const err = await res.json();
        const msg = err.error?.message || (typeof err.error === 'string' ? err.error : t('users.errors.create_failed'));
        throw new Error(msg);
      }
      resetCreateForm();
      await fetchUsers();
    } catch (error_: unknown) {
      setCreateError(error_ instanceof Error ? error_.message : t('common.errors.unknown'));
    }
  };

  const handleAction = (actionFn: () => Promise<Response>, confirmMsg: string) => {
    setPendingAction({ confirmMessage: confirmMsg, execute: actionFn });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;

    setIsConfirmingAction(true);
    try {
      setError('');
      const res = await pendingAction.execute();
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error?.message || (typeof errData.error === 'string' ? errData.error : t('common.errors.operation_failed'));
        throw new Error(msg);
      }
      await fetchUsers();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('common.errors.unknown'));
    } finally {
      setIsConfirmingAction(false);
      setPendingAction(null);
    }
  };

  const handleToggleActive = (user: PublicUserDto) => {
    handleAction(
      () => apiFetch(`${API_BASE_URL}/api/v1/admin/users/${user.id}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive })
      }),
      user.isActive ? t('users.actions.confirm_suspend') : t('users.actions.confirm_restore')
    );
  };

  const handleChangeRole = (user: PublicUserDto, role: UserRole) => {
    handleAction(
      () => apiFetch(`${API_BASE_URL}/api/v1/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      }),
      t('users.actions.confirm_role', { username: user.username })
    );
  };

  const handleRevokeSessions = (user: PublicUserDto) => {
    handleAction(
      () => apiFetch(`${API_BASE_URL}/api/v1/admin/users/${user.id}/revoke-sessions`, { method: 'POST' }),
      t('users.actions.confirm_revoke', { username: user.username })
    );
  };

  const getAccessText = (user: PublicUserDto) => {
    const summary = describeAccess(user, roomNames);
    if (summary.kind === 'rooms') return t('users.access.summary_rooms', { rooms: summary.names.join(', ') });
    return t(summary.kind === 'none' ? 'users.access.summary_none' : 'users.access.summary_all');
  };

  const getExpiry = (user: PublicUserDto) => {
    const expiry = describeExpiry(user.expiresAt);
    if (expiry.kind === 'none') return null;
    if (expiry.kind === 'expired') return { text: t('users.access.expired'), expired: true };
    return { text: t('users.access.expires_on', { date: expiry.at.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) }), expired: false };
  };

  if (initialLoading) {
    return <UsersSkeleton label={t('users.loading')} />;
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      {error && <UsersErrorBanner message={error} />}

      {showCreate ? (
        <UserCreateForm
          title={t('users.create_form.title')}
          usernameLabel={t('users.create_form.username')}
          usernamePlaceholder={t('users.create_form.username_placeholder')}
          passwordLabel={t('users.create_form.password')}
          passwordPlaceholder={t('common.password_mask')}
          passwordHint={t('users.create_form.password_hint')}
          roleLabel={t('users.create_form.role')}
          cancelLabel={t('common.cancel')}
          submitLabel={t('users.create_form.submit')}
          roleOptions={roleOptions}
          username={newUsername}
          password={newPassword}
          role={newRole}
          error={createError}
          accessFields={canRestrictAccess(newRole)
            ? <UserAccessFields value={newAccess} rooms={rooms} onChange={setNewAccess} error={createAccessError || undefined} />
            : undefined}
          onUsernameChange={setNewUsername}
          onPasswordChange={setNewPassword}
          onRoleChange={handleNewRoleChange}
          onCancel={resetCreateForm}
          onSubmit={handleCreateUser}
        />
      ) : (
        <UsersHeader
          title={t('users.header.title')}
          subtitle={t('users.header.summary', { count: users.length, active: users.filter(user => user.isActive).length })}
          addLabel={t('users.header.add_button')}
          onAdd={() => setShowCreate(true)}
        />
      )}

      <UsersTable
        users={users}
        labels={{
          identity: t('users.table.identity'),
          access: t('users.table.access'),
          status: t('users.table.status'),
          controls: t('users.table.controls'),
          active: t('users.status.active'),
          suspended: t('users.status.suspended'),
          live: t('users.status.live'),
          moreActions: t('users.actions.more'),
          suspendTitle: t('users.actions.suspend_title'),
          restoreTitle: t('users.actions.restore_title'),
          revokeTitle: t('users.actions.revoke_title'),
          resetPasswordTitle: t('users.actions.reset_password_title'),
          editAccessTitle: t('users.access.edit_title'),
          swapRoleTitle: (role) => t('users.actions.swap_role_title', { role: t(`users.roles.${role}`) })
        }}
        roleOptions={roleOptions.map(({ value, label }) => ({ value, label }))}
        getRoleLabel={(role) => t(`users.roles.${role}`)}
        getRoleDescription={(role) => t(`users.role_descriptions.${role}`)}
        getAccessText={getAccessText}
        getExpiry={getExpiry}
        onToggleActive={handleToggleActive}
        onChangeRole={handleChangeRole}
        onEditAccess={setAccessUser}
        onRevokeSessions={handleRevokeSessions}
        onResetPassword={setPasswordResetUser}
        currentUserId={currentUserId}
      />

      <UsersProtectionNote message={t('users.protection_rule')} />

      <ResetUserPasswordModal
        user={passwordResetUser}
        onClose={() => setPasswordResetUser(null)}
        onSaved={fetchUsers}
      />

      <UserAccessModal
        user={accessUser}
        rooms={rooms}
        onClose={() => setAccessUser(null)}
        onSaved={fetchUsers}
      />

      <ConfirmModal
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={t('users.actions.confirm_title')}
        description={pendingAction?.confirmMessage ?? ''}
        variant="warning"
        isSubmitting={isConfirmingAction}
      />
    </div>
  );
}
