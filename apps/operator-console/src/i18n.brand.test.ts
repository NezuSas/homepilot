import i18n from './i18n';
import { BRAND } from './brand';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';

const leafKeys = (value: unknown, prefix = ''): string[] => (
  value !== null && typeof value === 'object'
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
);

describe('Feature: every text takes the product name from brand.json', () => {
  it.each(['es', 'en'] as const)('Scenario: Given the %s texts When any is rendered Then no brand placeholder is left unresolved', async (language) => {
    await i18n.changeLanguage(language);
    const resource = language === 'es' ? esCommon : enCommon;
    const unresolved = leafKeys(resource).filter((key) => /\{\{\s*(brand|company)\s*\}\}/.test(String(i18n.t(key))));

    expect(unresolved).toEqual([]);
  });

  it('Scenario: Given the application title When rendered Then it is exactly the product name', async () => {
    await i18n.changeLanguage('es');

    expect(i18n.t('shell.app_title')).toBe(BRAND.productName);
  });

  it('Scenario: Given a sentence that names the product When rendered in both languages Then the name from brand.json appears', async () => {
    await i18n.changeLanguage('es');
    const spanish = i18n.t('ha_settings.status_card.title');
    const withBrand = leafKeys(esCommon).find((key) => String((key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], esCommon))).includes('{{brand}}'));

    expect(withBrand).toBeDefined();
    expect(i18n.t(withBrand!)).toContain(BRAND.productName);
    expect(spanish.length).toBeGreaterThan(0);
  });

  it('Scenario: Given the locale files When read Then none writes the product name by hand', () => {
    expect(JSON.stringify(esCommon)).not.toContain(BRAND.productName);
    expect(JSON.stringify(enCommon)).not.toContain(BRAND.productName);
  });
});
