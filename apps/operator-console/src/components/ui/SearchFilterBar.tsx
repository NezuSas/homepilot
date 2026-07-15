import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { SearchInput } from './Input';
import { SegmentedControl } from './SegmentedControl';

export interface FilterOption {
  value: string;
  label: string;
}

export interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  
  options?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (val: string) => void;
  
  className?: string;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  options = [],
  activeFilter,
  onFilterChange,
  className
}) => {
  const { t } = useTranslation();

  return (
    <div className={cn("flex w-full flex-col items-stretch gap-3 xl:flex-row xl:items-center", className)}>
      <div className="w-full shrink-0 xl:w-search-panel">
        <SearchInput 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? t('common.search')}
        />
      </div>
      
      {options.length > 0 && onFilterChange && (
        <SegmentedControl
          value={activeFilter || options[0]?.value || ''}
          options={options}
          onChange={onFilterChange}
          className="w-full min-w-0 flex-1 overflow-x-auto no-scrollbar"
          optionClassName="whitespace-nowrap flex-none"
        />
      )}
    </div>
  );
};
