import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UiLabelsContext, type UiLabels } from './ui/uiLabels';

/** Translates the primitives' built-in texts once, at the app root. */
export function UiLabelsBridge({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const labels = useMemo<UiLabels>(() => ({
    close: t('common.close'),
    confirm: t('common.confirm'),
    cancel: t('common.cancel'),
    search: t('common.search'),
    clearSearch: t('common.clear_search'),
    selectOption: t('common.select_option'),
    noResults: t('common.no_results'),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` changes identity with the language
  }), [t, i18n.language]);
  return <UiLabelsContext.Provider value={labels}>{children}</UiLabelsContext.Provider>;
}
