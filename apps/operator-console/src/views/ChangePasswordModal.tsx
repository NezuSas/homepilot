import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AlertBanner } from '../components/ui/AlertBanner';
import { IconButton } from '../components/ui/IconButton';

type PasswordField = 'current' | 'new' | 'confirm';

interface PasswordFieldInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  disabled: boolean;
  error?: string;
  helperText?: string;
}

/** A password box with a button that shows what was typed, so a mistyped password is easy to catch. */
function PasswordFieldInput({ label, value, onChange, autoComplete, disabled, error, helperText }: PasswordFieldInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <Input
      label={label}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      required
      disabled={disabled}
      value={value}
      onChange={event => onChange(event.target.value)}
      error={error}
      helperText={helperText}
      endAdornment={<IconButton type="button" icon={visible ? EyeOff : Eye} label={t(visible ? 'change_password.hide' : 'change_password.show')} aria-pressed={visible} variant="ghost" size="sm" disabled={disabled} onClick={() => setVisible(current => !current)} />}
    />
  );
}

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangePasswordModal({ isOpen, onClose, onSuccess }: ChangePasswordModalProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ field: PasswordField | 'form'; message: string } | null>(null);
  const [successMode, setSuccessMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError({ field: 'confirm', message: t('change_password.error_match') });
      return;
    }

    if (newPassword.length < 8) {
      setError({ field: 'new', message: t('change_password.error_length') });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await apiFetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (!resp.ok) {
        setError({ field: 'current', message: t('change_password.error_failed') });
        return;
      }

      setSuccessMode(true);
      // Wait a moment for UX, then execute full reset
      setTimeout(() => {
        setSuccessMode(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onSuccess();
      }, 1500);

    } catch (error: unknown) {
      setError({ field: 'form', message: error instanceof Error ? error.message : t('change_password.error_generic') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={successMode ? undefined : t('change_password.title')}
        description={successMode ? undefined : t('change_password.subtitle')}
        variant={successMode ? 'success' : 'default'}
        hideCloseButton={loading || successMode}
    >
        {successMode ? (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
                <ShieldCheck aria-hidden="true" className="size-10 text-success" />
                <p role="status" className="whitespace-pre-line text-center font-bold text-success">{t('change_password.success_message')}</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <PasswordFieldInput
                        label={t('change_password.current_password')}
                        autoComplete="current-password"
                        disabled={loading}
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        error={error?.field === 'current' ? error.message : undefined}
                    />
                    <PasswordFieldInput
                        label={t('change_password.new_password')}
                        autoComplete="new-password"
                        disabled={loading}
                        value={newPassword}
                        onChange={setNewPassword}
                        helperText={t('change_password.requirements')}
                        error={error?.field === 'new' ? error.message : undefined}
                    />
                    <PasswordFieldInput
                        label={t('change_password.confirm_password')}
                        autoComplete="new-password"
                        disabled={loading}
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        error={error?.field === 'confirm' ? error.message : undefined}
                    />
                    {error?.field === 'form' && <AlertBanner variant="danger" size="sm" message={error.message} />}
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/40">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={loading}
                    >
                        {t('change_password.submit')}
                    </Button>
                </div>
            </form>
        )}
    </Modal>
  );
}
