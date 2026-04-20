import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '../lib/utils';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}

const Select: React.FC<SelectProps> = ({ value, onChange, options, placeholder, className, searchable = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 py-3 text-left flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
          isOpen && "ring-2 ring-primary/20 border-primary/40 bg-foreground/[0.05]"
        )}
      >
        <span className={cn("font-medium truncate mr-2", !selectedOption && "text-foreground/40")}>
          {selectedOption ? selectedOption.label : placeholder || 'Select option...'}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-foreground/30 transition-transform shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-[63] mt-2 w-full bg-card/95 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {searchable && (
            <div className="p-2 border-b border-foreground/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-foreground/[0.05] border-none rounded-lg pl-9 pr-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary/30 outline-none"
                />
              </div>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-foreground/30 font-medium">
                No results found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left outline-none",
                    option.value === value 
                      ? "bg-primary/10 text-primary" 
                      : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground focus:bg-foreground/5"
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
