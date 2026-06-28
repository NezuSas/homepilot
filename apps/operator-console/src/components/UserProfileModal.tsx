import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, Check, Loader2, UserCircle2, ZoomIn, Move } from 'lucide-react';
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

export function UserProfileModal({ user, onClose, onSaved }: UserProfileModalProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cropping state
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setRawImage(img);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!rawImage) return;
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setLastPos({ x: clientX, y: clientY });
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !rawImage) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - lastPos.x;
    const dy = clientY - lastPos.y;
    
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: clientX, y: clientY });
  }, [isDragging, lastPos, rawImage]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const getCroppedDataUri = (): string | null => {
    if (!rawImage || !containerRef.current) return avatarPreview;
    
    const canvas = document.createElement('canvas');
    canvas.width = MAX_AVATAR_PX;
    canvas.height = MAX_AVATAR_PX;
    const ctx = canvas.getContext('2d')!;
    
    // Calculate final dimensions
    const displaySize = 256; // logical size in UI
    const scale = rawImage.width / rawImage.height > 1 
      ? displaySize / rawImage.height 
      : displaySize / rawImage.width;
      
    const finalScale = scale * zoom;
    const renderW = rawImage.width * finalScale;
    const renderH = rawImage.height * finalScale;
    
    // Apply center + offset
    const centerX = (MAX_AVATAR_PX - renderW) / 2 + (offset.x * (MAX_AVATAR_PX / displaySize));
    const centerY = (MAX_AVATAR_PX - renderH) / 2 + (offset.y * (MAX_AVATAR_PX / displaySize));
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, MAX_AVATAR_PX, MAX_AVATAR_PX);
    ctx.drawImage(rawImage, centerX, centerY, renderW, renderH);
    
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const finalDataUri = rawImage ? getCroppedDataUri() : avatarPreview;
    
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

  const roleLabel = user.role === 'admin'
    ? t('users.roles.admin', 'Administrador (Padre)')
    : t('users.roles.operator', 'Estándar (Hijo)');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border/60 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 flex items-center justify-between border-b border-border/40 bg-muted/30">
          <div>
            <h3 className="font-black tracking-tight">{t('users.profile.title', 'Mi Perfil')}</h3>
            <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mt-0.5">{roleLabel}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-muted/60 rounded-xl hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="p-6 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div 
                className="relative w-56 h-56 touch-none"
              >
                {/* Visual Image Container (with overflow hidden) */}
                <div 
                  ref={containerRef}
                  className="absolute inset-0 rounded-full bg-muted border-4 border-border shadow-inner overflow-hidden cursor-move"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleMouseDown}
                >
                  {!rawImage && !avatarPreview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 bg-primary/5">
                      <span className="font-black text-4xl uppercase tracking-tighter opacity-20">
                        {(user?.username || '?').substring(0, 2)}
                      </span>
                      <UserCircle2 className="w-12 h-12 absolute opacity-10" />
                    </div>
                  )}
                  
                  {rawImage ? (
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ pointerEvents: 'none' }}
                    >
                      <img 
                        src={rawImage.src} 
                        alt="Crop target" 
                        draggable={false}
                        className="max-w-none transition-transform duration-75 ease-out"
                        style={{ 
                          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                          height: rawImage.width / rawImage.height > 1 ? '100%' : 'auto',
                          width: rawImage.width / rawImage.height > 1 ? 'auto' : '100%'
                        }}
                      />
                    </div>
                  ) : avatarPreview ? (
                    <img 
                      src={avatarPreview.startsWith('/') ? `${API_BASE_URL}${avatarPreview}` : avatarPreview} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                         // If image fails to load, clear preview to show fallback
                         (e.target as any).style.display = 'none';
                         setAvatarPreview(null);
                      }}
                    />
                  ) : null}

                  {/* Circular overlay border (Internal) */}
                  <div className="absolute inset-0 pointer-events-none border-[12px] border-background/20 rounded-full box-border" />
                </div>
                
                {/* Camera Button (Clearly outside the clipping radius of the square corners) */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-1 right-1 p-3.5 bg-primary text-primary-foreground rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all z-30 border-4 border-card"
                  title={t('users.profile.change_avatar')}
                >
                  <Camera className="w-5 h-5 shadow-sm" />
                </button>
              </div>

              {rawImage && (
                <div className="w-full flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
                    <div className="flex items-center gap-2"><ZoomIn className="w-3 h-3" /> {t('users.profile.zoom', 'Zoom')}</div>
                    <div className="flex items-center gap-2"><Move className="w-3 h-3" /> {t('users.profile.adjust', 'Arrastra para ajustar')}</div>
                  </div>
                  <input 
                    type="range" min="1" max="3" step="0.01" 
                    value={zoom} onChange={e => setZoom(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              )}

              <p className="text-[11px] text-muted-foreground text-center max-w-[200px]">
                {rawImage ? t('users.profile.crop_hint', 'Ajusta el zoom y arrastra la foto para encuadrar tu cara.') : t('users.profile.avatar_hint', 'Haz clic en la cámara para subir una foto nueva.')}
              </p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('users.profile.display_name', 'Nombre a Mostrar')}</label>
              <input
                type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder={user.username} maxLength={40}
                className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-inner"
              />
            </div>

            {error && <p className="text-sm text-destructive font-bold text-center bg-destructive/5 py-2 rounded-xl border border-destructive/10">{error}</p>}
          </div>
        )}

        <div className="px-6 py-5 border-t border-border/40 bg-muted/20 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-black uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80 rounded-2xl border border-border transition-all">{t('common.cancel', 'Cancelar')}</button>
          <button
            onClick={handleSave} disabled={saving || loading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl shadow-lg shadow-primary/20 transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {t('common.save', 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
