import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchableSelectPanel } from './SearchableSelectPanel';
import { groupOptions, type SearchableSelectOption } from './searchableSelectModel';

const options: SearchableSelectOption[] = [
  { value: 'a', label: 'Alpha', description: 'First', group: 'Letters' },
  { value: 'b', label: 'Beta', group: 'Letters' },
];

function render(filtered: SearchableSelectOption[]) {
  return renderToStaticMarkup(
    <SearchableSelectPanel
      popupId="popup"
      listboxId="listbox"
      ariaLabel="Pick"
      position={{ left: 1, top: 2, width: 3, maxHeight: 4 }}
      query=""
      onQueryChange={() => {}}
      searchPlaceholder="Search"
      noResultsLabel="Nothing"
      filteredOptions={filtered}
      groups={groupOptions(filtered)}
      value="b"
      onSelect={() => {}}
      onEscape={() => {}}
      panelRef={createRef<HTMLDivElement>()}
      searchInputRef={createRef<HTMLInputElement>()}
      optionRefs={{ current: new Map() }}
    />,
  );
}

describe('SearchableSelectPanel', () => {
  it('renders grouped options with the selected one marked', () => {
    const markup = render(options);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-label="Letters"');
    expect(markup).toContain('First');
    expect(markup).toMatch(/aria-selected="true"[^>]*>[\s\S]*Beta/);
    expect(markup).toContain('left:1px;top:2px;width:3px;max-height:4px');
  });

  it('renders the empty state when nothing matches', () => {
    expect(render([])).toContain('Nothing');
  });
});
