import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
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

export function HomePersonalizationView() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<HomePersonalization>(EMPTY_HOME_PERSONALIZATION);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const textareas = useRef<Partial<Record<(typeof PHRASE_KEYS)[number], HTMLTextAreaElement>>>({});

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(ENDPOINT, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(t('home_personalization.load_error'));
      setSettings(await response.json() as HomePersonalization);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : t('home_personalization.load_error'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [t]);

  useEffect(() => {
    for (const textarea of Object.values(textareas.current)) {
      if (!textarea) continue;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [settings.morningPhrase, settings.afternoonPhrase, settings.nightPhrase]);

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

  const savePhrases = async () => {
    if (PHRASE_KEYS.some((key) => settings[key].length > 100)) {
      setMessage(t('home_personalization.phrase_limit'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const next = await request(ENDPOINT, 'PUT', {
        morningPhrase: settings.morningPhrase,
        afternoonPhrase: settings.afternoonPhrase,
        nightPhrase: settings.nightPhrase,
      });
      setSettings(next);
      setMessage(t('home_personalization.saved'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('home_personalization.save_error'));
    } finally { setBusy(false); }
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) return setMessage(t('home_personalization.invalid_format'));
    if (file.size > MAX_IMAGE_BYTES) return setMessage(t('home_personalization.invalid_size'));
    if (settings.heroImages.length >= 5) return setMessage(t('home_personalization.image_limit'));
    setBusy(true);
    setMessage('');
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await request(`${ENDPOINT}/images`, 'POST', { dataUri });
      setSettings((current) => ({ ...current, heroImages: result.heroImages }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('home_personalization.save_error'));
    } finally { setBusy(false); }
  };

  const deleteImage = async (slot: number) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await request(`${ENDPOINT}/images/${slot}`, 'DELETE');
      setSettings((current) => ({ ...current, heroImages: result.heroImages }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('home_personalization.save_error'));
    } finally { setBusy(false); }
  };

  return <div className="flex w-full max-w-5xl flex-col gap-6 pb-10">
    <SectionHeader level="view" icon={ImagePlus} title={t('home_personalization.title')} />
    {message && <p role="status" className="text-body text-muted-foreground">{message}</p>}
    {loading ? <p className="text-body text-muted-foreground">{t('common.loading')}</p> : <>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <h2 className="text-card-title font-semibold">{t('home_personalization.phrases')}</h2>
        {PHRASE_KEYS.map((key) => <div key={key} className="flex flex-col gap-2">
          <label htmlFor={`home-${key}`} className="text-body font-medium">{t(`home_personalization.${key}`)}</label>
          <Textarea
            id={`home-${key}`}
            ref={(element) => { if (element) textareas.current[key] = element; }}
            value={settings[key]}
            onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))}
            placeholder={t(`home_personalization.${key}Placeholder`)}
            maxLength={100}
            rows={2}
            disabled={busy}
            aria-describedby={`home-${key}-count`}
            className="w-full resize-none overflow-hidden rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span id={`home-${key}-count`} className="self-end text-caption text-muted-foreground">{settings[key].length} / 100</span>
        </div>)}
        <Button onClick={savePhrases} disabled={busy} className="self-start">{t('home_personalization.save')}</Button>
      </Card>
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-card-title font-semibold">{t('home_personalization.images')}</h2>
          <span className="text-caption text-muted-foreground">{settings.heroImages.length} / 5</span>
        </div>
        <p className="text-body text-muted-foreground">{t('home_personalization.image_help')}</p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} className="sr-only" aria-label={t('home_personalization.upload')} />
        <Button onClick={() => fileInput.current?.click()} disabled={busy || settings.heroImages.length >= 5} className="self-start">{t('home_personalization.upload')}</Button>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {settings.heroImages.map(({ slot, url }) => <div key={slot} className="overflow-hidden rounded-xl border border-border bg-background">
            <img src={`${API_BASE_URL}${url}`} alt={t('home_personalization.image_alt', { slot })} className="aspect-video w-full object-cover" />
            <div className="flex items-center justify-between gap-2 p-3">
              <span className="text-caption text-muted-foreground">image_home_{slot}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => void deleteImage(slot)} disabled={busy} aria-label={t('home_personalization.delete_image', { slot })} className="text-danger hover:bg-danger/10"><Trash2 size={18} /></Button>
            </div>
          </div>)}
        </div>
      </Card>
    </>}
  </div>;
}
