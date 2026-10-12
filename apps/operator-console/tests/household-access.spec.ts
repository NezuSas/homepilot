import { expect, test } from '@playwright/test';
import { dashboardUser, prepareAuthenticatedDashboard } from './helpers/responsiveShell';

const DAY_MS = 24 * 60 * 60 * 1000;
const rooms = [
  { id: 'sala', homeId: 'responsive-home', name: 'Sala' },
  { id: 'cocina', homeId: 'responsive-home', name: 'Cocina' },
  { id: 'garage', homeId: 'responsive-home', name: 'Garage' },
];

for (const viewport of [
  { name: 'mobile portrait', width: 320, height: 720 },
  { name: 'tablet portrait', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`Feature: Household access — Scenario: An administrator limits a guest to some rooms and sets when it ends at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepareAuthenticatedDashboard(page);
    await page.route('**/api/v1/rooms', route => route.fulfill({ json: rooms }));
    const guest = {
      id: 'guest-1', username: 'visita', displayName: 'Visita', avatarDataUri: null, role: 'guest', isActive: true, hasActiveSessions: false,
      accessScope: 'rooms', roomIds: ['sala'], expiresAt: new Date(Date.now() + 5 * DAY_MS).toISOString(), createdAt: '', updatedAt: '',
    };
    const legacy = { ...guest, id: 'fam-1', username: 'mama', displayName: 'Mamá', role: 'parent', accessScope: 'all', roomIds: [], expiresAt: null };
    const expired = { ...guest, id: 'old-1', username: 'antigua', displayName: 'Antigua', expiresAt: new Date(Date.now() - DAY_MS).toISOString() };
    const admin = { ...guest, id: dashboardUser.id, username: 'admin', displayName: 'Administrador', role: 'admin', accessScope: 'all', roomIds: [], expiresAt: null };
    let created: unknown = null;
    await page.route('**/api/v1/admin/users', async route => {
      if (route.request().method() === 'POST') {
        created = route.request().postDataJSON();
        return route.fulfill({ status: 201, json: { ...guest, id: 'new-1', username: 'nuevo' } });
      }
      return route.fulfill({ json: [admin, guest, legacy, expired] });
    });
    let patched: unknown = null;
    await page.route('**/api/v1/admin/users/guest-1/access', async route => {
      patched = route.request().postDataJSON();
      await route.fulfill({ json: { accessScope: 'rooms', roomIds: ['sala', 'cocina'], expiresAt: null } });
    });

    await page.goto('/system/users');
    await expect(page.getByRole('heading', { name: /Personas y acceso|People and access/i })).toBeVisible();

    // What each card says about the person.
    const guestCard = page.getByRole('article', { name: 'Visita', exact: true });
    await expect(guestCard).toContainText(/Solo: Sala|Only: Sala/);
    await expect(guestCard).toContainText(/Vence el|Expires on/);
    await expect(page.getByRole('article', { name: 'Antigua', exact: true })).toContainText(/Acceso vencido|Access expired/);
    await expect(page.getByRole('article', { name: 'Administrador', exact: true }).getByRole('button', { name: /Editar acceso|Edit access/i })).toHaveCount(0);
    await expect(page.getByRole('article', { name: 'Mamá', exact: true })).toContainText(/Familiar|Family/);
    await expect(page.getByRole('article', { name: 'Mamá', exact: true }).getByRole('button', { name: /Editar acceso|Edit access/i })).toHaveCount(0);

    // Editing the access of the guest.
    await guestCard.getByRole('button', { name: /Editar acceso|Edit access/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: 'Sala' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Cocina' })).not.toBeChecked();
    await dialog.getByRole('checkbox', { name: 'Cocina' }).check();
    await dialog.getByRole('radio', { name: /Sin vencimiento|No expiry/i }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await dialog.getByRole('button', { name: /Guardar acceso|Save access/i }).click();
    await expect(dialog).toHaveCount(0);
    expect(patched).toEqual({ accessScope: 'rooms', roomIds: ['sala', 'cocina'], expiresAt: null });

    // Adding a new guest starts with no rooms and a week, and warns until a room is chosen.
    await page.getByRole('button', { name: /Añadir persona|Add person/i }).click();
    const form = page.getByRole('form').or(page.locator('form')).first();
    await form.getByRole('radio', { name: /Invitado|Guest/ }).click();
    await expect(form.getByRole('radio', { name: /Solo algunas habitaciones|Only some rooms/i })).toHaveAttribute('aria-checked', 'true');
    await expect(form.getByRole('radio', { name: /7 días|7 days/i })).toHaveAttribute('aria-checked', 'true');
    await expect(form.getByText(/no verá nada|will see nothing/i)).toBeVisible();
    await form.getByLabel(/Nombre de Usuario|Username/i).fill('nuevo');
    await form.getByLabel(/Contraseña Inicial|Initial Password/i).fill('longenough1');
    await form.getByRole('checkbox', { name: 'Garage' }).check();
    await expect(form.getByText(/no verá nada|will see nothing/i)).toHaveCount(0);

    // Switching to a family member hides the room and expiry choices.
    await form.getByRole('radio', { name: /Familiar|Family member/ }).click();
    await expect(form.getByRole('checkbox', { name: 'Garage' })).toHaveCount(0);
    await form.getByRole('radio', { name: /Invitado|Guest/ }).click();
    await form.getByRole('checkbox', { name: 'Garage' }).check();
    await form.getByRole('button', { name: /Crear cuenta|Create account/i }).click();
    await expect.poll(() => created).not.toBeNull();
    const body = created as { username: string; role: string; accessScope: string; roomIds: string[]; expiresAt: string };
    expect(body).toMatchObject({ username: 'nuevo', role: 'guest', accessScope: 'rooms', roomIds: ['garage'] });
    const days = (Date.parse(body.expiresAt) - Date.now()) / DAY_MS;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}

test('Feature: Household access — Scenario: A custom last day must be in the future', async ({ page }) => {
  await prepareAuthenticatedDashboard(page);
  await page.route('**/api/v1/rooms', route => route.fulfill({ json: rooms }));
  await page.route('**/api/v1/admin/users', route => route.fulfill({ json: [{
    id: 'child-1', username: 'nino', displayName: 'Niño', avatarDataUri: null, role: 'child', isActive: true, hasActiveSessions: false,
    accessScope: 'all', roomIds: [], expiresAt: null, createdAt: '', updatedAt: '',
  }] }));
  let saved = 0;
  await page.route('**/api/v1/admin/users/child-1/access', route => { saved += 1; return route.fulfill({ json: {} }); });

  await page.goto('/system/users');
  await page.getByRole('article', { name: 'Niño', exact: true }).getByRole('button', { name: /Editar acceso|Edit access/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /Elegir fecha|Pick a date/i }).click();
  await dialog.getByRole('button', { name: /Guardar acceso|Save access/i }).click();
  await expect(dialog.getByText(/a partir de mañana|from tomorrow/i)).toBeVisible();
  expect(saved).toBe(0);
});
