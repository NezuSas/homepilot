import React from 'react';
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
  searchPlaceholder = 'Search...',
  options = [],
  activeFilter,
  onFilterChange,
  className
}) => {
  return (
    <div className={cn("flex flex-col sm:flex-row gap-3 w-full items-start sm:items-center", className)}>
      <div className="flex-1 w-full sm:max-w-xs">
        <SearchInput 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      
      {options.length > 0 && onFilterChange && (
        <SegmentedControl
          value={activeFilter || options[0]?.value || ''}
          options={options}
          onChange={onFilterChange}
          className="max-w-full overflow-x-auto no-scrollbar"
          optionClassName="whitespace-nowrap flex-none"
        />
      )}
    </div>
  );
};
