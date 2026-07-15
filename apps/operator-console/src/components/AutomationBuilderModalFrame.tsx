import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './ui/IconButton';

interface AutomationBuilderModalFrameProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const AutomationBuilderModalFrame: React.FC<AutomationBuilderModalFrameProps> = ({
  title,
  subtitle,
  onClose,
  children
}) => createPortal(
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
    <div className="absolute inset-0 bg-background/70 backdrop-blur-3xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
    <div className="relative w-full max-w-4xl overflow-hidden rounded-panel border border-border/55 bg-card/95 shadow-modal-premium ring-1 ring-background/50 backdrop-blur-2xl animate-in zoom-in-95 duration-500 dark:border-border/35">
      <div className="flex items-start justify-between gap-4 border-b border-border/45 px-5 py-5 sm:px-8 sm:py-6">
        <div>
          <h2 className="hp-type-modal-title">{title}</h2>
          <p className="hp-type-label mt-2">{subtitle}</p>
        </div>
        <IconButton icon={X} label="Cerrar constructor" onClick={onClose} />
      </div>
      <div className="max-h-sheet space-y-6 overflow-y-auto p-5 custom-scrollbar sm:p-8">
        {children}
      </div>
    </div>
  </div>,
  document.body
);
