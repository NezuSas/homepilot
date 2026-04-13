import React from 'react';
import { Power, PowerOff, ShieldAlert, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface QuickControlLayerProps {
  onAction: (type: 'all-on' | 'all-off' | 'panic') => void;
  isProcessing?: boolean;
}

export const QuickControlLayer: React.FC<QuickControlLayerProps> = ({ onAction, isProcessing }) => {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-4 animate-in slide-in-from-right-10 duration-1000">
      <div className="flex flex-col gap-2 p-3 bg-card/60 backdrop-blur-3xl border-2 border-border/40 rounded-[2.5rem] shadow-2xl">
        <ControlBtn 
          icon={<Power className="w-5 h-5" />} 
          label="All On" 
          onClick={() => onAction('all-on')}
          variant="primary"
          disabled={isProcessing}
        />
        <ControlBtn 
          icon={<PowerOff className="w-5 h-5" />} 
          label="All Off" 
          onClick={() => onAction('all-off')}
          variant="secondary"
          disabled={isProcessing}
        />
        <div className="h-px bg-border/40 mx-2 my-1" />
        <ControlBtn 
          icon={<ShieldAlert className="w-5 h-5" />} 
          label="Panic" 
          onClick={() => onAction('panic')}
          variant="danger"
          disabled={isProcessing}
        />
      </div>
      <div className="flex flex-col items-center">
         <div className="w-px h-12 bg-gradient-to-b from-border/40 to-transparent" />
         <Zap className="w-3 h-3 text-primary/40 mt-2" />
      </div>
    </div>
  );
};

interface ControlBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

const ControlBtn = ({ icon, label, onClick, variant, disabled }: ControlBtnProps) => {
  const variants = {
    primary: "hover:bg-primary/10 hover:text-primary border-transparent",
    secondary: "hover:bg-muted/60 text-muted-foreground border-transparent",
    danger: "hover:bg-destructive/10 text-destructive border-transparent"
  };

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 border-2 active:scale-90 disabled:opacity-50",
        variants[variant]
      )}
      title={label}
    >
      <div className="relative z-10">{icon}</div>
      <span className="absolute right-full mr-4 px-3 py-1.5 bg-card/80 backdrop-blur-xl border border-border/40 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[10px] group-hover:translate-x-0 whitespace-nowrap shadow-xl">
        {label}
      </span>
    </button>
  );
};
