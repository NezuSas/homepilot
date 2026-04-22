import React from 'react';
import { cn } from '../../lib/utils';
import { SearchInput } from './Input';

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
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-2xl border border-border/50 overflow-x-auto no-scrollbar max-w-full">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeFilter === opt.value ? "bg-background text-primary shadow-sm border border-border" : "text-muted-foreground hover:bg-background/20"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
