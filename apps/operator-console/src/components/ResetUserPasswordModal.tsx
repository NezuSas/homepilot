import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import type { PublicUserDto } from './UsersTable';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface ResetUserPasswordModalProps {
  user: PublicUserDto | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function ResetUserPasswordModal({ user, onClose, onSaved }: ResetUserPasswordModalProps) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (newPassword.length < 8) {
      setError(t('change_password.error_length'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('change_password.error_match'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/admin/users/${encodeURIComponent(user.id)}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message || t('users.password_reset.error'));
      }

      await onSaved();
      onClose();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('users.password_reset.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(user)}
      onClose={saving ? undefined : onClose}
      title={t('users.password_reset.title', { username: user?.displayName || user?.username || '' })}
      description={t('users.password_reset.description')}
      hideCloseButton={saving}
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <Input
          autoComplete="new-password"
          icon={<KeyRound className="h-4 w-4" />}
          label={t('change_password.new_password')}
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <Input
          autoComplete="new-password"
          icon={<KeyRound className="h-4 w-4" />}
          label={t('change_password.confirm_password')}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={error || undefined}
        />
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={saving}>
            {t('users.password_reset.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
