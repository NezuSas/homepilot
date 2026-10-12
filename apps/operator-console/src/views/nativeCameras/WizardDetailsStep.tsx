import { useTranslation } from 'react-i18next';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Input } from '../../components/ui/Input';
import { SearchableSelectField } from '../../components/ui/SearchableSelectField';
import type { SnapshotHome } from '../../stores/useDeviceSnapshotStore';
import { isNativeCameraSourceType } from './nativeCameraForm';
import { sourceTypeDefaults } from './types';
import type { NativeCameraWizard } from './useNativeCameraWizard';

export function WizardDetailsStep({ wizard, homes }: { wizard: NativeCameraWizard; homes: SnapshotHome[] }) {
  const { t } = useTranslation();
  const { form, brand } = wizard;
  const isOnvif = form.sourceType === 'onvif-ptz';
  const brandNote = brand && brand !== 'other' ? t(`native_cameras.wizard.brands.${brand}.details_note`) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {wizard.detailsError && <AlertBanner variant="danger" size="sm" className="sm:col-span-2" message={wizard.detailsError} />}
      {brandNote && <AlertBanner variant="info" size="sm" className="sm:col-span-2" message={brandNote} />}

      {wizard.showHomePicker && (
        <SearchableSelectField
          label={t('native_cameras.form.field_home')}
          value={form.homeId}
          onChange={(value) => wizard.changeField({ homeId: value })}
          options={homes.map(home => ({ value: home.id, label: home.name || home.id }))}
          className="sm:col-span-2"
        />
      )}

      <Input
        label={t('native_cameras.form.field_name')}
        value={form.name}
        onChange={(event) => wizard.changeField({ name: event.target.value })}
        placeholder={t('native_cameras.form.field_name_placeholder')}
        containerClassName="sm:col-span-2"
        autoFocus
      />
      <Input
        label={t('native_cameras.wizard.field_address')}
        value={form.host}
        onChange={(event) => wizard.changeField({ host: event.target.value })}
        placeholder={t('native_cameras.form.field_host_placeholder')}
        helperText={t('native_cameras.wizard.field_address_hint')}
        className="font-data"
        autoComplete="off"
        spellCheck={false}
        containerClassName="sm:col-span-2"
      />
      <Input
        label={t('native_cameras.form.field_username')}
        value={form.username}
        onChange={(event) => wizard.changeField({ username: event.target.value })}
        placeholder={t('native_cameras.form.field_username_placeholder')}
        autoComplete="off"
      />
      <Input
        label={t('native_cameras.form.field_password')}
        value={form.password}
        onChange={(event) => wizard.changeField({ password: event.target.value })}
        placeholder={t('native_cameras.form.field_password_placeholder')}
        type="password"
        autoComplete="new-password"
      />
      <p className="text-caption text-muted-foreground sm:col-span-2">{t('native_cameras.wizard.credentials_hint')}</p>

      <details className="rounded-card border border-border/50 p-3 sm:col-span-2">
        <summary className="cursor-pointer text-body-compact font-semibold">{t('native_cameras.wizard.advanced_title')}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SearchableSelectField
            label={t('native_cameras.form.field_source_type')}
            value={form.sourceType}
            onChange={(value) => {
              if (!isNativeCameraSourceType(value)) return;
              const defaults = sourceTypeDefaults[value];
              wizard.changeField({ sourceType: value, onvifPort: defaults.onvifPort, rtspPath: form.rtspPath || defaults.rtspPath });
            }}
            options={(['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'] as const).map(value => ({ value, label: t(`native_cameras.source_types.${value}`) }))}
            helperText={t(`native_cameras.source_type_hints.${form.sourceType}`)}
            className="sm:col-span-2"
          />
          {isOnvif && (
            <Input
              label={t('native_cameras.form.field_onvif_port')}
              value={form.onvifPort}
              onChange={(event) => wizard.changeField({ onvifPort: parseInt(event.target.value, 10) || 8000 })}
              type="number" min="1" max="65535"
              className="font-data"
            />
          )}
          {!isOnvif && (
            <>
              <Input
                label={t('native_cameras.form.field_rtsp_port')}
                value={form.rtspPort}
                onChange={(event) => wizard.changeField({ rtspPort: parseInt(event.target.value, 10) || 554 })}
                type="number" min="1" max="65535"
                helperText={t('native_cameras.form.field_rtsp_port_hint')}
                className="font-data"
              />
              <Input
                label={t('native_cameras.form.field_rtsp_path')}
                value={form.rtspPath}
                onChange={(event) => wizard.changeField({ rtspPath: event.target.value })}
                placeholder={t(`native_cameras.form.field_rtsp_path_placeholders.${form.sourceType}`)}
                helperText={t('native_cameras.wizard.path_hint')}
                className="font-data"
                autoComplete="off"
                spellCheck={false}
              />
            </>
          )}
        </div>
      </details>
    </div>
  );
}
