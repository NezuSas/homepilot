import { useTranslation } from 'react-i18next';
import { DateField } from './ui/DateField';
import { SegmentedControl } from './ui/SegmentedControl';
import { SelectableOptionCard } from './ui/SelectableOptionCard';
import { EXPIRY_PRESETS, toDateFieldValue, type AccessScope, type ExpiryPreset } from '../lib/userAccess';

export interface AccessRoom {
  id: string;
  name: string;
}

export interface UserAccessValue {
  scope: AccessScope;
  roomIds: string[];
  preset: ExpiryPreset;
  customDate: string;
}

interface UserAccessFieldsProps {
  value: UserAccessValue;
  rooms: AccessRoom[];
  onChange: (next: UserAccessValue) => void;
  error?: string;
}

const tomorrow = () => toDateFieldValue(new Date(Date.now() + 24 * 60 * 60 * 1000));

/** Which rooms a child or guest can use and when the account ends, in plain words for the homeowner. */
export function UserAccessFields({ value, rooms, onChange, error }: UserAccessFieldsProps) {
  const { t } = useTranslation();
  const toggleRoom = (roomId: string, checked: boolean) => onChange({
    ...value,
    roomIds: checked ? [...value.roomIds, roomId] : value.roomIds.filter((id) => id !== roomId),
  });

  return (
    <fieldset className="min-w-0 space-y-5">
      <legend className="text-body font-semibold">{t('users.access.title')}</legend>

      <div role="radiogroup" aria-label={t('users.access.scope_label')} className="grid gap-2 sm:grid-cols-2">
        <SelectableOptionCard
          title={t('users.access.scope_all')}
          description={t('users.access.scope_all_desc')}
          checked={value.scope === 'all'}
          onClick={() => onChange({ ...value, scope: 'all' })}
        />
        <SelectableOptionCard
          title={t('users.access.scope_rooms')}
          description={t('users.access.scope_rooms_desc')}
          checked={value.scope === 'rooms'}
          onClick={() => onChange({ ...value, scope: 'rooms' })}
        />
      </div>

      {value.scope === 'rooms' && (
        <div className="space-y-2">
          <p className="text-body-compact font-medium">{t('users.access.rooms_label')}</p>
          {rooms.length === 0 ? (
            <p className="text-caption text-muted-foreground">{t('users.access.no_rooms')}</p>
          ) : (
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {rooms.map((room) => (
                <label key={room.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-body-compact hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={value.roomIds.includes(room.id)}
                    onChange={(event) => toggleRoom(room.id, event.target.checked)}
                    className="size-5 shrink-0 accent-primary"
                  />
                  <span className="break-words">{room.name}</span>
                </label>
              ))}
            </div>
          )}
          {value.roomIds.length === 0 && rooms.length > 0 && (
            <p role="status" className="text-caption text-warning">{t('users.access.none_selected')}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-body-compact font-medium">{t('users.access.expiry_label')}</p>
        <SegmentedControl<ExpiryPreset>
          label={t('users.access.expiry_label')}
          value={value.preset}
          options={EXPIRY_PRESETS.map((preset) => ({ value: preset, label: t(`users.access.expiry_${preset}`) }))}
          onChange={(preset) => onChange({ ...value, preset })}
        />
        {value.preset === 'custom' && (
          <DateField
            label={t('users.access.expiry_date')}
            placeholderLabel={t('users.access.expiry_date_placeholder')}
            value={value.customDate}
            min={tomorrow()}
            onChange={(event) => onChange({ ...value, customDate: event.target.value })}
            error={error}
          />
        )}
      </div>

      {error && value.preset !== 'custom' && <p role="alert" className="text-caption text-danger">{error}</p>}
    </fieldset>
  );
}
