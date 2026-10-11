import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { describeExpiry, resolveExpiry, toDateFieldValue, type ExpiryPreset } from '../lib/userAccess';
import type { PublicUserDto } from './UsersTable';
import { UserAccessFields, type AccessRoom, type UserAccessValue } from './UserAccessFields';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

interface UserAccessModalProps {
  user: PublicUserDto | null;
  rooms: AccessRoom[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Starting values for the form: an account that already expires keeps its date as a custom day. */
function initialValue(user: PublicUserDto): UserAccessValue {
  const expiry = describeExpiry(user.expiresAt);
  const preset: ExpiryPreset = expiry.kind === 'none' ? 'never' : 'custom';
  return {
    scope: user.accessScope === 'rooms' ? 'rooms' : 'all',
    roomIds: user.roomIds ?? [],
    preset,
    customDate: expiry.kind === 'none' ? '' : toDateFieldValue(expiry.at),
  };
}

export function UserAccessModal({ user, rooms, onClose, onSaved }: UserAccessModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState<UserAccessValue | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(user ? initialValue(user) : null);
    setError('');
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !value) return;
    const expiresAt = resolveExpiry(value.preset, value.customDate);
    if (expiresAt === undefined) {
      setError(t('users.access.expiry_past'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/admin/users/${encodeURIComponent(user.id)}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessScope: value.scope, roomIds: value.scope === 'rooms' ? value.roomIds : [], expiresAt }),
      });
      if (!response.ok) throw new Error(t('users.access.error_save'));
      await onSaved();
      onClose();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('users.access.error_save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(user)}
      onClose={saving ? undefined : onClose}
      title={t('users.access.modal_title', { username: user?.displayName || user?.username || '' })}
      description={t('users.access.modal_description')}
      hideCloseButton={saving}
    >
      {value && (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <UserAccessFields value={value} rooms={rooms} onChange={setValue} error={error || undefined} />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
            <Button type="submit" isLoading={saving}>{t('users.access.save')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
