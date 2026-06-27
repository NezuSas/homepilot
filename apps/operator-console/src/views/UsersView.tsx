import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { UserCreateForm, type UserRole } from '../components/UserCreateForm';
import { UsersErrorBanner } from '../components/UsersErrorBanner';
import { UsersHeader } from '../components/UsersHeader';
import { UsersLoadingState } from '../components/UsersLoadingState';
import { UsersProtectionNote } from '../components/UsersProtectionNote';
import { UsersTable, type PublicUserDto } from '../components/UsersTable';
import { ResetUserPasswordModal } from '../components/ResetUserPasswordModal';

const ROLE_VALUES: UserRole[] = ['admin', 'parent', 'child', 'guest', 'operator'];

interface UsersViewProps {
  currentUserId: string | null;
}

export function UsersView({ currentUserId }: UsersViewProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<PublicUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('operator');
  const [createError, setCreateError] = useState('');
  const [passwordResetUser, setPasswordResetUser] = useState<PublicUserDto | null>(null);

  const roleOptions = ROLE_VALUES.map(role => ({ value: role, label: t(`users.roles.${role}`) }));

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
  }, []);

  const resetCreateForm = () => {
    setShowCreate(false);
    setNewUsername('');
    setNewPassword('');
    setNewRole('operator');
    setCreateError('');
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (newPassword.length < 8) {
      setCreateError(t('change_password.error_length'));
      return;
    }

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, passwordPlain: newPassword, role: newRole })
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

  const handleAction = async (actionFn: () => Promise<Response>, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    try {
      setError('');
      const res = await actionFn();
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error?.message || (typeof errData.error === 'string' ? errData.error : t('common.errors.operation_failed'));
        throw new Error(msg);
      }
      await fetchUsers();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('common.errors.unknown'));
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

  if (loading && users.length === 0) {
    return <UsersLoadingState label={t('users.loading')} />;
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
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
          onUsernameChange={setNewUsername}
          onPasswordChange={setNewPassword}
          onRoleChange={setNewRole}
          onCancel={resetCreateForm}
          onSubmit={handleCreateUser}
        />
      ) : (
        <UsersHeader
          title={t('users.header.title')}
          subtitle={t('users.header.subtitle')}
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
          suspendTitle: t('users.actions.suspend_title'),
          restoreTitle: t('users.actions.restore_title'),
          revokeTitle: t('users.actions.revoke_title'),
          resetPasswordTitle: t('users.actions.reset_password_title'),
          swapRoleTitle: (role) => t('users.actions.swap_role_title', { role: t(`users.roles.${role}`) })
        }}
        roleOptions={roleOptions}
        getRoleLabel={(role) => t(`users.roles.${role}`)}
        onToggleActive={handleToggleActive}
        onChangeRole={handleChangeRole}
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
    </div>
  );
}
