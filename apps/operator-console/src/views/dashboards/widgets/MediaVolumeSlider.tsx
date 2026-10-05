import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RangeInput } from '../../../components/ui/RangeInput';

/** Draft locally while dragging; dispatch only the committed volume. */
export function MediaVolumeSlider({ value, disabled, onCommit }: { value: number | null; disabled: boolean; onCommit: (value: number) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => { setDraft(null); }, [value, disabled]);
  const commit = () => {
    if (!disabled && draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return <RangeInput min={0} max={100} step={1} value={draft ?? value ?? 0}
    aria-label={t('plc.volume')} aria-valuetext={value === null ? t('dashboard.editor.sections.sensor_unavailable') : `${draft ?? value}%`}
    disabled={disabled || value === null}
    className="w-auto flex-1"
    trackClassName="homepilot-media-volume-track h-11 min-w-0 cursor-pointer appearance-auto rounded-none bg-transparent accent-primary disabled:cursor-default disabled:opacity-50"
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onValueChange={setDraft}
    onPointerUp={commit} onPointerCancel={() => setDraft(null)} onKeyUp={commit} onBlur={commit} />;
}
