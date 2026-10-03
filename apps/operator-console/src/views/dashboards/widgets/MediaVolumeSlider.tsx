import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Draft locally while dragging; dispatch only the committed volume. */
export function MediaVolumeSlider({ value, disabled, onCommit }: { value: number | null; disabled: boolean; onCommit: (value: number) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => { setDraft(null); }, [value, disabled]);
  const commit = () => {
    if (!disabled && draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return <input type="range" min={0} max={100} step={1} value={draft ?? value ?? 0}
    aria-label={t('plc.volume')} aria-valuetext={value === null ? t('dashboard.editor.sections.sensor_unavailable') : `${draft ?? value}%`}
    disabled={disabled || value === null}
    className="homepilot-media-volume-track h-11 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-default disabled:opacity-50"
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onChange={event => setDraft(Number(event.target.value))}
    onPointerUp={commit} onPointerCancel={() => setDraft(null)} onKeyUp={commit} onBlur={commit} />;
}
