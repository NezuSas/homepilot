import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, Check, Loader2, UserCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

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

const MAX_AVATAR_PX = 256;

/** Resize an image File to a small square data URI (JPEG) for storage. */
async function resizeToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height, MAX_AVATAR_PX);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // Center-crop
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function UserProfileModal({ user, onClose, onSaved }: UserProfileModalProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load current profile on mount
  const loadProfile = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/auth/me`);
      if (!res.ok) return;
      const data: UserProfile = await res.json();
      setDisplayName(data.displayName || '');
      setAvatarPreview(data.avatarDataUri || null);
    } catch {
      // silently fail — display blank form
    } finally {
      setLoading(false);
    }
  }, []);

  // Run on first render via useRef trick to avoid useEffect dependency warnings
  const hasLoaded = useRef(false);
  if (!hasLoaded.current) {
    hasLoaded.current = true;
    loadProfile();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uri = await resizeToDataUri(file);
      setAvatarPreview(uri);
    } catch {
      setError(t('users.profile.avatar_error', 'No se pudo procesar la imagen'));
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarDataUri: avatarPreview,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || t('common.errors.operation_failed'));
      }
      // Update localStorage session context so sidebar refreshes
      try {
        const raw = localStorage.getItem('hp_user_ctx');
        if (raw) {
          const ctx = JSON.parse(raw);
          ctx.displayName = displayName.trim() || null;
          ctx.avatarDataUri = avatarPreview;
          localStorage.setItem('hp_user_ctx', JSON.stringify(ctx));
        }
      } catch { /* ignore */ }
      onSaved({ displayName: displayName.trim() || null, avatarDataUri: avatarPreview });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = user.role === 'admin'
    ? t('users.roles.admin', 'Administrador (Padre)')
    : t('users.roles.operator', 'Estándar (Hijo)');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-border/40 bg-muted/30">
          <div>
            <h3 className="font-black tracking-tight">{t('users.profile.title', 'Mi Perfil')}</h3>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">
              {roleLabel}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-muted/60 rounded-xl hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative w-24 h-24 rounded-full bg-muted border-2 border-border hover:border-primary/60 transition-all group overflow-hidden"
                title={t('users.profile.change_avatar', 'Cambiar Foto')}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  : <UserCircle2 className="w-12 h-12 text-muted-foreground/40" />
                }
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                {t('users.profile.avatar_hint', 'Haz clic en la foto para cambiarla. Se guarda localmente.')}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('users.profile.display_name', 'Nombre a Mostrar')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={user.username}
                maxLength={40}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
              <p className="text-[10px] text-muted-foreground">
                {t('users.profile.display_name_hint', 'Si lo dejas vacío se mostrará tu nombre de usuario.')}
              </p>
            </div>

            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 px-4 py-3 bg-muted/40 rounded-xl border border-border/40">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t('users.profile.username_label', 'Usuario')}
                </span>
                <span className="text-sm font-semibold">@{user.username}</span>
              </div>
              <div className="flex flex-col gap-1 px-4 py-3 bg-muted/40 rounded-xl border border-border/40">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t('users.profile.role_label', 'Rol')}
                </span>
                <span className="text-sm font-semibold">{roleLabel}</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded-xl border transition-colors"
          >
            {t('common.cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Check className="w-4 h-4" />
            }
            {t('common.save', 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
