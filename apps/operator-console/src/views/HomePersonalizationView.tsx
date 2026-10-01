import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { HomeHeroImageSkeleton, HomePersonalizationSkeleton } from '../components/ui/ComponentSkeletons';
import ConfirmModal from '../components/ConfirmModal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Card } from '../components/ui/Card';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Textarea } from '../components/ui/Textarea';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { EMPTY_HOME_PERSONALIZATION, type HomePersonalization } from '../lib/homePersonalization';

const ENDPOINT = `${API_BASE_URL}/api/v1/settings/home-personalization`;
const PHRASE_KEYS = ['morningPhrase', 'afternoonPhrase', 'nightPhrase'] as const;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function HeroImageThumbnail({ url, slot }: { url: string; slot: number }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return <div className="relative aspect-video w-full bg-muted/20">
    {state === 'loading' && <div aria-hidden="true" className="absolute inset-0"><HomeHeroImageSkeleton /></div>}
    {state === 'error' ? <p className="flex h-full items-center justify-center p-2 text-center text-caption text-muted-foreground">{t('home_personalization.image_unavailable')}</p>
      : <img src={`${API_BASE_URL}${url}`} alt={t('home_personalization.image_alt', { slot })} onLoad={() => setState('ready')} onError={() => setState('error')} className="h-full w-full object-cover" />}
  </div>;
}

export function HomePersonalizationView() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<HomePersonalization>(EMPTY_HOME_PERSONALIZATION);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<'idle' | 'saving' | 'uploading' | 'deleting'>('idle');
  const operationRef = useRef(false);
  const [feedback, setFeedback] = useState<{ message: string; variant: 'success' | 'danger' } | null>(null);
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(ENDPOINT, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(t('home_personalization.load_error'));
      setSettings(await response.json() as HomePersonalization);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setFeedback({ message: error instanceof Error ? error.message : t('home_personalization.load_error'), variant: 'danger' });
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [t]);


  const request = async (url: string, method: string, body?: unknown): Promise<HomePersonalization> => {
    const response = await apiFetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json() as HomePersonalization & { error?: { message?: string } };
    if (!response.ok) throw new Error(result.error?.message || t('home_personalization.save_error'));
    return result;
  };

  const beginOperation = (next: 'saving' | 'uploading' | 'deleting'): boolean => {
    if (operationRef.current) return false;
    operationRef.current = true;
    setOperation(next);
    setFeedback(null);
    return true;
  };
  const finishOperation = () => {
    operationRef.current = false;
    setOperation('idle');
  };
  const showError = (error: unknown) => setFeedback({ message: error instanceof Error ? error.message : t('home_personalization.save_error'), variant: 'danger' });

  const savePhrases = async () => {
    if (operationRef.current) return;
    if (PHRASE_KEYS.some((key) => settings[key].length > 1000)) {
      setFeedback({ message: t('home_personalization.phrase_limit'), variant: 'danger' });
      return;
    }
    if (!beginOperation('saving')) return;
    try {
      const next = await request(ENDPOINT, 'PUT', {
        morningPhrase: settings.morningPhrase,
        afternoonPhrase: settings.afternoonPhrase,
        nightPhrase: settings.nightPhrase,
      });
      setSettings(next);
      setFeedback({ message: t('home_personalization.saved'), variant: 'success' });
    } catch (error) {
      showError(error);
    } finally { finishOperation(); }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (operationRef.current) return;
    if (!IMAGE_TYPES.has(file.type)) return setFeedback({ message: t('home_personalization.invalid_format'), variant: 'danger' });
    if (file.size > MAX_IMAGE_BYTES) return setFeedback({ message: t('home_personalization.invalid_size'), variant: 'danger' });
    if (settings.heroImages.length >= 5) return setFeedback({ message: t('home_personalization.image_limit'), variant: 'danger' });
    if (!beginOperation('uploading')) return;
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await request(`${ENDPOINT}/images`, 'POST', { dataUri });
      setSettings((current) => ({ ...current, heroImages: result.heroImages }));
      setFeedback({ message: t('home_personalization.uploaded'), variant: 'success' });
    } catch (error) {
      showError(error);
    } finally { finishOperation(); }
  };

  const deleteImage = async (slot: number) => {
    if (!beginOperation('deleting')) return;
    try {
      const result = await request(`${ENDPOINT}/images/${slot}`, 'DELETE');
      setSettings((current) => ({ ...current, heroImages: result.heroImages }));
      setConfirmSlot(null);
      setFeedback({ message: t('home_personalization.deleted'), variant: 'success' });
    } catch (error) {
      setConfirmSlot(null);
      showError(error);
    } finally { finishOperation(); }
  };

  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
    <SectionHeader level="view" icon={ImagePlus} title={t('home_personalization.title')} />
    {feedback && <AlertBanner variant={feedback.variant} message={feedback.message} />}
    {loading ? <HomePersonalizationSkeleton label={t('common.loading')} /> : <>
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="text-card-title font-semibold">{t('home_personalization.phrases')}</h2>
        <div className="grid gap-3 md:grid-cols-3">{PHRASE_KEYS.map((key) => <div key={key} className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-1"><label htmlFor={`home-${key}`} className="text-body-compact font-medium">{t(`home_personalization.${key}`)}</label>
          <span id={`home-${key}-count`} className="text-caption text-muted-foreground">{settings[key].length} / 1000</span></div>
          <Textarea
            id={`home-${key}`}
            value={settings[key]}
            onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
            placeholder={t(`home_personalization.${key}Placeholder`)}
            maxLength={1000}
            rows={4}
            disabled={operation !== 'idle'}
            aria-describedby={`home-${key}-count`}
            className="max-h-40 min-h-28 w-full resize-y overflow-y-auto text-body-compact"
          />
        </div>)}</div>
        <Button onClick={() => void savePhrases()} disabled={operation !== 'idle'} isLoading={operation === 'saving'} className="self-start">{t(operation === 'saving' ? 'home_personalization.saving' : 'home_personalization.save')}</Button>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-card-title font-semibold">{t('home_personalization.images')}</h2>
          <span className="text-caption text-muted-foreground">{settings.heroImages.length} / 5</span>
        </div>
        <p className="text-caption text-muted-foreground">{t('home_personalization.image_help')}</p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="sr-only" aria-label={t('home_personalization.upload')} />
        <Button onClick={() => fileInput.current?.click()} disabled={operation !== 'idle' || settings.heroImages.length >= 5} isLoading={operation === 'uploading'} className="self-start">{t(operation === 'uploading' ? 'home_personalization.uploading' : 'home_personalization.upload')}</Button>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {settings.heroImages.map(({ slot, url }) => <div key={url} className="min-w-0 overflow-hidden rounded-xl border border-border bg-background">
            <HeroImageThumbnail url={url} slot={slot} />
            <div className="flex flex-wrap items-center justify-between gap-1 p-2">
              <span className="text-caption font-medium">{t('home_personalization.image_label', { slot })}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => setConfirmSlot(slot)} disabled={operation !== 'idle'} aria-label={t('home_personalization.delete_image', { slot })} className="text-danger hover:bg-danger/10"><Trash2 size={18} /></Button>
            </div>
          </div>)}
        </div>
      </Card>
    </>}
    <ConfirmModal isOpen={confirmSlot !== null} onClose={() => setConfirmSlot(null)} onConfirm={() => { if (confirmSlot !== null) void deleteImage(confirmSlot); }} isSubmitting={operation === 'deleting'} title={t('home_personalization.confirm_delete_title')} description={t('home_personalization.confirm_delete_description')} confirmText={operation === 'deleting' ? t('home_personalization.deleting') : t('common.delete')} variant="danger" />
  </div>;
}
