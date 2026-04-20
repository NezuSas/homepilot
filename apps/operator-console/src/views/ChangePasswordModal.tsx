import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

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
  const [error, setError] = useState<string | null>(null);
  const [successMode, setSuccessMode] = useState(false);

  // No renderizar hooks extra, controlamos el isOpen en el Modal
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('change_password.error_match'));
      return;
    }
    
    if (newPassword.length < 8) {
      setError(t('change_password.error_length'));
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
        throw new Error(t('change_password.error_failed'));
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

    } catch (e: any) {
      setError(e.message || t('change_password.error_generic'));
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
            <div className="flex flex-col items-center justify-center space-y-3 py-4">
                <p className="font-bold text-center text-success" dangerouslySetInnerHTML={{ __html: t('change_password.success_message').replace('\n', '<br/>') }} />
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-4">
                    <Input 
                        label={t('change_password.current_password')}
                        type="password"
                        required
                        disabled={loading}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        error={error ? ' ' : undefined} // Trigger error styling globally if there's any error
                    />
                    <Input 
                        label={t('change_password.new_password')}
                        type="password"
                        required
                        disabled={loading}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        error={error ? ' ' : undefined}
                    />
                    <Input 
                        label={t('change_password.confirm_password')}
                        type="password"
                        required
                        disabled={loading}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        error={error || undefined} // Only show the actual error text on the last input
                    />
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
                        {t('common.confirm')}
                    </Button>
                </div>
            </form>
        )}
    </Modal>
  );
}
