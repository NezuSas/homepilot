import React from 'react';
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
}) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-background/60 backdrop-blur-3xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
    <div className="relative w-full max-w-3xl bg-card/60 backdrop-blur-2xl border-2 border-border/40 rounded-modal shadow-depth-3 overflow-hidden animate-in zoom-in-95 duration-500">
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">{title}</h2>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 mt-1">{subtitle}</p>
        </div>
        <IconButton icon={X} label="Cerrar constructor" onClick={onClose} />
      </div>
      <div className="p-8 pt-2 max-h-[82vh] overflow-y-auto custom-scrollbar space-y-6">
        {children}
      </div>
    </div>
  </div>
);
