import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { dashboardBackgroundPresets, getDashboardBackgroundSource } from '../../lib/dashboardBackgroundPresets';
import { Button } from '../ui/Button';
import { Heading } from '../ui/Heading';
import { SurfaceButton } from '../ui/SurfaceButton';
import { RangeInput } from '../ui/RangeInput';
import { compressBackgroundImage } from './compressBackgroundImage';
import { AMBER_RESIDENCE_PRESET_ID } from './useAmberResidenceAvailable';

interface DashboardViewBackgroundTabProps {
  backgroundImg: string | null;
  backgroundOpacity: number;
  amberResidenceAvailable: boolean;
  onBackgroundChange: (value: string | null) => void;
  onOpacityChange: (value: number) => void;
}

export function DashboardViewBackgroundTab({
  backgroundImg,
  backgroundOpacity,
  amberResidenceAvailable,
  onBackgroundChange,
  onOpacityChange,
}: DashboardViewBackgroundTabProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);

  const backgroundPreviewSource = backgroundImg
    ? getDashboardBackgroundSource(backgroundImg, API_BASE_URL)
    : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    compressBackgroundImage(file, onBackgroundChange);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      <div className="min-w-0 rounded-xl bg-muted/35 p-3 text-center sm:p-4">
        {backgroundImg ? (
          <img
            src={backgroundPreviewSource ?? backgroundImg}
            alt="Background Preview"
            className="mx-auto aspect-video w-full max-w-md rounded-lg border border-border/40 object-cover shadow-inner"
          />
        ) : (
          <div className="mx-auto flex aspect-video w-full max-w-md items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-gradient-to-br from-muted via-card to-primary/10 text-caption font-semibold text-muted-foreground/45 opacity-70">
            {t('dashboards.view_config.no_image')}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            {t('dashboards.view_config.upload_image')}
          </Button>
          {backgroundImg && (
            <Button variant="danger" size="sm" onClick={() => onBackgroundChange(null)}>
              {t('dashboards.view_config.clear_image')}
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      <section aria-labelledby="dashboard-background-presets" className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="mb-3">
          <Heading id="dashboard-background-presets" variant="item" as="h3">
            {t('dashboards.view_config.background_presets.title')}
          </Heading>
          <p className="mt-1 text-caption text-muted-foreground">
            {t('dashboards.view_config.background_presets.description')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="list">
          {dashboardBackgroundPresets.filter((preset) => preset.id !== AMBER_RESIDENCE_PRESET_ID || amberResidenceAvailable).map((preset) => {
            const isSelected = backgroundImg === preset.src;
            return (
              <SurfaceButton
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onBackgroundChange(preset.src)}
                className={[
                  'group relative aspect-video h-auto w-full overflow-hidden rounded-control border p-0 shadow-sm',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/45 ring-offset-2 ring-offset-card'
                    : 'border-border/65 hover:border-primary/60',
                ].join(' ')}
              >
                <img src={preset.src} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" />
                <span className="absolute inset-x-0 bottom-0 bg-background/78 px-2 py-1 text-left text-nano font-semibold text-foreground backdrop-blur-sm">
                  {t(preset.labelKey)}
                </span>
                <span className="sr-only">{t(preset.descriptionKey)}</span>
              </SurfaceButton>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4">
        <p className="mb-5 text-body font-semibold">{t('dashboards.view_config.background_settings')}</p>
        <label className="grid gap-3 text-body">
          <span>{t('dashboards.view_config.background_opacity')}</span>
          <div className="flex items-center gap-4">
            <RangeInput
              aria-label={t('dashboards.view_config.background_opacity')}
              min={0}
              max={100}
              value={backgroundOpacity}
              onValueChange={onOpacityChange}
              className="min-w-0 flex-1"
            />
            <span className="w-14 rounded-lg bg-muted px-3 py-2 text-center text-body">{backgroundOpacity}</span>
          </div>
        </label>
      </section>
    </div>
  );
}
