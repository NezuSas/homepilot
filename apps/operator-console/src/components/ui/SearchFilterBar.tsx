import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SearchInput } from './Input';
import { IconButton } from './IconButton';
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
    <div className={cn("flex min-w-0 w-full flex-col items-stretch gap-3 lg:flex-row lg:items-center", className)}>
      <div className="min-w-0 w-full shrink-0 lg:w-search-panel">
        <SearchInput 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? t('common.search')}
          endAdornment={searchQuery ? (
            <IconButton
              icon={X}
              label={t('common.clear_search')}
              onClick={() => onSearchChange('')}
              size="sm"
              variant="ghost"
              className="h-7 w-7"
            />
          ) : undefined}
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
