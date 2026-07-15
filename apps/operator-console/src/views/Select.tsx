import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the portal dropdown by adding a specific class or ID to it.
      // But simpler: just close it on any outside click. The portal content stops propagation.
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // If the click is inside a portal element with a specific class, ignore.
        if ((target as Element).closest?.('.portal-select-dropdown')) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (containerRef.current) {
        setRect(containerRef.current.getBoundingClientRect());
      }
    } else {
      setSearchQuery('');
      setRect(null);
    }
  }, [isOpen, searchable]);

  // Close dropdown on container scroll or window resize to prevent it from floating disconnected
  useEffect(() => {
    const handleScrollOrResize = (e: Event) => {
      const target = e.target as Element;
      // Don't close if exactly the dropdown's inner list is scrolling
      if (target.classList?.contains('portal-select-dropdown-list')) return;
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-11 bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
          isOpen && "ring-2 ring-primary/20 border-primary/40 bg-foreground/[0.05]"
        )}
      >
        <span className={cn("font-medium truncate mr-2", !selectedOption && "text-foreground/40")}>
          {selectedOption ? selectedOption.label : placeholder || t('common.select_option')}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-foreground/30 transition-transform shrink-0", isOpen && "rotate-180")} />
      </button>

      {isOpen && rect && createPortal(
        <div 
          className="portal-select-dropdown fixed z-[99999] bg-card/95 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-depth-3 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: rect.bottom + 8,
            left: rect.left,
            width: rect.width,
          }}
        >
          {searchable && (
            <div className="p-2 border-b border-foreground/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground/30" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                  className="w-full bg-foreground/[0.05] border-none rounded-lg pl-9 pr-3 py-2 text-caption font-medium focus:ring-1 focus:ring-primary/30 outline-none"
                />
              </div>
            </div>
          )}
          <div className="portal-select-dropdown-list max-h-60 overflow-y-auto custom-scrollbar p-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-caption text-foreground/30 font-medium">
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
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-body font-medium transition-colors text-left outline-none",
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default Select;
