import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchableSelectField } from '../../../components/ui/SearchableSelectField';
import { NumberInput } from '../../../components/ui/NumberInput';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { normalizeSensorVisualStyle, sensorVisualStyles, type CardDraft } from './sectionCardCatalog';

interface SectionCardSensorFieldsProps {
  cardDraft: CardDraft;
  setCardDraft: Dispatch<SetStateAction<CardDraft>>;
  invalidScale: boolean;
  onMinimumValidityChange: (valid: boolean) => void;
  onMaximumValidityChange: (valid: boolean) => void;
}

/** Visualization, decimals and fixed-scale settings for sensor cards. */
export function SectionCardSensorFields({
  cardDraft, setCardDraft, invalidScale, onMinimumValidityChange, onMaximumValidityChange,
}: SectionCardSensorFieldsProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-2">
      <legend className="text-caption font-semibold text-foreground">{t('dashboard.editor.sections.sensor_scale_settings')}</legend>
      <SearchableSelectField label={t('dashboard.editor.sections.sensor_visualization')} value={cardDraft.visualStyle ?? 'gauge'}
        options={sensorVisualStyles.map(value => ({ value, label: t(`dashboard.editor.sections.sensor_visual_${value}`) }))}
        onChange={value => setCardDraft(draft => ({ ...draft, visualStyle: normalizeSensorVisualStyle(value) }))} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-compact">{t('dashboard.editor.sections.sensor_decimals')}</span>
        <ToggleSwitch label={t('dashboard.editor.sections.sensor_decimals')} checked={cardDraft.sensorDecimals === true} onCheckedChange={sensorDecimals => setCardDraft(draft => ({ ...draft, sensorDecimals }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label={t('dashboard.editor.sections.sensor_min')} required={false} step="any" value={cardDraft.sensorMin}
          onValidityChange={onMinimumValidityChange}
          onValueChange={sensorMin => setCardDraft(draft => ({ ...draft, sensorMin }))} onEmpty={() => setCardDraft(draft => ({ ...draft, sensorMin: undefined }))} />
        <NumberInput label={t('dashboard.editor.sections.sensor_max')} required={false} step="any" value={cardDraft.sensorMax}
          onValidityChange={onMaximumValidityChange}
          onValueChange={sensorMax => setCardDraft(draft => ({ ...draft, sensorMax }))} onEmpty={() => setCardDraft(draft => ({ ...draft, sensorMax: undefined }))} />
      </div>
      <p role={invalidScale ? 'alert' : undefined} className="text-caption text-muted-foreground">{t(invalidScale ? 'dashboard.editor.sections.sensor_scale_invalid' : 'dashboard.editor.sections.sensor_scale_hint')}</p>
    </fieldset>
  );
}
