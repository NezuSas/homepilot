import { createContext, useContext } from 'react';

/**
 * Texts that primitives show on their own (close button, empty search result…).
 * Primitives stay free of i18n: the app root supplies translated values through
 * `UiLabelsContext`, and a per-instance prop always wins over the context.
 */
export interface UiLabels {
  close: string;
  confirm: string;
  cancel: string;
  search: string;
  clearSearch: string;
  selectOption: string;
  noResults: string;
}

export const defaultUiLabels: UiLabels = {
  close: 'Close',
  confirm: 'Confirm',
  cancel: 'Cancel',
  search: 'Search',
  clearSearch: 'Clear search',
  selectOption: 'Select an option',
  noResults: 'No results',
};

export const UiLabelsContext = createContext<UiLabels>(defaultUiLabels);

export const useUiLabels = (): UiLabels => useContext(UiLabelsContext);
