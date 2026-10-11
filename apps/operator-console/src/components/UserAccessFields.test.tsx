import { renderToStaticMarkup } from 'react-dom/server';
import { UserAccessFields, type UserAccessValue } from './UserAccessFields';
import { UserCreateForm } from './UserCreateForm';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../config', () => ({ API_BASE_URL: '' }));

const noop = () => undefined;
const rooms = [{ id: 'sala', name: 'Sala' }, { id: 'cocina', name: 'Cocina' }];
const base: UserAccessValue = { scope: 'all', roomIds: [], preset: 'never', customDate: '' };
const render = (value: UserAccessValue, roomList = rooms, error?: string) =>
  renderToStaticMarkup(<UserAccessFields value={value} rooms={roomList} onChange={noop} error={error} />);

describe('Feature: choosing how far a child or guest can go', () => {
  it('Scenario: Given the whole home When the fields render Then the rooms list is hidden and the whole-home card is selected', () => {
    const html = render(base);

    expect(html).toContain('users.access.scope_all');
    expect(html).toContain('users.access.scope_rooms');
    expect(html).not.toContain('users.access.rooms_label');
    expect(html).toMatch(/aria-checked="true"[^>]*>(?:(?!aria-checked).)*users\.access\.scope_all/s);
  });

  it('Scenario: Given some rooms When the fields render Then every room has a checkbox and the chosen ones are checked', () => {
    const html = render({ ...base, scope: 'rooms', roomIds: ['sala'] });

    expect(html).toContain('users.access.rooms_label');
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('Sala');
    expect(html).toContain('Cocina');
  });

  it('Scenario: Given some rooms but none chosen When the fields render Then the person is warned they will see nothing', () => {
    expect(render({ ...base, scope: 'rooms', roomIds: [] })).toContain('users.access.none_selected');
    expect(render({ ...base, scope: 'rooms', roomIds: ['sala'] })).not.toContain('users.access.none_selected');
  });

  it('Scenario: Given a home without rooms When some rooms are requested Then an empty message replaces the list', () => {
    const html = render({ ...base, scope: 'rooms' }, []);

    expect(html).toContain('users.access.no_rooms');
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('users.access.none_selected');
  });

  it('Scenario: Given the expiry presets When the fields render Then all five choices are offered and the date field only appears for a custom day', () => {
    const preset = render({ ...base, preset: '7d' });
    for (const key of ['never', '1d', '7d', '30d', 'custom']) expect(preset).toContain(`users.access.expiry_${key}`);
    expect(preset).not.toContain('type="date"');

    const custom = render({ ...base, preset: 'custom', customDate: '2026-10-20' }, rooms, 'users.access.expiry_past');
    expect(custom).toContain('type="date"');
    expect(custom).toContain('value="2026-10-20"');
    expect(custom).toContain('users.access.expiry_past');
  });

  it('Scenario: Given an error outside the date field When the fields render Then it is announced as an alert', () => {
    expect(render(base, rooms, 'users.access.error_save')).toContain('role="alert"');
  });
});

describe('Feature: choosing the kind of person', () => {
  it('Scenario: Given the four roles When the create form renders Then each is a card with its description and only the chosen one is checked', () => {
    const html = renderToStaticMarkup(
      <UserCreateForm
        title="t" usernameLabel="u" usernamePlaceholder="" passwordLabel="p" passwordPlaceholder="" passwordHint="" roleLabel="Tipo"
        cancelLabel="c" submitLabel="s" username="" password="" role="guest" error=""
        roleOptions={[
          { value: 'admin', label: 'Administrador', description: 'Todo' },
          { value: 'parent', label: 'Familiar', description: 'Usa la casa' },
          { value: 'child', label: 'Niño', description: 'Sus habitaciones' },
          { value: 'guest', label: 'Invitado', description: 'Hasta que venza' },
        ]}
        accessFields={<span>access-fields</span>}
        onUsernameChange={noop} onPasswordChange={noop} onRoleChange={noop} onCancel={noop} onSubmit={noop}
      />,
    );

    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    for (const text of ['Administrador', 'Usa la casa', 'Sus habitaciones', 'Hasta que venza']) expect(html).toContain(text);
    expect(html).toContain('access-fields');
    expect(html).toContain('maxLength="40"');
  });
});
