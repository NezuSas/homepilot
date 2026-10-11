import React from 'react';
import { useUiLabels } from './uiLabels';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SearchInput } from './Input';
import { IconButton } from './IconButton';
import { SegmentedControl } from './SegmentedControl';

export interface FilterOption {
  value: string;
  label: string;
}

export interface SearchFilterBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  
  options?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (val: string) => void;
  filterLabel?: string;
  
  className?: string;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  options = [],
  activeFilter,
  onFilterChange,
  filterLabel,
  className,
  ...rootProps
}) => {
  const labels = useUiLabels();

  return (
    <div {...rootProps} className={cn("flex min-w-0 w-full flex-col items-stretch gap-3 lg:flex-row lg:items-center", className)}>
      <div className="min-w-0 w-full shrink-0 lg:w-search-panel">
        <SearchInput 
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder ?? labels.search}
          endAdornment={searchQuery ? (
            <IconButton
              icon={X}
              label={labels.clearSearch}
              onClick={() => onSearchChange('')}
              size="sm"
              variant="ghost"

            />
          ) : undefined}
        />
      </div>
      
      {options.length > 0 && onFilterChange && (
        <SegmentedControl
          value={activeFilter || options[0]?.value || ''}
          options={options}
          onChange={onFilterChange}
          label={filterLabel ?? searchPlaceholder ?? labels.search}
          layout="scroll"
          className="w-full min-w-0 flex-1"
        />
      )}
    </div>
  );
};
