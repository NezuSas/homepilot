import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { AlertBanner } from './ui/AlertBanner';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { DirectorySsoLinksSection } from './DirectorySsoLinksSection';
import { AvatarCropper } from './userProfile/AvatarCropper';
import { useAvatarCropper } from './userProfile/useAvatarCropper';

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarDataUri: string | null;
  role: string;
}

interface UserProfileModalProps {
  user: { id: string; username: string; role: string };
  onClose: () => void;
  /** Called after a successful save so the parent can refresh the session context. */
  onSaved: (profile: { displayName: string | null; avatarDataUri: string | null }) => void;
}

export function UserProfileModal({ user, onClose, onSaved }: UserProfileModalProps) {
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cropper = useAvatarCropper(avatarPreview);

  // Load current profile on mount
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const res = await apiFetch(`${API_BASE_URL}/api/v1/auth/me`);
        if (!res.ok || !isMounted) return;
        const data: UserProfile = await res.json();
        setDisplayName(data.displayName || '');
        setAvatarPreview(data.avatarDataUri || null);
      } catch {
        // silently fail
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProfile();
    return () => { isMounted = false; };
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const finalDataUri = cropper.rawImage ? cropper.getCroppedDataUri() : avatarPreview;

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarDataUri: finalDataUri,
        }),
      });
      if (!res.ok) throw new Error(t('common.errors.operation_failed'));
      const updatedProfile = await res.json() as UserProfile;

      const raw = localStorage.getItem('hp_user_ctx');
      if (raw) {
        const ctx = JSON.parse(raw);
        ctx.displayName = updatedProfile.displayName;
        ctx.avatarDataUri = updatedProfile.avatarDataUri;
        localStorage.setItem('hp_user_ctx', JSON.stringify(ctx));
      }

      onSaved({ displayName: updatedProfile.displayName, avatarDataUri: updatedProfile.avatarDataUri });
      onClose();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('common.errors.operation_failed'));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = t(`users.roles.${user.role}`);

  return (
    <Modal
      isOpen
      onClose={saving ? undefined : onClose}
      title={t('users.profile.title')}
      description={roleLabel}
      headerAlign="start"
      headerClassName="pb-4"
      className="max-w-md"
      layerClassName="z-[200]"
      hideCloseButton={saving}
      footer={(
        <div className="grid w-full grid-cols-1 gap-3 p-5 min-[380px]:grid-cols-2 sm:p-6">
          <Button
            disabled={saving}
            onClick={onClose}
            variant="secondary"
            className="w-full"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            isLoading={saving}
            className="w-full"
          >
            {!saving && <Check className="h-4 w-4" />}
            {t('common.save')}
          </Button>
        </div>
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center p-7 sm:p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <AvatarCropper
            cropper={cropper}
            avatarPreview={avatarPreview}
            username={user?.username}
            onPreviewError={() => setAvatarPreview(null)}
          />

          <Input
            label={t('users.profile.display_name')}
            type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder={user.username} maxLength={40}
          />

          <DirectorySsoLinksSection />
          {error && <AlertBanner variant="danger" size="sm" message={error} />}
        </div>
      )}
    </Modal>
  );
}
