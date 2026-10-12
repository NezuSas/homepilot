import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Heading } from '../../components/ui/Heading';
import { Input } from '../../components/ui/Input';
import { SurfaceButton } from '../../components/ui/SurfaceButton';
import { NativeCameraDiscoverySkeleton } from '../../components/ui/ComponentSkeletons';
import { CAMERA_BRAND_PRESETS } from './cameraBrandPresets';
import type { NativeCameraWizard } from './useNativeCameraWizard';

const tile = 'relative h-auto min-h-12 w-full justify-start rounded-card border border-border/50 bg-card p-3 text-left shadow-sm whitespace-normal hover:border-primary/30 hover:bg-muted/30';

export function WizardChooseStep({ wizard }: { wizard: NativeCameraWizard }) {
  const { t } = useTranslation();
  if (wizard.isDiscovering) return <NativeCameraDiscoverySkeleton label={t('native_cameras.wizard.searching')} />;

  return (
    <div className="space-y-5">
      {wizard.discovered.length > 0 && (
        <section aria-labelledby="camera-wizard-found" className="space-y-2">
          <Heading variant="item" id="camera-wizard-found">{t('native_cameras.wizard.found_title')}</Heading>
          <div className="grid gap-2 sm:grid-cols-2">
            {wizard.discovered.map(camera => {
              const added = wizard.isAdded(camera);
              return (
                <SurfaceButton key={camera.urn} className={tile} disabled={added} onClick={() => wizard.chooseDiscovered(camera)}>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                    <span className="break-words text-body font-semibold leading-snug">{camera.name}</span>
                    <span className="font-data text-body-compact font-normal text-muted-foreground">{camera.host}</span>
                  </span>
                  {added && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-caption font-semibold text-success">
                      <Check aria-hidden="true" className="h-4 w-4" />{t('native_cameras.wizard.already_added')}
                    </span>
                  )}
                </SurfaceButton>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="camera-wizard-brand" className="space-y-2">
        <Heading variant="item" id="camera-wizard-brand">{t('native_cameras.wizard.brand_title')}</Heading>
        <p className="text-body-compact text-muted-foreground">{t('native_cameras.wizard.brand_hint')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CAMERA_BRAND_PRESETS.map(preset => (
            <SurfaceButton key={preset.id} className={tile} onClick={() => wizard.chooseBrand(preset.id)}>
              <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                <span className="break-words text-body font-semibold leading-snug">{t(`native_cameras.wizard.brands.${preset.id}.name`)}</span>
                <span className="text-body-compact font-normal text-muted-foreground">{t(`native_cameras.wizard.brands.${preset.id}.note`)}</span>
              </span>
            </SurfaceButton>
          ))}
        </div>
      </section>

      <form
        aria-labelledby="camera-wizard-paste"
        className="space-y-2 border-t border-border/40 pt-4"
        onSubmit={(event) => { event.preventDefault(); wizard.submitPaste(); }}
      >
        <Heading variant="item" id="camera-wizard-paste">{t('native_cameras.wizard.paste_title')}</Heading>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Input
            aria-labelledby="camera-wizard-paste"
            value={wizard.pasteText}
            onChange={(event) => wizard.setPasteText(event.target.value)}
            placeholder="rtsp://usuario:contraseña@192.168.1.50:554/ruta"
            helperText={wizard.pasteInvalid ? undefined : t('native_cameras.wizard.paste_hint')}
            error={wizard.pasteInvalid ? t('native_cameras.wizard.paste_invalid') : undefined}
            autoComplete="off"
            spellCheck={false}
            className="font-data"
          />
          <Button type="submit" variant="secondary" disabled={!wizard.pasteText.trim()}>{t('native_cameras.wizard.paste_use')}</Button>
        </div>
      </form>
    </div>
  );
}
